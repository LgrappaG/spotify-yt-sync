#!/usr/bin/env node

/**
 * Helper script to obtain YouTube API key
 *
 * Usage:
 *   node get-youtube-token.js
 *
 * This script guides you through creating a YouTube API key.
 * Since YouTube uses API keys (not OAuth for most read operations),
 * this is a guide to help set up the API key.
 */

import open from 'open';

const instructions = `
╔════════════════════════════════════════════════════════════════════════╗
║          YouTube API Key Setup Instructions                            ║
╚════════════════════════════════════════════════════════════════════════╝

Follow these steps to obtain your YouTube API key:

1. Go to Google Cloud Console: https://console.cloud.google.com/

2. Create a new project:
   - Click "Select a Project" at the top
   - Click "NEW PROJECT"
   - Enter a project name (e.g., "Spotify YouTube Sync")
   - Click "CREATE"

3. Enable YouTube Data API v3:
   - In the search bar, search for "YouTube Data API v3"
   - Click on "YouTube Data API v3"
   - Click the "ENABLE" button

4. Create credentials:
   - Click "Create Credentials" button
   - Choose "API Key"
   - A modal will appear with your API key
   - Copy the API key

5. Add to .env file:
   YOUTUBE_API_KEY=your_api_key_here

6. (Optional) Set up OAuth for playlist creation:
   - If you want to create playlists, you'll need OAuth credentials
   - In the "Credentials" section, click "Create Credentials"
   - Choose "OAuth client ID"
   - Select "Web application"
   - Set Authorized redirect URIs to: http://localhost:3000/youtube/callback
   - Copy the Client ID and Client Secret

IMPORTANT NOTES:
- API keys have quota limits (10,000 requests/day by default)
- For playlist creation, you need OAuth credentials
- Never commit your API key to version control
- Rotate your API key regularly for security

Press Enter to open the Google Cloud Console...
`;

console.log(instructions);

// Wait for user input
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('', async () => {
  try {
    await open('https://console.cloud.google.com/');
    console.log('\nGoogle Cloud Console opened in your browser.');
    console.log('Follow the steps above to get your API key.\n');
  } catch (error) {
    console.log('\nCould not open browser. Please visit:');
    console.log('https://console.cloud.google.com/\n');
  }

  rl.close();
});
