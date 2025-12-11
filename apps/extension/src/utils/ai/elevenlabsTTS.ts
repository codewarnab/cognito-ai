/**
 * ElevenLabs Text-to-Speech Utility
 * Handles audio generation using ElevenLabs TTS API via Cloudflare Worker proxy
 * Supports true streaming playback - audio plays as chunks arrive
 */

import { createLogger } from '~logger';
import { getSelectedVoiceId, getVoiceSettings } from '@/services/elevenlabs';

const ttsLog = createLogger('ElevenLabsTTS', 'UTILS');

// Configuration - use same base URL as other ElevenLabs services
const WORKER_BASE_URL =
  process.env.PLASMO_PUBLIC_ELEVENLABS_WORKER_URL ||
  'https://elevenlabs-proxy.codewarnab.workers.dev';

// Timeout for TTS API requests (30 seconds - TTS can take time for long texts)
const API_TIMEOUT_MS = 30000;

// Default voice ID if none selected
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // George - a versatile male voice

interface TTSConfig {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  speed?: number;
}

interface CacheEntry {
  audioBuffer: ArrayBuffer;
  timestamp: number;
  textHash: string;
}

interface StreamingAudioResult {
  audio: HTMLAudioElement;
  /** Promise that resolves when streaming is complete (for caching) */
  complete: Promise<ArrayBuffer>;
  /** Abort the streaming request */
  abort: () => void;
}

// In-memory cache for generated audio
const audioCache = new Map<string, CacheEntry>();
const CACHE_MAX_SIZE = 50; // Maximum number of cached audio entries
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Generate a simple hash for text and voice to use as cache key
 */
function hashText(text: string, voiceId: string): string {
  const content = `elevenlabs:${text}:${voiceId}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Clean up expired cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  for (const [key, entry] of audioCache.entries()) {
    if (now - entry.timestamp > CACHE_EXPIRY_MS) {
      entriesToDelete.push(key);
    }
  }

  entriesToDelete.forEach(key => audioCache.delete(key));

  if (entriesToDelete.length > 0) {
    ttsLog.debug(`Cleaned up ${entriesToDelete.length} expired cache entries`);
  }
}

/**
 * Enforce cache size limit using LRU strategy
 */
function enforceCacheLimit(): void {
  if (audioCache.size <= CACHE_MAX_SIZE) return;

  // Sort by timestamp (oldest first)
  const entries = Array.from(audioCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);

  // Remove oldest entries until we're under the limit
  const toRemove = entries.slice(0, audioCache.size - CACHE_MAX_SIZE);
  toRemove.forEach(([key]) => audioCache.delete(key));

  ttsLog.debug(`Removed ${toRemove.length} old cache entries to enforce size limit`);
}

/**
 * Get cached audio if available
 */
function getCachedAudio(text: string, voiceId: string): ArrayBuffer | null {
  cleanupCache();

  const hash = hashText(text, voiceId);
  const entry = audioCache.get(hash);

  if (entry && Date.now() - entry.timestamp < CACHE_EXPIRY_MS) {
    ttsLog.debug(`Cache hit for ElevenLabs audio (${voiceId})`);
    return entry.audioBuffer;
  }

  return null;
}

/**
 * Store audio in cache
 */
function cacheAudio(text: string, voiceId: string, audioBuffer: ArrayBuffer): void {
  const hash = hashText(text, voiceId);

  audioCache.set(hash, {
    audioBuffer,
    timestamp: Date.now(),
    textHash: hash,
  });

  enforceCacheLimit();
  ttsLog.debug(`Cached ElevenLabs audio (cache size: ${audioCache.size})`);
}

/**
 * Clear all cached audio
 */
export function clearElevenLabsAudioCache(): void {
  audioCache.clear();
  ttsLog.debug('ElevenLabs audio cache cleared');
}

/**
 * Create a timeout promise for API requests
 */
function createTimeoutPromise<T>(ms: number): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
  });
}

/**
 * Get voice ID and settings for TTS request
 */
async function getVoiceConfig(config: TTSConfig): Promise<{
  voiceId: string;
  voiceSettings: Record<string, unknown>;
}> {
  // Get voice ID from config, saved settings, or use default
  let voiceId = config.voiceId;
  if (!voiceId) {
    try {
      voiceId = await getSelectedVoiceId() || DEFAULT_VOICE_ID;
    } catch {
      voiceId = DEFAULT_VOICE_ID;
    }
  }

  // Get voice settings from saved preferences or use config
  let voiceSettings;
  try {
    const savedSettings = await getVoiceSettings();
    voiceSettings = {
      stability: config.stability ?? savedSettings.stability,
      similarity_boost: config.similarityBoost ?? savedSettings.similarityBoost,
      style: config.style ?? 0,
      use_speaker_boost: config.useSpeakerBoost ?? true,
      speed: config.speed ?? savedSettings.speed,
    };
  } catch {
    voiceSettings = {
      stability: config.stability ?? 0.5,
      similarity_boost: config.similarityBoost ?? 0.75,
      style: config.style ?? 0,
      use_speaker_boost: config.useSpeakerBoost ?? true,
      speed: config.speed ?? 1.0,
    };
  }

  return { voiceId, voiceSettings };
}

/**
 * Stream audio from ElevenLabs and play immediately as chunks arrive
 * Uses MediaSource Extensions for true streaming playback
 * @param text - The text to convert to speech
 * @param config - Optional TTS configuration
 * @returns StreamingAudioResult with audio element, completion promise, and abort function
 */
export async function streamElevenLabsSpeech(
  text: string,
  config: TTSConfig = {}
): Promise<StreamingAudioResult> {
  if (!text) {
    throw new Error('Text is required');
  }

  const { voiceId, voiceSettings } = await getVoiceConfig(config);

  // Check cache first - if cached, return immediately playing audio
  const cachedAudio = getCachedAudio(text, voiceId);
  if (cachedAudio) {
    const audio = playElevenLabsAudioBuffer(cachedAudio);
    return {
      audio,
      complete: Promise.resolve(cachedAudio),
      abort: () => {
        audio.pause();
        audio.src = '';
      },
    };
  }

  ttsLog.debug('Starting streaming speech with ElevenLabs TTS', { voiceId });

  const abortController = new AbortController();
  const allChunks: Uint8Array[] = [];

  const requestBody = {
    text,
    voice_id: voiceId,
    model_id: config.modelId || 'eleven_multilingual_v2',
    voice_settings: voiceSettings,
  };

  // Create MediaSource for streaming playback
  const mediaSource = new MediaSource();
  const audio = new Audio();
  audio.src = URL.createObjectURL(mediaSource);

  const completePromise = new Promise<ArrayBuffer>((resolve, reject) => {
    mediaSource.addEventListener('sourceopen', async () => {
      try {
        // MP3 MIME type for MediaSource
        const mimeType = 'audio/mpeg';
        
        if (!MediaSource.isTypeSupported(mimeType)) {
          ttsLog.warn('MediaSource MP3 not supported, falling back to buffered playback');
          // Fallback to non-streaming
          const buffer = await generateElevenLabsSpeech(text, config);
          const fallbackAudio = playElevenLabsAudioBuffer(buffer);
          // Copy properties to our audio element
          audio.src = fallbackAudio.src;
          audio.play().catch(err => ttsLog.error('Fallback play error', { error: err?.message || 'Unknown' }));
          resolve(buffer);
          return;
        }

        const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
        let pendingChunks: Uint8Array[] = [];
        let isAppending = false;

        const appendNextChunk = () => {
          if (isAppending || pendingChunks.length === 0) return;
          if (sourceBuffer.updating) return;
          
          isAppending = true;
          const chunk = pendingChunks.shift();
          if (chunk) {
            try {
              sourceBuffer.appendBuffer(chunk);
            } catch (err) {
              ttsLog.error('Error appending buffer', { error: err instanceof Error ? err.message : 'Unknown' });
              isAppending = false;
            }
          }
        };

        sourceBuffer.addEventListener('updateend', () => {
          isAppending = false;
          appendNextChunk();
        });

        // Start fetching and streaming
        const fetchPromise = fetch(`${WORKER_BASE_URL}/api/text-to-speech`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
        });

        const response = await Promise.race([
          fetchPromise,
          createTimeoutPromise<Response>(API_TIMEOUT_MS),
        ]);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`ElevenLabs TTS error: ${response.status} - ${errorText}`);
        }

        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('application/json')) {
          const errorData = await response.json() as { error?: string };
          throw new Error(errorData.error || 'Unknown error from TTS API');
        }

        if (!response.body) {
          throw new Error('No response body for streaming');
        }

        const reader = response.body.getReader();
        let hasStartedPlaying = false;

        // Read and append chunks as they arrive
        const processStream = async () => {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Wait for all pending chunks to be appended
              while (pendingChunks.length > 0 || sourceBuffer.updating) {
                await new Promise(r => setTimeout(r, 50));
              }
              
              // End the stream
              if (mediaSource.readyState === 'open') {
                try {
                  mediaSource.endOfStream();
                } catch (err) {
                  ttsLog.debug('Error ending stream (may be normal)', { error: err instanceof Error ? err.message : 'Unknown' });
                }
              }
              break;
            }

            if (value) {
              allChunks.push(value);
              pendingChunks.push(value);
              appendNextChunk();

              // Start playing as soon as we have some data
              if (!hasStartedPlaying && allChunks.length >= 1) {
                hasStartedPlaying = true;
                audio.play().catch(err => {
                  ttsLog.error('Error starting playback', { error: err?.message || 'Unknown' });
                });
              }
            }
          }
        };

        await processStream();

        // Combine all chunks for caching
        const totalLength = allChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of allChunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        // Cache the complete audio
        cacheAudio(text, voiceId, combined.buffer);

        ttsLog.debug('Streaming complete', { totalBytes: totalLength });
        resolve(combined.buffer);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        ttsLog.error('Streaming error', { error: errorMessage });
        reject(new Error(`Failed to stream ElevenLabs speech: ${errorMessage}`));
      }
    });

    mediaSource.addEventListener('error', () => {
      reject(new Error('MediaSource error'));
    });
  });

  // Clean up URL when audio ends or errors
  const cleanup = () => {
    URL.revokeObjectURL(audio.src);
  };
  audio.addEventListener('ended', cleanup);
  audio.addEventListener('error', cleanup);

  return {
    audio,
    complete: completePromise,
    abort: () => {
      abortController.abort();
      audio.pause();
      cleanup();
    },
  };
}

/**
 * Generate audio from text using ElevenLabs TTS API via proxy (non-streaming)
 * Uses in-memory cache to avoid regenerating the same text
 * @param text - The text to convert to speech
 * @param config - Optional TTS configuration
 * @returns Audio buffer ready to play (MP3 format)
 */
export async function generateElevenLabsSpeech(
  text: string,
  config: TTSConfig = {}
): Promise<ArrayBuffer> {
  if (!text) {
    throw new Error('Text is required');
  }

  const { voiceId, voiceSettings } = await getVoiceConfig(config);

  // Check cache first
  const cachedAudio = getCachedAudio(text, voiceId);
  if (cachedAudio) {
    return cachedAudio;
  }

  try {
    ttsLog.debug('Generating speech with ElevenLabs TTS', { voiceId });

    const requestBody = {
      text,
      voice_id: voiceId,
      model_id: config.modelId || 'eleven_multilingual_v2',
      voice_settings: voiceSettings,
    };

    const fetchPromise = fetch(`${WORKER_BASE_URL}/api/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await Promise.race([
      fetchPromise,
      createTimeoutPromise<Response>(API_TIMEOUT_MS),
    ]);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`ElevenLabs TTS error: ${response.status} - ${errorText}`);
    }

    // Check if response is audio or error JSON
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      const errorData = await response.json() as { error?: string };
      throw new Error(errorData.error || 'Unknown error from TTS API');
    }

    const audioBuffer = await response.arrayBuffer();

    if (audioBuffer.byteLength === 0) {
      throw new Error('No audio data received from ElevenLabs TTS');
    }

    ttsLog.debug('ElevenLabs speech generation complete', { 
      byteLength: audioBuffer.byteLength 
    });

    // Cache the generated audio
    cacheAudio(text, voiceId, audioBuffer);

    return audioBuffer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    ttsLog.error('Failed to generate ElevenLabs speech', { error: errorMessage });
    throw new Error(`Failed to generate ElevenLabs speech: ${errorMessage}`);
  }
}

/**
 * Play audio buffer in the browser (MP3 format) - for cached/non-streaming playback
 * @param audioBuffer - The audio buffer to play
 * @returns Audio element for control (pause, stop, etc.)
 */
export function playElevenLabsAudioBuffer(audioBuffer: ArrayBuffer): HTMLAudioElement {
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  // Clean up URL when audio finishes
  audio.addEventListener('ended', () => {
    URL.revokeObjectURL(url);
  });

  audio.play().catch((error) => {
    ttsLog.error('Failed to play ElevenLabs audio:', error);
    URL.revokeObjectURL(url);
  });

  return audio;
}
