# Spotify YouTube Music Sync

Automatically sync Spotify playlists to YouTube Music using intelligent track matching with fuzzy matching support.

## Overview

Spotify YouTube Sync is a Node.js application that synchronizes your Spotify playlists to YouTube. It:

- Fetches tracks from Spotify playlists
- Searches for matching videos on YouTube
- Uses intelligent matching (exact + fuzzy) to find the right videos
- Creates YouTube playlists and adds matched videos
- Prevents duplicates automatically
- Logs all operations for debugging
- Supports automated scheduling with cron

## Features

### ✅ Core Features

- **Spotify Integration**: Full API support for playlists and tracks
- **YouTube Integration**: Search, create playlists, add videos
- **Intelligent Matching**:
  - Exact match: Direct string comparison
  - Fuzzy match: Uses string similarity with configurable threshold
  - Best match selection from multiple candidates
- **Duplicate Prevention**: Checks existing playlists before adding
- **Error Handling**: Comprehensive error classes and recovery
- **Logging**: File-based logs with multiple levels
- **Scheduling**: Automated sync with node-cron
- **CLI Interface**: Easy-to-use command-line tools

### 🎯 Matching Algorithm

The sync service uses a 2-stage matching process:

1. **Exact Match** (highest priority)
   - Normalizes track names and artist names
   - Removes special characters and extra spaces
   - Case-insensitive comparison
   - Returns immediately if found

2. **Fuzzy Match** (fallback)
   - Uses string-similarity library for scoring
   - Configurable threshold (default: 0.85)
   - Finds best match from search results
   - Scores between 0-1 (higher = better match)

### 📊 Comprehensive Logging

Logs are stored in `logs/` directory:

- **app.log**: General application logs (info, debug)
- **error.log**: Error messages and stack traces
- **debug.log**: Detailed debug information
- **unmatched.jsonl**: Tracks that couldn't be matched (JSONL format)
- **sync-reports.jsonl**: Detailed sync reports (JSONL format)

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js 18+
- **APIs**: Spotify Web API, YouTube Data API v3
- **HTTP Client**: axios
- **Validation**: Zod
- **Scheduling**: node-cron
- **CLI**: Commander.js
- **Matching**: string-similarity
- **Logging**: File-based

## Installation

### 1. Clone and Install

```bash
git clone <repository>
cd spotify-yt-sync
npm install
```

### 2. Setup Environment Variables

```bash
cp .env.example .env
```

### 3. Get Spotify Credentials

1. Visit [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create an app to get `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
3. Run helper script:

```bash
npm run get-spotify-token
```

4. Authorize in your browser and copy the refresh token to `.env`

### 4. Get YouTube API Key

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable "YouTube Data API v3"
4. Create an API key in Credentials
5. Add to `.env`:

```
YOUTUBE_API_KEY=your_key_here
```

### 5. Configure Playlists

Add Spotify playlist IDs to `.env`:

```env
PLAYLIST_IDS=playlist_id_1,playlist_id_2,playlist_id_3
```

## Usage

### Validate Configuration

Test all credentials and connections:

```bash
npm run validate
```

### Sync Single Playlist

```bash
npm run sync <playlist_id>
# Example: npm run sync 37i9dQZF1DX4UtSsGT1Sbe
```

Optionally specify target YouTube playlist:

```bash
npm run sync <spotify_id> --youtube <youtube_id>
```

### Sync All Configured Playlists

```bash
npm run sync-all
```

### Start Automatic Scheduler

```bash
npm run schedule
```

This runs indefinitely, syncing according to `SYNC_SCHEDULE` cron expression.

### View Configuration

```bash
npm run config
```

## Configuration

### Environment Variables

```env
# Spotify (required)
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REFRESH_TOKEN=your_refresh_token

# YouTube (required)
YOUTUBE_API_KEY=your_api_key

# Sync settings
SYNC_ENABLED=true
SYNC_SCHEDULE=0 */6 * * *              # Cron: every 6 hours
PLAYLIST_IDS=id1,id2,id3               # Comma-separated

# Matching (tuning)
USE_FUZZY_MATCHING=true                # Enable fuzzy matching
FUZZY_MATCH_THRESHOLD=0.85             # 0-1 scale (0.85 = default)

# Logging
LOG_LEVEL=info                         # debug | info | warn | error
LOGS_DIR=./logs

# Environment
NODE_ENV=production
```

### Fuzzy Matching Thresholds

The fuzzy matching threshold controls how strict the matching is:

- **0.95+**: Very strict, only matches very similar strings
- **0.85**: Balanced (default), catches variations in spacing/punctuation
- **0.75**: Lenient, higher false positive rate
- **< 0.75**: Very lenient, likely to mismatch

Start with 0.85 and adjust based on your results.

### Cron Schedule Examples

```bash
0 */6 * * *      # Every 6 hours
0 0 * * *        # Daily at midnight
0 9 * * 1-5      # Weekdays at 9 AM
*/30 * * * *     # Every 30 minutes
0 12 * * 0       # Sundays at noon
```

## Project Structure

```
spotify-yt-sync/
├── src/
│   ├── config/
│   │   ├── env.ts           # Environment validation (Zod)
│   │   ├── logger.ts        # File-based logging
│   │   └── scheduler.ts     # Cron job scheduling
│   ├── services/
│   │   ├── spotify.service.ts   # Spotify API client
│   │   ├── youtube.service.ts   # YouTube API client
│   │   └── sync.service.ts      # Main sync orchestration
│   ├── utils/
│   │   ├── errors.ts        # Custom error classes
│   │   └── matcher.ts       # Track matching logic
│   ├── types/
│   │   └── index.ts         # TypeScript interfaces
│   └── index.ts             # CLI entry point
├── .env.example             # Environment template
├── .gitignore
├── get-spotify-token.js     # Spotify auth helper
├── get-youtube-token.js     # YouTube setup guide
├── package.json
├── tsconfig.json
├── README.md
└── QUICKSTART.md
```

## API Services

### SpotifyService

Handles all Spotify API interactions:

```typescript
// Get playlist
const playlist = await spotifyService.getPlaylist(playlistId);

// Get all tracks (handles pagination)
const tracks = await spotifyService.getPlaylistTracks(playlistId);

// Search for tracks
const results = await spotifyService.searchTrack(query);

// Validate token
const valid = await spotifyService.validateToken();
```

### YouTubeService

Handles all YouTube API interactions:

```typescript
// Search for videos
const videos = await youtubeService.searchVideos(query);

// Create playlist
const playlist = await youtubeService.createPlaylist(title);

// Add video to playlist
await youtubeService.addVideoToPlaylist(playlistId, videoId);

// Check for duplicates
const exists = await youtubeService.videoExistsInPlaylist(playlistId, videoId);
```

### SyncService

Orchestrates the sync process:

```typescript
// Sync single playlist
const report = await syncService.syncPlaylist(playlistId);

// Sync multiple playlists
const reports = await syncService.syncPlaylists(playlistIds);

// Get statistics
const stats = syncService.getSyncStats(reports);
```

## Error Handling

Custom error classes for different scenarios:

- **AppError**: Base error class
- **ConfigError**: Configuration validation failures
- **SpotifyError**: Spotify API errors
- **SpotifyRateLimitError**: Rate limiting from Spotify
- **SpotifyAuthError**: Authentication failures
- **YouTubeError**: YouTube API errors
- **YouTubeRateLimitError**: Rate limiting from YouTube
- **SyncError**: Sync operation failures
- **MatchError**: Track matching failures
- **NetworkError**: Network connectivity issues
- **ValidationError**: Input validation failures

## Logging Examples

### Sync Report (sync-reports.jsonl)

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "playlistName": "Workout Mix",
  "playlistId": "37i9dQZF1DX4UtSsGT1Sbe",
  "totalTracks": 50,
  "successfulMatches": 48,
  "fuzzyMatches": 12,
  "exactMatches": 36,
  "unmatchedCount": 2,
  "addedToYouTube": 46,
  "duplicatesSkipped": 2,
  "errors": 0,
  "duration_ms": 125430
}
```

### Unmatched Tracks (unmatched.jsonl)

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "spotifyId": "7qiZfU4dY1lsylvNPPA8uP",
  "trackName": "Obscure Remix",
  "artistName": "Unknown Artist",
  "reason": "No suitable match found"
}
```

## Deployment

### Local Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm run start
```

Or with PM2:

```bash
npm install -g pm2
pm2 start dist/index.js --name spotify-yt-sync
pm2 save
pm2 startup
```

### Docker (Optional)

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
CMD ["npm", "run", "start"]
```

Build and run:

```bash
docker build -t spotify-yt-sync .
docker run -d --env-file .env spotify-yt-sync
```

## Performance Considerations

- **API Rate Limits**: Spotify (429 handling), YouTube (quota-aware)
- **Pagination**: Handles large playlists (50 tracks per request)
- **Caching**: Refresh tokens cached in memory
- **Network**: 10-second timeout on all requests
- **Logging**: Async file writes don't block execution

## Troubleshooting

### Rate Limiting

If you hit rate limits:
1. Check logs for retry-after information
2. Sync will automatically pause and retry
3. Adjust SYNC_SCHEDULE to space out syncs more

### Unmatched Tracks

Review `logs/unmatched.jsonl`:
1. Adjust FUZZY_MATCH_THRESHOLD lower for more lenient matching
2. Check if track names are correct in Spotify
3. Manually add videos to YouTube playlist

### API Quota Issues

Monitor usage in [Google Cloud Console](https://console.cloud.google.com/) APIs → Quotas

### Authentication Errors

1. Verify SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET
2. Verify YOUTUBE_API_KEY is valid
3. Re-run `npm run get-spotify-token` to refresh token
4. Check token hasn't expired

## Contributing

Contributions welcome! Areas for improvement:

- Additional matching strategies
- User authentication/dashboard
- Playlist filtering and categorization
- Webhook notifications
- Database storage for sync history
- Performance optimizations

## License

MIT

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review error messages in console
3. Run `npm run validate` to test setup
4. Check QUICKSTART.md for common issues

## Roadmap

- [ ] User dashboard/UI
- [ ] Playlist filters (genre, artist)
- [ ] Webhook notifications
- [ ] Database persistence
- [ ] Sync history/analytics
- [ ] Bidirectional sync
- [ ] Additional playlist sources
- [ ] Performance benchmarking

---

**Built with TypeScript, Node.js, and ❤️**
