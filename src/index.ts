#!/usr/bin/env node

import { program } from 'commander';
import dotenv from 'dotenv';
import { getConfig } from './config/env.js';
import { getLogger, initializeLogger } from './config/logger.js';
import { getScheduler } from './config/scheduler.js';
import { SpotifyService } from './services/spotify.service.js';
import { YouTubeService } from './services/youtube.service.js';
import { SyncService } from './services/sync.service.js';

// Load environment variables
dotenv.config();

// Initialize logger
initializeLogger();
const logger = getLogger();

// Parse CLI commands
program
  .name('spotify-yt-sync')
  .description('Sync Spotify playlists to YouTube Music')
  .version('1.0.0');

/**
 * Validates all API credentials
 */
program
  .command('validate')
  .description('Validate Spotify and YouTube API credentials')
  .action(async () => {
    try {
      logger.info('Validating API credentials...');

      const config = getConfig();

      // Validate Spotify
      const spotifyService = new SpotifyService(
        config.spotify.clientId,
        config.spotify.clientSecret,
        config.spotify.refreshToken
      );

      logger.info('Validating Spotify token...');
      const spotifyValid = await spotifyService.validateToken();
      if (spotifyValid) {
        const user = await spotifyService.getCurrentUser();
        logger.info(`✓ Spotify authenticated as: ${user.display_name}`);
      }

      // Validate YouTube
      const youtubeService = new YouTubeService(config.youtube.apiKey);
      logger.info('Validating YouTube API key...');
      const youtubeValid = await youtubeService.validateApiKey();
      if (youtubeValid) {
        logger.info('✓ YouTube API key is valid');
      }

      logger.info('✓ All credentials validated successfully');
      process.exit(0);
    } catch (error) {
      logger.error(
        'Validation failed',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

/**
 * Syncs a single playlist
 */
program
  .command('sync <playlistId>')
  .option('-y, --youtube <youtubePlaylistId>', 'YouTube playlist ID (optional)')
  .description('Sync a Spotify playlist to YouTube')
  .action(async (playlistId, options) => {
    try {
      const config = getConfig();

      const spotifyService = new SpotifyService(
        config.spotify.clientId,
        config.spotify.clientSecret,
        config.spotify.refreshToken
      );

      const youtubeService = new YouTubeService(config.youtube.apiKey);

      const syncService = new SyncService(spotifyService, youtubeService, {
        useFuzzyMatching: config.sync.useFuzzyMatching,
        fuzzyMatchThreshold: config.sync.fuzzyMatchThreshold,
      });

      logger.info(`Starting sync for playlist: ${playlistId}`);

      const report = await syncService.syncPlaylist(
        playlistId,
        options.youtube
      );

      logger.info('Sync report:', report);
      console.log('\n=== SYNC REPORT ===');
      console.log(`Playlist: ${report.playlistName}`);
      console.log(`Total tracks: ${report.totalTracks}`);
      console.log(`Successful matches: ${report.successfulMatches}`);
      console.log(`  - Exact matches: ${report.exactMatches}`);
      console.log(`  - Fuzzy matches: ${report.fuzzyMatches}`);
      console.log(`Unmatched tracks: ${report.unmatchedCount}`);
      console.log(`Added to YouTube: ${report.addedToYouTube}`);
      console.log(`Duplicates skipped: ${report.duplicatesSkipped}`);
      console.log(`Errors: ${report.errors}`);
      console.log(`Duration: ${(report.duration_ms / 1000).toFixed(2)}s`);
      console.log(`Success rate: ${((report.successfulMatches / report.totalTracks) * 100).toFixed(2)}%`);
      console.log('===================\n');

      process.exit(0);
    } catch (error) {
      logger.error(
        'Sync failed',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

/**
 * Syncs multiple playlists from environment config
 */
program
  .command('sync-all')
  .description('Sync all configured playlists')
  .action(async () => {
    try {
      const config = getConfig();

      if (!config.sync.playlistIds || config.sync.playlistIds.length === 0) {
        logger.error('No playlist IDs configured in environment');
        process.exit(1);
      }

      const spotifyService = new SpotifyService(
        config.spotify.clientId,
        config.spotify.clientSecret,
        config.spotify.refreshToken
      );

      const youtubeService = new YouTubeService(config.youtube.apiKey);

      const syncService = new SyncService(spotifyService, youtubeService, {
        useFuzzyMatching: config.sync.useFuzzyMatching,
        fuzzyMatchThreshold: config.sync.fuzzyMatchThreshold,
      });

      logger.info(
        `Starting sync for ${config.sync.playlistIds.length} playlists`
      );

      const reports = await syncService.syncPlaylists(config.sync.playlistIds);
      const stats = syncService.getSyncStats(reports);

      console.log('\n=== SYNC SUMMARY ===');
      console.log(`Playlists synced: ${stats.totalPlaylists}`);
      console.log(`Total tracks: ${stats.totalTracks}`);
      console.log(`Total matches: ${stats.totalMatches}`);
      console.log(`Total errors: ${stats.totalErrors}`);
      console.log(`Overall success rate: ${stats.successRate}%`);
      console.log('====================\n');

      process.exit(0);
    } catch (error) {
      logger.error(
        'Sync failed',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

/**
 * Starts the scheduler for automated syncing
 */
program
  .command('schedule')
  .description('Start the scheduler for automated syncing')
  .action(async () => {
    try {
      const config = getConfig();

      if (!config.sync.enabled) {
        logger.error('Sync is disabled in configuration');
        process.exit(1);
      }

      const scheduler = getScheduler();

      const spotifyService = new SpotifyService(
        config.spotify.clientId,
        config.spotify.clientSecret,
        config.spotify.refreshToken
      );

      const youtubeService = new YouTubeService(config.youtube.apiKey);

      const syncService = new SyncService(spotifyService, youtubeService, {
        useFuzzyMatching: config.sync.useFuzzyMatching,
        fuzzyMatchThreshold: config.sync.fuzzyMatchThreshold,
      });

      // Schedule the sync task
      scheduler.schedule('spotify-yt-sync', config.sync.schedule, async () => {
        try {
          const reports = await syncService.syncPlaylists(
            config.sync.playlistIds
          );
          const stats = syncService.getSyncStats(reports);
          logger.info('Scheduled sync completed', stats);
        } catch (error) {
          logger.error(
            'Scheduled sync failed',
            error instanceof Error ? error.message : error
          );
        }
      });

      logger.info(
        `Scheduler started with schedule: ${config.sync.schedule}`
      );
      console.log(
        `\nScheduler running. Next sync will occur according to schedule: ${config.sync.schedule}`
      );
      console.log('Press Ctrl+C to stop.\n');

      // Keep the process running
      process.on('SIGINT', () => {
        logger.info('Shutting down scheduler');
        scheduler.stopAll();
        process.exit(0);
      });
    } catch (error) {
      logger.error(
        'Scheduler failed',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

/**
 * Shows configuration info
 */
program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    try {
      const config = getConfig();

      console.log('\n=== CONFIGURATION ===');
      console.log('Spotify:');
      console.log(`  Client ID: ${config.spotify.clientId.substring(0, 10)}...`);
      console.log(`  Redirect URI: ${config.spotify.redirectUri}`);
      console.log('\nYouTube:');
      console.log(
        `  API Key: ${config.youtube.apiKey.substring(0, 10)}...`
      );
      console.log('\nSync:');
      console.log(`  Enabled: ${config.sync.enabled}`);
      console.log(`  Schedule: ${config.sync.schedule}`);
      console.log(`  Playlists: ${config.sync.playlistIds.length}`);
      console.log(`  Fuzzy matching: ${config.sync.useFuzzyMatching}`);
      console.log(`  Fuzzy threshold: ${config.sync.fuzzyMatchThreshold}`);
      console.log('\nLogging:');
      console.log(`  Level: ${config.logging.level}`);
      console.log(`  Directory: ${config.logging.logsDir}`);
      console.log('====================\n');
    } catch (error) {
      logger.error(
        'Failed to load configuration',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

/**
 * Shows help information
 */
program.on('--help', () => {
  console.log('\n  Examples:');
  console.log('    $ spotify-yt-sync validate');
  console.log('    $ spotify-yt-sync sync <playlistId>');
  console.log('    $ spotify-yt-sync sync-all');
  console.log('    $ spotify-yt-sync schedule');
  console.log('    $ spotify-yt-sync config');
});

program.parse(process.argv);

// Show help if no command provided
if (process.argv.length < 3) {
  program.help();
}
