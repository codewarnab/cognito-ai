require('dotenv').config();

const axios = require('axios');
const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const TranscriptAPI = require('youtube-transcript-api');
const he = require('he');

const app = express();
app.use(cors());

// Increase the limit for JSON body parsing
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  console.log('Request size:', req.headers['content-length']);
  next();
});

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const referer = req.headers['referer'] || 'None';

  console.log(`Endpoint Hit: ${req.method} ${req.originalUrl} - IP: ${ip} - UA: ${userAgent} - Ref: ${referer} - ${new Date().toISOString()}`);

  next();
});

/**
 * GET /health
 * A simple health check endpoint to verify that the service is running.
 * 
 * Response:
 *   200: 'OK' message indicating the server is operational.
 */
app.get('/health', (req, res) => {
  res.send('OK');
});

/**
 * GET /debug
 * Provides debug information, including the client's IP and the server's region.
 * Useful for debugging and monitoring.
 * 
 * Response:
 *   200: JSON object with `ip` and `region`.
 */
app.get('/debug', (req, res) => {
  res.json({
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    region: process.env.VERCEL_REGION || 'local',
  });
});

// Helper to parse transcript XML
function parseTranscriptXml(xml) {
  return xml
    .replace('<?xml version="1.0" encoding="utf-8" ?><transcript>', '')
    .replace('</transcript>', '')
    .split('</text>')
    .filter(line => line.trim())
    .map(line => {
      const start = line.match(/start="([\d.]+)"/)[1];
      const dur = line.match(/dur="([\d.]+)"/)[1];
      let txt = line.replace(/<text.+?>/, '').replace(/<\/?[^>]+(>|$)/g, '');
      txt = he.decode(txt.replace(/&amp;/g, '&'));
      return { start, dur, text: txt };
    });
}

// Helper to fetch transcript
async function fetchTranscript(videoID, language) {
  // Try the easy library first
  try {
    const raw = await TranscriptAPI.getTranscript(videoID, language);
    if (!raw.length) throw new Error('empty');
    return raw.map(({ text, start, duration }) => ({ text, start, dur: duration }));
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (!/video unavailable|captions disabled|empty/.test(msg)) {
      throw err;
    }
    console.warn(' TranscriptAPI failed, falling back to manual scrape:', err.message);
  }

  // Fallback: scrape YouTube's signed URL
  const info = await ytdl.getBasicInfo(`https://youtube.com/watch?v=${videoID}`);
  const tracks = info.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (!tracks.length) {
    throw new Error('No captionTracks available to scrape.');
  }

  const track = tracks.find(t => t.languageCode === language) || tracks[0];
  const url = track.baseUrl;

  const { data: xml } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.youtube.com/',
    }
  });

  const lines = parseTranscriptXml(xml);
  if (!lines.length) {
    throw new Error('Manual scrape returned empty transcript.');
  }
  return lines;
}

/**
 * POST /simple-transcript
 * Returns only the video title and a concatenated string of subtitles in the first available language.
 * 
 * Request Body:
 *   url (string): The URL of the YouTube video.
 * 
 * Response:
 *   200: JSON object containing `duration`, `title`, and `transcript`.
 *   404: No captions available for this video.
 *   500: Error fetching the transcript.
 */
app.post('/simple-transcript', async (req, res) => {
  try {
    const { url } = req.body;

    const videoID = ytdl.getURLVideoID(url);
    const videoInfo = await ytdl.getBasicInfo(url);
    const duration = Math.floor(videoInfo.videoDetails.lengthSeconds / 60);

    const captionTracks = videoInfo.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      return res.status(404).json({ message: 'No captions available for this video.' });
    }

    const languageCode = captionTracks[0].languageCode;
    const lines = await fetchTranscript(videoID, languageCode);

    if (!lines || lines.length === 0) {
      throw new Error(`No captions available in the selected language (${languageCode}).`);
    }

    const transcriptText = lines.map(item => item.text).join(' ');

    const response = {
      duration: duration,
      title: videoInfo.videoDetails.title,
      transcript: transcriptText
    };

    res.json(response);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'An error occurred while fetching the simple transcript.' });
  }
});

// Export the Express app for Vercel serverless
module.exports = app;

// Only start the server when running locally (not on Vercel)
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
    console.log('Server started at:', new Date().toISOString());
  });
}
