import axios, { AxiosInstance } from 'axios';
import { getLogger } from '../config/logger.js';
import {
  SpotifyTrack,
  SpotifyPlaylist,
  SpotifyTokenResponse,
} from '../types/index.js';
import {
  SpotifyError,
  SpotifyRateLimitError,
  SpotifyAuthError,
  NetworkError,
} from '../utils/errors.js';

/**
 * Spotify API Service
 * Handles authentication and API interactions with Spotify
 */
export class SpotifyService {
  private logger = getLogger();
  private client: AxiosInstance;
  private accessToken: string = '';
  private tokenExpiry: number = 0;
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;

  constructor(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;

    this.client = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      timeout: 10000,
    });
  }

  /**
   * Refreshes the access token using the refresh token
   */
  async refreshAccessToken(): Promise<string> {
    try {
      this.logger.debug('Refreshing Spotify access token');

      const response = await axios.post<SpotifyTokenResponse>(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      this.logger.info('Spotify access token refreshed successfully');
      return this.accessToken;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new SpotifyAuthError(
            'Failed to refresh Spotify token - invalid credentials',
            {
              status: error.response.status,
              data: error.response.data,
            }
          );
        }
        throw new NetworkError('Failed to refresh Spotify token', {
          status: error.response?.status,
          message: error.message,
        });
      }
      throw new SpotifyError('Unexpected error refreshing Spotify token');
    }
  }

  /**
   * Ensures access token is valid, refreshing if necessary
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Sets the authorization header
   */
  private setAuthHeader(): void {
    this.client.defaults.headers.common['Authorization'] =
      `Bearer ${this.accessToken}`;
  }

  /**
   * Handles rate limiting from Spotify API
   */
  private handleRateLimit(retryAfter?: string | number): void {
    const retrySeconds = typeof retryAfter === 'string'
      ? parseInt(retryAfter, 10)
      : (retryAfter || 60);

    throw new SpotifyRateLimitError(retrySeconds, 0);
  }

  /**
   * Gets a playlist by ID
   */
  async getPlaylist(playlistId: string): Promise<SpotifyPlaylist> {
    try {
      await this.ensureValidToken();
      this.setAuthHeader();

      this.logger.debug(`Fetching Spotify playlist: ${playlistId}`);

      const response = await this.client.get<SpotifyPlaylist>(
        `/playlists/${playlistId}`,
        {
          params: {
            fields: 'id,name,description,external_urls,images,tracks',
          },
        }
      );

      this.logger.info(`Fetched playlist: ${response.data.name}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          this.handleRateLimit(error.response.headers['retry-after']);
        }
        if (error.response?.status === 401) {
          throw new SpotifyAuthError('Unauthorized - invalid token');
        }
        if (error.response?.status === 404) {
          throw new SpotifyError(`Playlist not found: ${playlistId}`, 404);
        }
        throw new SpotifyError(
          `Failed to fetch playlist: ${error.message}`,
          error.response?.status || 500,
          { playlistId }
        );
      }
      throw new NetworkError('Failed to fetch Spotify playlist', {
        playlistId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Gets all tracks from a playlist (handles pagination)
   */
  async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
    try {
      await this.ensureValidToken();
      this.setAuthHeader();

      this.logger.debug(`Fetching tracks for playlist: ${playlistId}`);

      const allTracks: SpotifyTrack[] = [];
      let offset = 0;
      const limit = 50; // Maximum items per request

      while (true) {
        const response = await this.client.get(
          `/playlists/${playlistId}/items`,
          {
            params: {
              limit,
              offset,
              fields: 'items(track(id,name,artists,album,duration_ms,external_urls)),total',
            },
          }
        );

        const tracks = response.data.items
          .map((item: { track: SpotifyTrack | null }) => item.track)
          .filter(Boolean);
        allTracks.push(...tracks);

        if (response.data.total <= offset + limit) {
          break;
        }

        offset += limit;
      }

      this.logger.info(`Fetched ${allTracks.length} tracks from playlist`);
      return allTracks;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          this.handleRateLimit(error.response.headers['retry-after']);
        }
        if (error.response?.status === 401) {
          throw new SpotifyAuthError('Unauthorized - invalid token');
        }
        throw new SpotifyError(
          `Failed to fetch playlist tracks: ${error.message}`,
          error.response?.status || 500,
          { playlistId }
        );
      }
      throw new NetworkError('Failed to fetch Spotify playlist tracks', {
        playlistId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Searches for a track on Spotify
   */
  async searchTrack(
    query: string,
    limit: number = 5
  ): Promise<SpotifyTrack[]> {
    try {
      await this.ensureValidToken();
      this.setAuthHeader();

      this.logger.debug(`Searching Spotify for: ${query}`);

      const response = await this.client.get('/search', {
        params: {
          q: query,
          type: 'track',
          limit,
        },
      });

      return response.data.tracks.items || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          this.handleRateLimit(error.response.headers['retry-after']);
        }
        throw new SpotifyError(
          `Failed to search Spotify: ${error.message}`,
          error.response?.status || 500
        );
      }
      throw new NetworkError('Failed to search Spotify', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Gets current user's profile
   */
  async getCurrentUser(): Promise<{ id: string; display_name: string }> {
    try {
      await this.ensureValidToken();
      this.setAuthHeader();

      const response = await this.client.get('/me');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new SpotifyAuthError('Unauthorized - invalid token');
        }
      }
      throw new SpotifyError('Failed to fetch current user');
    }
  }

  /**
   * Validates the current token
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch (error) {
      if (error instanceof SpotifyAuthError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Gets the access token
   */
  getAccessToken(): string {
    return this.accessToken;
  }
}
