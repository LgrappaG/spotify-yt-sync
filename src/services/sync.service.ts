import { SpotifyService } from './spotify.service.js';
import { YouTubeService } from './youtube.service.js';
import { getLogger } from '../config/logger.js';
import {
  SpotifyTrack,
  TrackMatch,
  SyncReport,
  UnmatchedTrack,
  SyncError as SyncErrorType,
} from '../types/index.js';
import {
  findBestMatch,
  extractArtistName,
  validateMatcherConfig,
} from '../utils/matcher.js';
import { SyncError, SpotifyRateLimitError, YouTubeRateLimitError } from '../utils/errors.js';

/**
 * Sync Service
 * Orchestrates the synchronization between Spotify and YouTube
 */
export class SyncService {
  private logger = getLogger();
  private spotifyService: SpotifyService;
  private youtubeService: YouTubeService;
  private useFuzzyMatching: boolean;
  private fuzzyMatchThreshold: number;

  constructor(
    spotifyService: SpotifyService,
    youtubeService: YouTubeService,
    options: {
      useFuzzyMatching?: boolean;
      fuzzyMatchThreshold?: number;
    } = {}
  ) {
    this.spotifyService = spotifyService;
    this.youtubeService = youtubeService;
    this.useFuzzyMatching = options.useFuzzyMatching ?? true;
    this.fuzzyMatchThreshold = options.fuzzyMatchThreshold ?? 0.75;

    // Validate matcher configuration
    validateMatcherConfig({
      useFuzzyMatching: this.useFuzzyMatching,
      fuzzyMatchThreshold: this.fuzzyMatchThreshold,
    });
  }

  /**
   * Syncs a single Spotify playlist to YouTube
   */
  async syncPlaylist(playlistId: string, youtubePlaylistId?: string): Promise<SyncReport> {
    const startTime = Date.now();
    const syncErrors: SyncErrorType[] = [];
    const unmatchedTracks: UnmatchedTrack[] = [];
    let successfulMatches = 0;
    let fuzzyMatches = 0;
    let exactMatches = 0;
    let addedToYouTube = 0;
    let duplicatesSkipped = 0;

    try {
      this.logger.info(`Starting sync for Spotify playlist: ${playlistId}`);

      // Fetch Spotify playlist and tracks
      const playlistInfo = await this.spotifyService.getPlaylist(playlistId);
      const spotifyTracks = await this.spotifyService.getPlaylistTracks(playlistId);

      this.logger.info(
        `Fetched ${spotifyTracks.length} tracks from Spotify playlist: ${playlistInfo.name}`
      );

      // Create YouTube playlist if not provided
      let yPlaylistId = youtubePlaylistId;
      if (!yPlaylistId) {
        const yPlaylist = await this.youtubeService.createPlaylist(
          `[Synced] ${playlistInfo.name}`,
          `Synced from Spotify: ${playlistInfo.description}`
        );
        yPlaylistId = yPlaylist.id;
        this.logger.info(`Created YouTube playlist: ${yPlaylistId}`);
      }

      // Process each track
      for (const spotifyTrack of spotifyTracks) {
        try {
          const match = await this.matchAndAddTrack(
            spotifyTrack,
            yPlaylistId,
            unmatchedTracks,
            syncErrors
          );

          if (match.youtubeId) {
            successfulMatches++;
            addedToYouTube++;

            if (match.matchMethod === 'exact') {
              exactMatches++;
            } else if (match.matchMethod === 'fuzzy') {
              fuzzyMatches++;
            }
          }
        } catch (error) {
          if (
            error instanceof SpotifyRateLimitError ||
            error instanceof YouTubeRateLimitError
          ) {
            this.logger.warn('Rate limit encountered, pausing sync');
            throw error;
          }

          syncErrors.push({
            timestamp: new Date().toISOString(),
            trackName: spotifyTrack.name,
            artistName: extractArtistName(spotifyTrack),
            error: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof Error ? error.name : undefined,
          });

          this.logger.error(
            `Failed to process track: ${spotifyTrack.name}`,
            error
          );
        }
      }

      // Check for duplicates in final report
      if (yPlaylistId) {
        try {
          const existingItems = await this.youtubeService.getPlaylistItems(
            yPlaylistId
          );
          duplicatesSkipped = existingItems.length - addedToYouTube;
        } catch (error) {
          this.logger.warn('Failed to count duplicates', error);
        }
      }

      const duration = Date.now() - startTime;

      const report: SyncReport = {
        timestamp: new Date().toISOString(),
        playlistName: playlistInfo.name,
        playlistId,
        totalTracks: spotifyTracks.length,
        successfulMatches,
        fuzzyMatches,
        exactMatches,
        unmatchedCount: unmatchedTracks.length,
        addedToYouTube,
        duplicatesSkipped,
        errors: syncErrors.length,
        duration_ms: duration,
      };

      this.logger.info('Sync completed', report);
      this.logger.logSyncReport(report);

      // Log unmatched tracks
      unmatchedTracks.forEach((track) => {
        this.logger.logUnmatchedTrack(track);
      });

      return report;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (
        error instanceof SpotifyRateLimitError ||
        error instanceof YouTubeRateLimitError
      ) {
        this.logger.warn(
          `Sync paused due to rate limiting: ${error.message}`
        );
        throw error;
      }

      throw new SyncError(
        `Failed to sync playlist: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          playlistId,
          duration_ms: duration,
          error: error instanceof Error ? error.name : 'Unknown',
        }
      );
    }
  }

  /**
   * Matches a Spotify track to YouTube and adds it to the playlist
   */
  private async matchAndAddTrack(
    spotifyTrack: SpotifyTrack,
    youtubePlaylistId: string,
    unmatchedTracks: UnmatchedTrack[],
    syncErrors: SyncErrorType[]
  ): Promise<TrackMatch> {
    try {
      const searchQuery = `${spotifyTrack.name} ${extractArtistName(spotifyTrack)}`;

      // Search for track on YouTube
      const youtubeVideos = await this.youtubeService.searchVideos(
        searchQuery,
        5
      );

      if (youtubeVideos.length === 0) {
        unmatchedTracks.push({
          spotifyId: spotifyTrack.id,
          trackName: spotifyTrack.name,
          artistName: extractArtistName(spotifyTrack),
          timestamp: new Date().toISOString(),
          reason: 'No YouTube videos found',
        });

        return {
          spotifyTrack,
          matchMethod: 'none',
          matchScore: 0,
          spotifyId: spotifyTrack.id,
          artistName: extractArtistName(spotifyTrack),
          trackName: spotifyTrack.name,
        };
      }

      // Find best match
      const matchResult = findBestMatch(spotifyTrack, youtubeVideos, {
        useFuzzyMatching: this.useFuzzyMatching,
        fuzzyMatchThreshold: this.fuzzyMatchThreshold,
      });

      if (!matchResult || !matchResult.video) {
        unmatchedTracks.push({
          spotifyId: spotifyTrack.id,
          trackName: spotifyTrack.name,
          artistName: extractArtistName(spotifyTrack),
          timestamp: new Date().toISOString(),
          reason: 'No suitable match found',
        });

        return {
          spotifyTrack,
          matchMethod: 'none',
          matchScore: 0,
          spotifyId: spotifyTrack.id,
          artistName: extractArtistName(spotifyTrack),
          trackName: spotifyTrack.name,
        };
      }

      // Check for duplicates
      const isDuplicate = await this.youtubeService.videoExistsInPlaylist(
        youtubePlaylistId,
        matchResult.video.id
      );

      if (isDuplicate) {
        this.logger.debug(
          `Video already in playlist: ${matchResult.video.snippet.title}`
        );

        return {
          spotifyTrack,
          youtubeVideo: matchResult.video,
          matchMethod: matchResult.method,
          matchScore: matchResult.score,
          spotifyId: spotifyTrack.id,
          youtubeId: matchResult.video.id,
          artistName: extractArtistName(spotifyTrack),
          trackName: spotifyTrack.name,
        };
      }

      // Add video to YouTube playlist
      await this.youtubeService.addVideoToPlaylist(
        youtubePlaylistId,
        matchResult.video.id
      );

      this.logger.info(
        `Added to YouTube: ${spotifyTrack.name} -> ${matchResult.video.snippet.title} (${matchResult.method}, score: ${matchResult.score.toFixed(2)})`
      );

      return {
        spotifyTrack,
        youtubeVideo: matchResult.video,
        matchMethod: matchResult.method,
        matchScore: matchResult.score,
        spotifyId: spotifyTrack.id,
        youtubeId: matchResult.video.id,
        artistName: extractArtistName(spotifyTrack),
        trackName: spotifyTrack.name,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Syncs multiple playlists
   */
  async syncPlaylists(playlistIds: string[]): Promise<SyncReport[]> {
    const reports: SyncReport[] = [];

    for (const playlistId of playlistIds) {
      try {
        const report = await this.syncPlaylist(playlistId);
        reports.push(report);
      } catch (error) {
        if (
          error instanceof SpotifyRateLimitError ||
          error instanceof YouTubeRateLimitError
        ) {
          this.logger.warn('Rate limit reached, stopping sync');
          break;
        }

        this.logger.error(
          `Failed to sync playlist ${playlistId}`,
          error instanceof Error ? error.message : error
        );

        // Continue with next playlist
        continue;
      }
    }

    return reports;
  }

  /**
   * Gets sync statistics
   */
  getSyncStats(reports: SyncReport[]): {
    totalPlaylists: number;
    totalTracks: number;
    totalMatches: number;
    totalErrors: number;
    successRate: number;
  } {
    const totalPlaylists = reports.length;
    const totalTracks = reports.reduce((sum, r) => sum + r.totalTracks, 0);
    const totalMatches = reports.reduce((sum, r) => sum + r.successfulMatches, 0);
    const totalErrors = reports.reduce((sum, r) => sum + r.errors, 0);
    const successRate =
      totalTracks > 0 ? (totalMatches / totalTracks) * 100 : 0;

    return {
      totalPlaylists,
      totalTracks,
      totalMatches,
      totalErrors,
      successRate: Math.round(successRate * 100) / 100,
    };
  }
}
