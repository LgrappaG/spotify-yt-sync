/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN_ERROR',
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Configuration validation error
 */
export class ConfigError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', 400, details);
    this.name = 'ConfigError';
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

/**
 * Spotify API errors
 */
export class SpotifyError extends AppError {
  constructor(
    message: string,
    public statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message, 'SPOTIFY_ERROR', statusCode, details);
    this.name = 'SpotifyError';
    Object.setPrototypeOf(this, SpotifyError.prototype);
  }
}

/**
 * Spotify rate limit error
 */
export class SpotifyRateLimitError extends SpotifyError {
  constructor(
    public retryAfter: number,
    public remaining: number = 0
  ) {
    super(
      `Spotify rate limit exceeded. Retry after ${retryAfter}s`,
      429,
      { retryAfter, remaining }
    );
    this.name = 'SpotifyRateLimitError';
    Object.setPrototypeOf(this, SpotifyRateLimitError.prototype);
  }
}

/**
 * Spotify authentication error
 */
export class SpotifyAuthError extends SpotifyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 401, details);
    this.name = 'SpotifyAuthError';
    Object.setPrototypeOf(this, SpotifyAuthError.prototype);
  }
}

/**
 * YouTube API errors
 */
export class YouTubeError extends AppError {
  constructor(
    message: string,
    public statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message, 'YOUTUBE_ERROR', statusCode, details);
    this.name = 'YouTubeError';
    Object.setPrototypeOf(this, YouTubeError.prototype);
  }
}

/**
 * YouTube rate limit error
 */
export class YouTubeRateLimitError extends YouTubeError {
  constructor(
    public retryAfter: number,
    public remaining: number = 0
  ) {
    super(
      `YouTube rate limit exceeded. Retry after ${retryAfter}s`,
      403,
      { retryAfter, remaining }
    );
    this.name = 'YouTubeRateLimitError';
    Object.setPrototypeOf(this, YouTubeRateLimitError.prototype);
  }
}

/**
 * YouTube authentication error
 */
export class YouTubeAuthError extends YouTubeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 401, details);
    this.name = 'YouTubeAuthError';
    Object.setPrototypeOf(this, YouTubeAuthError.prototype);
  }
}

/**
 * Sync operation errors
 */
export class SyncError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SYNC_ERROR', 500, details);
    this.name = 'SyncError';
    Object.setPrototypeOf(this, SyncError.prototype);
  }
}

/**
 * Track matching error
 */
export class MatchError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'MATCH_ERROR', 500, details);
    this.name = 'MatchError';
    Object.setPrototypeOf(this, MatchError.prototype);
  }
}

/**
 * Network/connectivity errors
 */
export class NetworkError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', 503, details);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
