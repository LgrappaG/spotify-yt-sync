# Spotify YouTube Music Sync - Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Spotify account with playlists
- Google account for YouTube API access

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Environment File

```bash
cp .env.example .env
```

### 3. Get Spotify Credentials

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create an app and get `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
3. Run the token helper:

```bash
npm run get-spotify-token
```

4. This opens a browser for authorization. Approve it.
5. Copy the refresh token and add to `.env`:

```
SPOTIFY_CLIENT_ID=your_id
SPOTIFY_CLIENT_SECRET=your_secret
SPOTIFY_REFRESH_TOKEN=your_token
```

### 4. Get YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Search for "YouTube Data API v3" and enable it
4. Create an API key in Credentials
5. Add to `.env`:

```
YOUTUBE_API_KEY=your_key
```

### 5. Configure Playlists

Get your Spotify playlist IDs from URLs like:
```
spotify.com/playlist/[PLAYLIST_ID]
```

Add to `.env`:
```
PLAYLIST_IDS=id1,id2,id3
```

### 6. Test Everything

```bash
npm run validate
```

You should see:
```
✓ Spotify authenticated as: Your Name
✓ YouTube API key is valid
✓ All credentials validated successfully
```

## Usage

### Sync a Single Playlist

```bash
npm run sync <playlist_id>
```

### Sync All Configured Playlists

```bash
npm run sync-all
```

### Start Automatic Scheduler

```bash
npm run schedule
```

The scheduler runs on the schedule in your `.env` (default: every 6 hours)

### View Configuration

```bash
npm run config
```

## Logs

Logs are stored in the `logs/` directory:

- `app.log` - General application logs
- `error.log` - Error messages
- `debug.log` - Debug information
- `unmatched.jsonl` - Tracks that couldn't be matched
- `sync-reports.jsonl` - Sync operation reports

## Configuration Options

### Fuzzy Matching

Adjust how strictly tracks are matched:

```env
USE_FUZZY_MATCHING=true           # Enable fuzzy matching
FUZZY_MATCH_THRESHOLD=0.85        # 0-1 scale
```

Threshold recommendations:
- **0.95+**: Very strict (fewer false positives)
- **0.85**: Balanced (default, catches most variations)
- **0.75**: Lenient (more matches, higher false positives)

### Sync Schedule

Edit `SYNC_SCHEDULE` with cron format:

```env
SYNC_SCHEDULE=0 */6 * * *     # Every 6 hours
SYNC_SCHEDULE=0 0 * * *       # Daily at midnight
SYNC_SCHEDULE=0 9 * * 1-5     # Weekdays at 9 AM
```

## Troubleshooting

### Rate Limiting

If you hit rate limits, the sync will pause and retry. Check logs for details.

### Unmatched Tracks

View `logs/unmatched.jsonl` to see tracks that couldn't be matched to YouTube videos. You can:
1. Adjust `FUZZY_MATCH_THRESHOLD` to be more lenient
2. Manually add videos to the YouTube playlist
3. Fix track names in Spotify

### API Quota Issues

YouTube has daily quota limits (10,000 requests by default). Check your usage in [Google Cloud Console](https://console.cloud.google.com/)/APIs/quota.

### Debug Mode

```bash
LOG_LEVEL=debug npm run sync-all
```

This provides detailed logging for troubleshooting.

## Need Help?

1. Check logs in `logs/` directory
2. Run `npm run config` to verify settings
3. Run `npm run validate` to test credentials
4. Review error messages in console output

## Features

✅ **2-Stage Matching**: Exact match first, then fuzzy matching
✅ **Duplicate Prevention**: Won't add same video twice
✅ **Comprehensive Logging**: Track all sync operations
✅ **Automatic Scheduling**: Background syncing with cron
✅ **Rate Limit Handling**: Respects API quotas
✅ **Error Recovery**: Continues syncing on failures
✅ **Type Safe**: Full TypeScript implementation
✅ **CLI Commands**: Easy-to-use command interface

## Next Steps

1. Set up scheduled syncing: `npm run schedule`
2. Monitor logs: `tail -f logs/sync-reports.jsonl`
3. Adjust fuzzy threshold based on match quality
4. Create more YouTube playlists and sync multiple sources

Enjoy your synced playlists!
