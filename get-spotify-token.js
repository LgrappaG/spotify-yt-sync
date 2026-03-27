#!/usr/bin/env node

/**
 * Helper script to obtain Spotify refresh token
 *
 * Usage:
 *   node get-spotify-token.js
 *
 * This script will:
 * 1. Open your browser to Spotify authorization page
 * 2. You authorize the app
 * 3. Spotify redirects to your redirect URI with an authorization code
 * 4. This script exchanges the code for a refresh token
 * 5. Copy the refresh token to your .env file
 */

import express from 'express';
import axios from 'axios';
import open from 'open';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const scopes = [
  'playlist-read-private',
  'playlist-read-collaborative',
].join('%20');

const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scopes}`;

const app = express();
let server;

app.get('/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    res.status(400).send('No authorization code received');
    return;
  }

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        code: code.toString(),
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const refreshToken = response.data.refresh_token;

    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Success!</h1>
          <p>Your Spotify refresh token:</p>
          <code style="background: #f0f0f0; padding: 10px; display: block; word-break: break-all;">
            ${refreshToken}
          </code>
          <p>Add this to your .env file as:</p>
          <code style="background: #f0f0f0; padding: 10px; display: block;">
            SPOTIFY_REFRESH_TOKEN=${refreshToken}
          </code>
          <p>You can close this window.</p>
        </body>
      </html>
    `);

    console.log('\n✓ Refresh token obtained successfully!\n');
    console.log('Add this to your .env file:');
    console.log(`SPOTIFY_REFRESH_TOKEN=${refreshToken}\n`);

    // Close the server after a short delay to ensure response is sent
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 1000);
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    res.status(500).send('Error obtaining token');
    process.exit(1);
  }
});

server = app.listen(3000, async () => {
  console.log('Opening Spotify authorization page...\n');
  console.log(`If the browser doesn't open, visit:\n${authUrl}\n`);

  try {
    await open(authUrl);
  } catch (error) {
    console.log(`Could not automatically open browser. Please visit:\n${authUrl}`);
  }
});
