import { z } from 'zod';
import { ConfigError } from '../utils/errors.js';

const envSchema = z.object({
  // Spotify Configuration
  SPOTIFY_CLIENT_ID: z.string().min(1, 'SPOTIFY_CLIENT_ID is required'),
  SPOTIFY_CLIENT_SECRET: z.string().min(1, 'SPOTIFY_CLIENT_SECRET is required'),
  SPOTIFY_REDIRECT_URI: z.string().url('SPOTIFY_REDIRECT_URI must be a valid URL'),
  SPOTIFY_REFRESH_TOKEN: z.string().min(1, 'SPOTIFY_REFRESH_TOKEN is required'),

  // YouTube Configuration
  YOUTUBE_API_KEY: z.string().min(1, 'YOUTUBE_API_KEY is required'),

  // Sync Configuration
  SYNC_ENABLED: z.enum(['true', 'false']).default('true'),
  SYNC_SCHEDULE: z.string().default('0 */6 * * *'), // Every 6 hours
  PLAYLIST_IDS: z.string().default(''), // Comma-separated list

  // Matching Configuration
  USE_FUZZY_MATCHING: z.enum(['true', 'false']).default('true'),
  FUZZY_MATCH_THRESHOLD: z
    .string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().min(0).max(1))
    .default('0.75'),

  // Logging Configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOGS_DIR: z.string().default('./logs'),

  // Node environment
  NODE_ENV: z.enum(['development', 'production']).default('development'),
});

type EnvVars = z.infer<typeof envSchema>;

let cachedConfig: EnvVars | null = null;

/**
 * Validates and returns environment variables
 */
export function validateEnv(): EnvVars {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      const errors = result.error.flatten();
      throw new ConfigError(
        `Invalid environment variables: ${JSON.stringify(errors)}`,
        { errors: errors.fieldErrors }
      );
    }

    cachedConfig = result.data;
    return result.data;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(
      `Failed to validate environment variables: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Gets the parsed configuration object
 */
export function getConfig() {
  const env = validateEnv();

  return {
    spotify: {
      clientId: env.SPOTIFY_CLIENT_ID,
      clientSecret: env.SPOTIFY_CLIENT_SECRET,
      redirectUri: env.SPOTIFY_REDIRECT_URI,
      refreshToken: env.SPOTIFY_REFRESH_TOKEN,
    },
    youtube: {
      apiKey: env.YOUTUBE_API_KEY,
    },
    sync: {
      enabled: env.SYNC_ENABLED === 'true',
      schedule: env.SYNC_SCHEDULE,
      playlistIds: env.PLAYLIST_IDS
        ? env.PLAYLIST_IDS.split(',').map((id) => id.trim())
        : [],
      useFuzzyMatching: env.USE_FUZZY_MATCHING === 'true',
      fuzzyMatchThreshold: env.FUZZY_MATCH_THRESHOLD,
    },
    logging: {
      level: env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
      logsDir: env.LOGS_DIR,
    },
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
  };
}

/**
 * Clears cached configuration (useful for testing)
 */
export function clearCache(): void {
  cachedConfig = null;
}
