import axios, { AxiosInstance } from 'axios';
import { getLogger } from '../config/logger.js';
import { YouTubeVideo, YouTubePlaylist, YouTubePlaylistItem } from '../types/index.js';
import {
  YouTubeError,
  YouTubeRateLimitError,
  YouTubeAuthError,
  NetworkError,
} from '../utils/errors.js';

/**
 * YouTube API Service
 * Handles authentication and API interactions with YouTube
 */
export class YouTubeService {
  private logger = getLogger();
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;

    this.client = axios.create({
      baseURL: 'https://www.googleapis.com/youtube/v3',
      timeout: 10000,
      params: {
        key: apiKey,
      },
    });
  }

  /**
   * Handles rate limiting from YouTube API
   */
  private handleRateLimit(quotaExceeded: boolean = false): void {
    if (quotaExceeded) {
      const error = new YouTubeRateLimitError(86400); // 24 hours for quota
      this.logger.error('YouTube quota exceeded', { error });
      throw error;
    }

    throw new YouTubeRateLimitError(60); // 1 minute for general rate limit
  }

  /**
   * Searches for videos on YouTube
   */
  async searchVideos(query: string, limit: number = 5): Promise<YouTubeVideo[]> {
    try {
      this.logger.debug(`Searching YouTube for: ${query}`);

      const response = await this.client.get('/search', {
        params: {
          q: query,
          part: 'snippet',
          type: 'video',
          maxResults: Math.min(limit, 50),
          videoEmbeddable: true,
        },
      });

      if (!response.data.items || response.data.items.length === 0) {
        this.logger.debug(`No YouTube videos found for: ${query}`);
        return [];
      }

      // Get video IDs to fetch full details
      const videoIds = response.data.items.map((item: any) => item.id.videoId);

      // Fetch full video details
      const videos = await this.getVideoDetails(videoIds);
      this.logger.debug(`Found ${videos.length} videos for query: ${query}`);

      return videos;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          const errorReason = error.response.data?.error?.errors?.[0]?.reason;
          if (errorReason === 'quotaExceeded') {
            this.handleRateLimit(true);
          }
          throw new YouTubeAuthError('Forbidden - check API key and quota');
        }
        if (error.response?.status === 401) {
          throw new YouTubeAuthError('Unauthorized - invalid API key');
        }
        if (error.response?.status === 429) {
          this.handleRateLimit();
        }
        throw new YouTubeError(
          `Failed to search YouTube: ${error.message}`,
          error.response?.status || 500
        );
      }
      throw new NetworkError('Failed to search YouTube', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Gets video details by IDs
   */
  async getVideoDetails(videoIds: string[]): Promise<YouTubeVideo[]> {
    try {
      if (videoIds.length === 0) {
        return [];
      }

      this.logger.debug(`Fetching details for ${videoIds.length} videos`);

      const response = await this.client.get('/videos', {
        params: {
          id: videoIds.join(','),
          part: 'snippet,contentDetails,statistics',
          maxResults: 50,
        },
      });

      const videos = response.data.items.map((item: any) => ({
        id: item.id,
        snippet: item.snippet,
      }));

      return videos;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new YouTubeAuthError('Forbidden - check API key');
        }
        throw new YouTubeError(`Failed to get video details: ${error.message}`);
      }
      throw new NetworkError('Failed to get YouTube video details', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Creates a playlist
   */
  async createPlaylist(
    title: string,
    description: string = ''
  ): Promise<YouTubePlaylist> {
    try {
      this.logger.info(`Creating YouTube playlist: ${title}`);

      const response = await this.client.post('/playlists', {
        snippet: {
          title,
          description,
        },
      });

      this.logger.info(`Playlist created: ${response.data.id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new YouTubeAuthError('Unauthorized - invalid API key');
        }
        if (error.response?.status === 403) {
          throw new YouTubeAuthError('Forbidden - insufficient permissions');
        }
        throw new YouTubeError(
          `Failed to create playlist: ${error.message}`,
          error.response?.status || 500
        );
      }
      throw new NetworkError('Failed to create YouTube playlist');
    }
  }

  /**
   * Adds a video to a playlist
   */
  async addVideoToPlaylist(
    playlistId: string,
    videoId: string,
    position?: number
  ): Promise<YouTubePlaylistItem> {
    try {
      this.logger.debug(
        `Adding video ${videoId} to playlist ${playlistId}`
      );

      const response = await this.client.post('/playlistItems', {
        snippet: {
          playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId,
          },
          position,
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new YouTubeAuthError('Unauthorized - invalid API key');
        }
        if (error.response?.status === 403) {
          throw new YouTubeAuthError('Forbidden - insufficient permissions');
        }
        if (error.response?.status === 404) {
          throw new YouTubeError('Video or playlist not found', 404);
        }
        throw new YouTubeError(
          `Failed to add video to playlist: ${error.message}`,
          error.response?.status || 500,
          { playlistId, videoId }
        );
      }
      throw new NetworkError('Failed to add video to YouTube playlist', {
        playlistId,
        videoId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Gets playlist items
   */
  async getPlaylistItems(playlistId: string): Promise<YouTubePlaylistItem[]> {
    try {
      this.logger.debug(`Fetching items for playlist: ${playlistId}`);

      const allItems: YouTubePlaylistItem[] = [];
      let pageToken: string | undefined;

      while (true) {
        const response = await this.client.get('/playlistItems', {
          params: {
            playlistId,
            part: 'snippet',
            maxResults: 50,
            pageToken,
          },
        });

        allItems.push(...(response.data.items || []));

        if (!response.data.nextPageToken) {
          break;
        }

        pageToken = response.data.nextPageToken;
      }

      this.logger.debug(`Fetched ${allItems.length} items from playlist`);
      return allItems;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new YouTubeError('Playlist not found', 404);
        }
        throw new YouTubeError(
          `Failed to get playlist items: ${error.message}`,
          error.response?.status || 500,
          { playlistId }
        );
      }
      throw new NetworkError('Failed to get YouTube playlist items', {
        playlistId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Checks if a video already exists in a playlist
   */
  async videoExistsInPlaylist(
    playlistId: string,
    videoId: string
  ): Promise<boolean> {
    try {
      const items = await this.getPlaylistItems(playlistId);
      return items.some(
        (item) => item.snippet.resourceId.videoId === videoId
      );
    } catch (error) {
      this.logger.warn(
        `Failed to check if video exists in playlist: ${error}`
      );
      return false;
    }
  }

  /**
   * Validates the API key
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.get('/search', {
        params: {
          q: 'test',
          part: 'snippet',
          type: 'video',
          maxResults: 1,
        },
      });
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          return false;
        }
      }
      throw error;
    }
  }
}
