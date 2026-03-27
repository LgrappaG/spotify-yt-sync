import { stringSimilarity } from 'string-similarity';
import { SpotifyTrack, YouTubeVideo, MatcherResult } from '../types/index.js';
import { MatchError } from './errors.js';

/**
 * Normalizes a string for matching by removing special characters and
 * converting to lowercase
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Extracts artist name from a Spotify track
 */
export function extractArtistName(track: SpotifyTrack): string {
  if (!track.artists || track.artists.length === 0) {
    return '';
  }
  return track.artists.map((a) => a.name).join(', ');
}

/**
 * Creates a searchable key from track and artist names
 */
export function createSearchKey(
  trackName: string,
  artistName: string
): string {
  return normalizeString(`${trackName} ${artistName}`);
}

/**
 * Performs exact match comparison between Spotify track and YouTube video
 */
export function exactMatch(
  spotifyTrack: SpotifyTrack,
  youtubeVideo: YouTubeVideo
): boolean {
  const spotifyKey = createSearchKey(
    spotifyTrack.name,
    extractArtistName(spotifyTrack)
  );
  const youtubeKey = normalizeString(youtubeVideo.snippet.title);

  return spotifyKey === youtubeKey;
}

/**
 * Performs fuzzy match comparison using string similarity
 * Returns match score between 0 and 1
 */
export function fuzzyMatch(
  spotifyTrack: SpotifyTrack,
  youtubeVideo: YouTubeVideo,
  threshold: number = 0.75
): number {
  const spotifyKey = createSearchKey(
    spotifyTrack.name,
    extractArtistName(spotifyTrack)
  );
  const youtubeKey = normalizeString(youtubeVideo.snippet.title);

  try {
    const similarity = stringSimilarity(spotifyKey, youtubeKey);
    return similarity >= threshold ? similarity : 0;
  } catch (error) {
    throw new MatchError('Failed to perform fuzzy matching', {
      spotifyTrack: spotifyTrack.name,
      youtubeVideo: youtubeVideo.snippet.title,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Matches a Spotify track against a YouTube video
 */
export function matchTrack(
  spotifyTrack: SpotifyTrack,
  youtubeVideo: YouTubeVideo,
  options: {
    useFuzzyMatching?: boolean;
    fuzzyMatchThreshold?: number;
  } = {}
): MatcherResult {
  const { useFuzzyMatching = true, fuzzyMatchThreshold = 0.75 } = options;

  try {
    // Try exact match first
    if (exactMatch(spotifyTrack, youtubeVideo)) {
      return {
        matched: true,
        method: 'exact',
        score: 1.0,
        video: youtubeVideo,
      };
    }

    // Try fuzzy match if enabled
    if (useFuzzyMatching) {
      const fuzzyScore = fuzzyMatch(
        spotifyTrack,
        youtubeVideo,
        fuzzyMatchThreshold
      );
      if (fuzzyScore > 0) {
        return {
          matched: true,
          method: 'fuzzy',
          score: fuzzyScore,
          video: youtubeVideo,
        };
      }
    }

    // No match
    return {
      matched: false,
      method: 'none',
      score: 0,
    };
  } catch (error) {
    throw new MatchError('Track matching failed', {
      spotifyTrackId: spotifyTrack.id,
      youtubeVideoId: youtubeVideo.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Finds the best match from a list of YouTube videos
 */
export function findBestMatch(
  spotifyTrack: SpotifyTrack,
  youtubeVideos: YouTubeVideo[],
  options: {
    useFuzzyMatching?: boolean;
    fuzzyMatchThreshold?: number;
  } = {}
): MatcherResult | null {
  if (!youtubeVideos || youtubeVideos.length === 0) {
    return null;
  }

  let bestMatch: MatcherResult | null = null;

  for (const video of youtubeVideos) {
    const result = matchTrack(spotifyTrack, video, options);

    // Exact match takes priority
    if (result.matched && result.method === 'exact') {
      return result;
    }

    // Keep track of best fuzzy match
    if (
      result.matched &&
      result.method === 'fuzzy' &&
      (!bestMatch || result.score > bestMatch.score)
    ) {
      bestMatch = result;
    }
  }

  return bestMatch;
}

/**
 * Validates matcher configuration
 */
export function validateMatcherConfig(config: {
  useFuzzyMatching?: boolean;
  fuzzyMatchThreshold?: number;
}): void {
  if (
    config.useFuzzyMatching === false &&
    config.fuzzyMatchThreshold !== undefined
  ) {
    throw new MatchError(
      'fuzzyMatchThreshold is ignored when useFuzzyMatching is false',
      { config }
    );
  }

  if (config.fuzzyMatchThreshold !== undefined) {
    if (config.fuzzyMatchThreshold < 0 || config.fuzzyMatchThreshold > 1) {
      throw new MatchError('fuzzyMatchThreshold must be between 0 and 1', {
        fuzzyMatchThreshold: config.fuzzyMatchThreshold,
      });
    }
  }
}
