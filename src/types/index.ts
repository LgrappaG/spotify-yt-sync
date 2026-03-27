// Spotify Types
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: {
    id: string;
    name: string;
    images: Array<{
      url: string;
      height?: number;
      width?: number;
    }>;
  };
  duration_ms: number;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  external_urls: {
    spotify: string;
  };
  images: Array<{
    url: string;
    height?: number;
    width?: number;
  }>;
  tracks: {
    total: number;
    items: Array<{
      track: SpotifyTrack;
    }>;
  };
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// YouTube Types
export interface YouTubeVideo {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    thumbnails: {
      default?: {
        url: string;
        width: number;
        height: number;
      };
      medium?: {
        url: string;
        width: number;
        height: number;
      };
      high?: {
        url: string;
        width: number;
        height: number;
      };
    };
  };
}

export interface YouTubePlaylist {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelId: string;
    thumbnails: {
      default?: {
        url: string;
        width: number;
        height: number;
      };
    };
  };
}

export interface YouTubePlaylistItem {
  id: string;
  snippet: {
    playlistId: string;
    position: number;
    resourceId: {
      kind: string;
      videoId: string;
    };
  };
}

// Sync Types
export interface TrackMatch {
  spotifyTrack: SpotifyTrack;
  youtubeVideo?: YouTubeVideo;
  matchMethod: 'exact' | 'fuzzy' | 'none';
  matchScore: number;
  spotifyId: string;
  youtubeId?: string;
  artistName: string;
  trackName: string;
}

export interface SyncReport {
  timestamp: string;
  playlistName: string;
  playlistId: string;
  totalTracks: number;
  successfulMatches: number;
  fuzzyMatches: number;
  exactMatches: number;
  unmatchedCount: number;
  addedToYouTube: number;
  duplicatesSkipped: number;
  errors: number;
  duration_ms: number;
}

export interface UnmatchedTrack {
  spotifyId: string;
  trackName: string;
  artistName: string;
  timestamp: string;
  reason: string;
}

export interface SyncError {
  timestamp: string;
  trackName: string;
  artistName: string;
  error: string;
  code?: string;
}

// Configuration
export interface AppConfig {
  spotify: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken: string;
  };
  youtube: {
    apiKey: string;
  };
  sync: {
    enabled: boolean;
    schedule: string;
    playlistIds: string[];
    useFuzzyMatching: boolean;
    fuzzyMatchThreshold: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    logsDir: string;
  };
}

// Matcher Types
export interface MatcherResult {
  matched: boolean;
  method: 'exact' | 'fuzzy' | 'none';
  score: number;
  video?: YouTubeVideo;
}

export interface RateLimitError {
  retryAfter: number;
  remaining: number;
}
