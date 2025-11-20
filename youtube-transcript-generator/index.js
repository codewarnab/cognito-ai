require('dotenv').config();

const axios = require('axios');
const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const TranscriptAPI = require('youtube-transcript-api');
const he = require('he');
const { Redis } = require('@upstash/redis');

const app = express();
app.use(cors());

// Increase the limit for JSON body parsing
app.use(express.json({ limit: '50mb' }));

// Initialize Upstash Redis client (optional - only if env vars are present)
let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('[Redis] Upstash Redis client initialized successfully');
  } catch (error) {
    console.error('[Redis] Failed to initialize Upstash Redis:', error.message);
  }
} else {
  console.log('[Redis] Upstash Redis not configured (missing environment variables)');
}

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
    console.log('[fetchTranscript] Trying TranscriptAPI for videoID:', videoID, 'language:', language);
    const raw = await TranscriptAPI.getTranscript(videoID, language);
    if (!raw.length) throw new Error('empty');
    console.log('[fetchTranscript] TranscriptAPI succeeded, got', raw.length, 'items');
    return raw.map(({ text, start, duration }) => ({ text, start, dur: duration }));
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (!/video unavailable|captions disabled|empty|transcript is disabled/i.test(msg)) {
      console.error('[fetchTranscript] TranscriptAPI error:', err.message);
      throw err;
    }
    console.warn('[fetchTranscript] TranscriptAPI failed, falling back to manual scrape:', err.message);
  }

  // Fallback: scrape YouTube's signed URL
  try {
    console.log('[fetchTranscript] Attempting manual scrape...');
    const info = await ytdl.getBasicInfo(`https://youtube.com/watch?v=${videoID}`);
    const tracks = info.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

    if (!tracks.length) {
      throw new Error('No captionTracks available to scrape.');
    }

    const track = tracks.find(t => t.languageCode === language) || tracks[0];
    const url = track.baseUrl;

    console.log('[fetchTranscript] Fetching from caption URL:', url.substring(0, 100) + '...');

    const { data: xml } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.youtube.com/',
        'Accept': 'text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,*/*;q=0.7'
      }
    });

    const lines = parseTranscriptXml(xml);
    if (!lines.length) {
      throw new Error('Manual scrape returned empty transcript.');
    }

    console.log('[fetchTranscript] Manual scrape succeeded, got', lines.length, 'items');
    return lines;
  } catch (scrapeError) {
    console.error('[fetchTranscript] Manual scrape failed:', scrapeError.message);
    throw scrapeError;
  }
}

/**
 * POST /simple-transcript
 * Returns only the video title and a concatenated string of subtitles in the first available language.
 * 
 * Request Body:
 *   url (string): The URL of the YouTube video.
 *   disableCache (boolean, optional): Set to true to bypass cache read/write for debugging.
 * 
 * Response:
 *   200: JSON object containing `duration`, `title`, and `transcript`.
 *   404: No captions available for this video.
 *   500: Error fetching the transcript.
 */
app.post('/simple-transcript', async (req, res) => {
  try {
    const { url, disableCache } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required in the request body.' });
    }

    console.log('[Transcript] Processing URL:', url);
    console.log('[Transcript] Cache disabled:', disableCache === true);

    const videoID = ytdl.getURLVideoID(url);
    console.log('[Transcript] Video ID:', videoID);

    // Check cache first if Redis is available and cache is not disabled
    const cacheKey = `yt:transcript:${videoID}`;
    const useCacheRead = redis && disableCache !== true;
    
    if (useCacheRead) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log('[Transcript] Cache hit for videoID:', videoID);
          console.log('[Transcript] Cached data:', JSON.stringify(cached, null, 2));
          return res.json(cached);
        }
        console.log('[Transcript] Cache miss for videoID:', videoID);
      } catch (cacheError) {
        console.warn('[Transcript] Cache read error:', cacheError.message);
        // Continue to fetch even if cache fails
      }
    } else if (disableCache === true) {
      console.log('[Transcript] Skipping cache read (disableCache=true)');
    }

    // Try to get transcript using TranscriptAPI first (more reliable)
    try {
      console.log('[Transcript] Attempting to fetch with TranscriptAPI...');
      const transcript = await TranscriptAPI.getTranscript(videoID);

      if (transcript && transcript.length > 0) {
        console.log('[Transcript] Successfully fetched with TranscriptAPI');

        // Get basic video info for title and duration
        let title = 'Unknown';
        let duration = 0;

        try {
          console.log('[Transcript] Fetching video info for title and duration...');
          const videoInfo = await ytdl.getBasicInfo(url);
          console.log('[Transcript] Video info fetched successfully');
          console.log('[Transcript] videoDetails object:', JSON.stringify(videoInfo.videoDetails, null, 2));
          
          title = videoInfo.videoDetails.title;
          duration = Math.floor(videoInfo.videoDetails.lengthSeconds / 60);
          
          console.log('[Transcript] Extracted title:', title);
          console.log('[Transcript] Extracted duration:', duration, 'minutes');
        } catch (infoError) {
          console.warn('[Transcript] Could not fetch video info, using defaults:', infoError.message);
          console.error('[Transcript] Full error:', infoError);
          // Calculate approximate duration from transcript
          const lastItem = transcript[transcript.length - 1];
          duration = Math.floor((lastItem.start + lastItem.duration) / 60);
          console.log('[Transcript] Calculated duration from transcript:', duration, 'minutes');
        }

        const transcriptText = transcript.map(item => item.text).join(' ');

        const response = {
          duration: duration,
          title: title,
          transcript: transcriptText
        };

        console.log('[Transcript] Final response object:', JSON.stringify({
          duration: response.duration,
          title: response.title,
          transcriptLength: response.transcript.length
        }));

        // Cache the response if Redis is available and cache is not disabled
        const useCacheWrite = redis && disableCache !== true;
        if (useCacheWrite) {
          try {
            await redis.set(cacheKey, JSON.stringify(response));
            console.log('[Transcript] Cached transcript for videoID:', videoID);
          } catch (cacheError) {
            console.warn('[Transcript] Cache write error:', cacheError.message);
            // Continue even if caching fails
          }
        } else if (disableCache === true) {
          console.log('[Transcript] Skipping cache write (disableCache=true)');
        }

        console.log('[Transcript] Sending response to client');
        return res.json(response);
      }
    } catch (apiError) {
      console.warn('[Transcript] TranscriptAPI failed:', apiError.message);
      // Continue to fallback method
    }

    // Fallback: Try ytdl-core method
    console.log('[Transcript] Attempting fallback with ytdl-core...');
    const videoInfo = await ytdl.getBasicInfo(url);
    console.log('[Transcript] Fallback - Video info fetched');
    console.log('[Transcript] Fallback - videoDetails:', JSON.stringify(videoInfo.videoDetails, null, 2));
    
    const duration = Math.floor(videoInfo.videoDetails.lengthSeconds / 60);
    const title = videoInfo.videoDetails.title;
    
    console.log('[Transcript] Fallback - Extracted title:', title);
    console.log('[Transcript] Fallback - Extracted duration:', duration, 'minutes');

    const captionTracks = videoInfo.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      console.log('[Transcript] No caption tracks found');
      return res.status(404).json({
        message: 'No captions available for this video.',
        details: 'This video does not have any subtitles or closed captions.'
      });
    }

    const languageCode = captionTracks[0].languageCode;
    console.log('[Transcript] Found caption track in language:', languageCode);

    const lines = await fetchTranscript(videoID, languageCode);

    if (!lines || lines.length === 0) {
      throw new Error(`No captions available in the selected language (${languageCode}).`);
    }

    const transcriptText = lines.map(item => item.text).join(' ');

    const response = {
      duration: duration,
      title: title,
      transcript: transcriptText
    };

    console.log('[Transcript] Fallback - Final response object:', JSON.stringify({
      duration: response.duration,
      title: response.title,
      transcriptLength: response.transcript.length
    }));

    // Cache the response if Redis is available and cache is not disabled
    const useCacheWrite = redis && disableCache !== true;
    if (useCacheWrite) {
      try {
        await redis.set(cacheKey, JSON.stringify(response));
        console.log('[Transcript] Cached transcript for videoID:', videoID);
      } catch (cacheError) {
        console.warn('[Transcript] Cache write error:', cacheError.message);
        // Continue even if caching fails
      }
    } else if (disableCache === true) {
      console.log('[Transcript] Skipping cache write (disableCache=true)');
    }

    console.log('[Transcript] Successfully fetched transcript, sending response');
    res.json(response);
  } catch (error) {
    console.error('[Transcript] Error:', error);

    // Provide more detailed error messages
    let errorMessage = 'An error occurred while fetching the simple transcript.';
    let statusCode = 500;

    if (error.message?.includes('410') || error.message?.includes('Status code: 410')) {
      errorMessage = 'YouTube blocked the request. This video may have restrictions or YouTube has updated their API.';
      statusCode = 503;
    } else if (error.message?.includes('Video unavailable')) {
      errorMessage = 'This video is unavailable or private.';
      statusCode = 404;
    } else if (error.message?.includes('Transcript is disabled')) {
      errorMessage = 'Transcripts are disabled for this video.';
      statusCode = 404;
    }

    res.status(statusCode).json({
      message: errorMessage,
      details: error.message,
      videoId: req.body.url ? ytdl.getURLVideoID(req.body.url) : 'unknown'
    });
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
