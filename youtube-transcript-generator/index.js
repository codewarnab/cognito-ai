require('dotenv').config();

const axios = require('axios');
const express = require('express');
const cors = require('cors');
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

// Supadata API configuration
const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY;
const SUPADATA_BASE_URL = 'https://api.supadata.ai/v1';

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
 * Extract YouTube video ID from various URL formats
 * @param {string} url - YouTube URL
 * @returns {string|null} - Video ID or null
 */
function extractVideoId(url) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    
    // Standard YouTube URL: youtube.com/watch?v=ID
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
    
    // Short URL: youtu.be/ID
    if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.replace('/', '');
    }
    
    // Embedded URL: youtube.com/embed/ID
    if (urlObj.pathname.includes('/embed/')) {
      return urlObj.pathname.split('/embed/')[1]?.split('?')[0];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch video info from Supadata API
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<object|null>} - Video info or null
 */
async function fetchVideoInfo(videoId) {
  if (!SUPADATA_API_KEY) {
    console.warn('[VideoInfo] SUPADATA_API_KEY not configured');
    return null;
  }

  try {
    console.log('[VideoInfo] Fetching from Supadata for videoId:', videoId);
    
    const response = await axios.get(`${SUPADATA_BASE_URL}/youtube/video`, {
      params: { id: videoId },
      headers: {
        'x-api-key': SUPADATA_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const data = response.data;
    console.log('[VideoInfo] Supadata response received');

    return {
      title: data.title || 'Untitled Video',
      author: data.channel?.name || data.author || 'Unknown',
      thumbnail: data.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: typeof data.duration === 'number' ? data.duration : 0,
      description: data.description || '',
      tags: data.tags || data.keywords || []
    };
  } catch (error) {
    console.error('[VideoInfo] Supadata API error:', error.message);
    return null;
  }
}

/**
 * Fetch transcript from Supadata API
 * @param {string} videoId - YouTube video ID
 * @param {string} lang - Language code (default: 'en')
 * @returns {Promise<object|null>} - Transcript data or null
 */
async function fetchTranscriptFromSupadata(videoId, lang = 'en') {
  if (!SUPADATA_API_KEY) {
    console.warn('[Transcript] SUPADATA_API_KEY not configured');
    return null;
  }

  try {
    console.log('[Transcript] Fetching from Supadata for videoId:', videoId, 'lang:', lang);
    
    const response = await axios.get(`${SUPADATA_BASE_URL}/transcript`, {
      params: {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        lang: lang
      },
      headers: {
        'x-api-key': SUPADATA_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const data = response.data;
    
    // Check for errors in response
    if (data.error || !data.content) {
      console.warn('[Transcript] Supadata returned error or empty content:', data.error || 'No content');
      return null;
    }

    // Transform segments to consistent format
    const segments = Array.isArray(data.content) ? data.content.map(item => ({
      text: item.text || item.content || '',
      start: item.offset !== undefined ? item.offset / 1000 : (item.start || 0),
      duration: item.duration !== undefined ? item.duration / 1000 : 0
    })) : [];

    // Detect language from response or segments
    let detectedLanguage = lang;
    if (segments.length > 0 && segments[0].lang) {
      detectedLanguage = segments[0].lang;
    }

    console.log('[Transcript] Supadata returned', segments.length, 'segments');

    return {
      segments,
      language: detectedLanguage
    };
  } catch (error) {
    if (error.response?.status === 404) {
      console.warn('[Transcript] No transcript available (404)');
      return null;
    }
    console.error('[Transcript] Supadata API error:', error.message);
    return null;
  }
}

/**
 * GET /health
 * A simple health check endpoint to verify that the service is running.
 */
app.get('/health', (req, res) => {
  res.send('OK');
});

/**
 * GET /debug
 * Provides debug information, including the client's IP and the server's region.
 */
app.get('/debug', (req, res) => {
  res.json({
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    region: process.env.VERCEL_REGION || 'local',
    supadataConfigured: !!SUPADATA_API_KEY,
    redisConfigured: !!redis
  });
});

/**
 * POST /simple-transcript
 * Returns comprehensive video data including transcript and metadata.
 * 
 * Request Body:
 *   url (string): The URL of the YouTube video.
 *   disableCache (boolean, optional): Set to true to bypass cache read/write for debugging.
 *   lang (string, optional): Language code for transcript (default: 'en')
 * 
 * Response:
 *   200: JSON object containing all video data
 *   400: Invalid request (missing URL)
 *   404: No captions available for this video
 *   500: Error fetching the transcript
 */
app.post('/simple-transcript', async (req, res) => {
  try {
    const { url, disableCache, lang = 'en' } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required in the request body.' });
    }

    console.log('[Transcript] Processing URL:', url);
    console.log('[Transcript] Cache disabled:', disableCache === true);
    console.log('[Transcript] Language:', lang);

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ message: 'Invalid YouTube URL.' });
    }
    console.log('[Transcript] Video ID:', videoId);

    // Check cache first if Redis is available and cache is not disabled
    const cacheKey = `yt:v2:${videoId}:${lang}`;
    const useCacheRead = redis && disableCache !== true;
    
    if (useCacheRead) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log('[Transcript] Cache hit for videoID:', videoId);
          // Parse if string, otherwise use as-is
          const cachedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
          return res.json(cachedData);
        }
        console.log('[Transcript] Cache miss for videoID:', videoId);
      } catch (cacheError) {
        console.warn('[Transcript] Cache read error:', cacheError.message);
      }
    } else if (disableCache === true) {
      console.log('[Transcript] Skipping cache read (disableCache=true)');
    }

    // Fetch video info and transcript in parallel from Supadata
    const [videoInfo, transcriptData] = await Promise.all([
      fetchVideoInfo(videoId),
      fetchTranscriptFromSupadata(videoId, lang)
    ]);

    // Check if we got transcript data
    if (!transcriptData || !transcriptData.segments || transcriptData.segments.length === 0) {
      console.log('[Transcript] No transcript available');
      return res.status(404).json({
        message: 'No captions available for this video.',
        details: 'This video does not have any subtitles or closed captions.',
        videoId
      });
    }

    // Build concatenated transcript text
    const transcriptText = transcriptData.segments.map(s => s.text).join(' ');

    // Calculate duration from transcript if not available from video info
    let durationSeconds = videoInfo?.duration || 0;
    if (durationSeconds === 0 && transcriptData.segments.length > 0) {
      const lastSegment = transcriptData.segments[transcriptData.segments.length - 1];
      durationSeconds = Math.ceil(lastSegment.start + lastSegment.duration);
    }

    // Build comprehensive response
    const response = {
      // Video identification
      videoId,
      
      // Video metadata
      title: videoInfo?.title || 'Untitled Video',
      author: videoInfo?.author || 'Unknown',
      thumbnail: videoInfo?.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      description: videoInfo?.description || '',
      tags: videoInfo?.tags || [],
      
      // Duration in seconds (for backwards compat, also include minutes)
      duration: Math.floor(durationSeconds / 60), // minutes (legacy)
      durationSeconds, // seconds (new)
      
      // Transcript data
      transcript: transcriptText, // full concatenated text (legacy)
      segments: transcriptData.segments, // timestamped segments array (new)
      language: transcriptData.language || lang
    };

    console.log('[Transcript] Final response:', JSON.stringify({
      videoId: response.videoId,
      title: response.title,
      author: response.author,
      durationSeconds: response.durationSeconds,
      transcriptLength: response.transcript.length,
      segmentsCount: response.segments.length,
      language: response.language
    }));

    // Cache the response if Redis is available and cache is not disabled
    const useCacheWrite = redis && disableCache !== true;
    if (useCacheWrite) {
      try {
        // Cache for 24 hours (86400 seconds)
        await redis.set(cacheKey, JSON.stringify(response), { ex: 86400 });
        console.log('[Transcript] Cached response for videoID:', videoId);
      } catch (cacheError) {
        console.warn('[Transcript] Cache write error:', cacheError.message);
      }
    } else if (disableCache === true) {
      console.log('[Transcript] Skipping cache write (disableCache=true)');
    }

    console.log('[Transcript] Sending response to client');
    return res.json(response);

  } catch (error) {
    console.error('[Transcript] Error:', error);

    // Provide more detailed error messages
    let errorMessage = 'An error occurred while fetching the transcript.';
    let statusCode = 500;

    if (error.response?.status === 404) {
      errorMessage = 'No captions available for this video.';
      statusCode = 404;
    } else if (error.response?.status === 429) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      errorMessage = 'Request timed out. Please try again.';
      statusCode = 504;
    }

    const videoId = extractVideoId(req.body.url);
    res.status(statusCode).json({
      message: errorMessage,
      details: error.message,
      videoId: videoId || 'unknown'
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
    console.log('Supadata API configured:', !!SUPADATA_API_KEY);
  });
}
