/**
 * Gemini Text-to-Speech Utility
 * Handles audio generation using Google's Gemini 2.5 Flash TTS model
 */

import { GoogleGenAI } from '@google/genai';
import { createLogger } from '~logger';

const ttsLog = createLogger('GeminiTTS', 'UTILS');

interface TTSConfig {
    temperature?: number;
    voiceName?: string;
}

interface CacheEntry {
    audioBuffer: ArrayBuffer;
    timestamp: number;
    textHash: string;
}

// In-memory cache for generated audio
const audioCache = new Map<string, CacheEntry>();
const CACHE_MAX_SIZE = 50; // Maximum number of cached audio entries
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Generate a simple hash for text to use as cache key
 */
function hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
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
function getCachedAudio(text: string): ArrayBuffer | null {
    cleanupCache();
    
    const hash = hashText(text);
    const entry = audioCache.get(hash);

    if (entry && Date.now() - entry.timestamp < CACHE_EXPIRY_MS) {
        ttsLog.debug('Cache hit for audio');
        return entry.audioBuffer;
    }

    return null;
}

/**
 * Store audio in cache
 */
function cacheAudio(text: string, audioBuffer: ArrayBuffer): void {
    const hash = hashText(text);
    
    audioCache.set(hash, {
        audioBuffer,
        timestamp: Date.now(),
        textHash: hash,
    });

    enforceCacheLimit();
    ttsLog.debug(`Cached audio (cache size: ${audioCache.size})`);
}

/**
 * Clear all cached audio
 */
export function clearAudioCache(): void {
    audioCache.clear();
    ttsLog.debug('Audio cache cleared');
}

/**
 * Generate audio from text using Gemini TTS API
 * Uses in-memory cache to avoid regenerating the same text
 * @param text - The text to convert to speech
 * @param apiKey - Gemini API key
 * @param config - Optional TTS configuration
 * @returns Audio buffer ready to play
 */
export async function generateSpeech(
    text: string,
    apiKey: string,
    config: TTSConfig = {}
): Promise<ArrayBuffer> {
    if (!text || !apiKey) {
        throw new Error('Text and API key are required');
    }

    // Check cache first
    const cachedAudio = getCachedAudio(text);
    if (cachedAudio) {
        return cachedAudio;
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const ttsConfig: any = {
            temperature: config.temperature ?? 1,
            responseModalities: ['audio'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: config.voiceName ?? 'Aoede',
                    },
                },
            },
        };

        const model = 'gemini-2.5-flash-preview-tts';
        const contents = [
            {
                role: 'user' as const,
                parts: [{ text }],
            },
        ];

        ttsLog.debug('Generating speech with Gemini TTS');

        const response = await ai.models.generateContentStream({
            model,
            config: ttsConfig,
            contents,
        });

        const audioChunks: Uint8Array[] = [];

        for await (const chunk of response) {
            if (!chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
                continue;
            }

            const inlineData = chunk.candidates[0].content.parts[0].inlineData;
            if (inlineData.data) {
                // Convert to WAV if needed
                if (inlineData.mimeType && !inlineData.mimeType.includes('wav')) {
                    audioChunks.push(convertToWav(inlineData.data, inlineData.mimeType));
                } else {
                    const buffer = Buffer.from(inlineData.data, 'base64');
                    const uint8Array = new Uint8Array(buffer.length);
                    for (let i = 0; i < buffer.length; i++) {
                        const byte = buffer[i];
                        if (byte !== undefined) {
                            uint8Array[i] = byte;
                        }
                    }
                    audioChunks.push(uint8Array);
                }
            }
        }

        if (audioChunks.length === 0) {
            throw new Error('No audio data received from Gemini TTS');
        }

        // Combine all chunks
        const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of audioChunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }

        ttsLog.debug('Speech generation complete');
        
        // Cache the generated audio
        cacheAudio(text, combined.buffer);
        
        return combined.buffer;
    } catch (error) {
        ttsLog.error('Failed to generate speech:', error);
        throw error;
    }
}

interface WavConversionOptions {
    numChannels: number;
    sampleRate: number;
    bitsPerSample: number;
}

function convertToWav(rawData: string, mimeType: string): Uint8Array {
    const options = parseMimeType(mimeType);
    const dataBuffer = Buffer.from(rawData, 'base64');
    const headerBuffer = createWavHeader(dataBuffer.length, options);
    
    // Combine header and data into Uint8Array
    const totalLength = headerBuffer.length + dataBuffer.length;
    const uint8Array = new Uint8Array(totalLength);
    
    // Copy header
    for (let i = 0; i < headerBuffer.length; i++) {
        const byte = headerBuffer[i];
        if (byte !== undefined) {
            uint8Array[i] = byte;
        }
    }
    
    // Copy data
    for (let i = 0; i < dataBuffer.length; i++) {
        const byte = dataBuffer[i];
        if (byte !== undefined) {
            uint8Array[headerBuffer.length + i] = byte;
        }
    }
    
    return uint8Array;
}

function parseMimeType(mimeType: string): WavConversionOptions {
    const [fileType, ...params] = mimeType.split(';').map((s) => s.trim());
    const parts = (fileType || '').split('/');
    const format = parts.length > 1 ? parts[1] : undefined;
    
    const options: WavConversionOptions = {
        numChannels: 1,
        sampleRate: 24000, // Default sample rate
        bitsPerSample: 16, // Default bits per sample
    };

    if (format && format.startsWith('L')) {
        const bits = parseInt(format.slice(1), 10);
        if (!isNaN(bits)) {
            options.bitsPerSample = bits;
        }
    }

    for (const param of params) {
        const [key, value] = param.split('=').map((s) => s.trim());
        if (key === 'rate' && value) {
            const rate = parseInt(value, 10);
            if (!isNaN(rate)) {
                options.sampleRate = rate;
            }
        }
    }

    return options;
}

function createWavHeader(dataLength: number, options: WavConversionOptions): Buffer {
    const { numChannels, sampleRate, bitsPerSample } = options;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const buffer = Buffer.alloc(44);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);

    return buffer;
}

/**
 * Play audio buffer in the browser
 * @param audioBuffer - The audio buffer to play
 * @returns Audio element for control (pause, stop, etc.)
 */
export function playAudioBuffer(audioBuffer: ArrayBuffer): HTMLAudioElement {
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    // Clean up URL when audio finishes
    audio.addEventListener('ended', () => {
        URL.revokeObjectURL(url);
    });

    audio.play().catch((error) => {
        ttsLog.error('Failed to play audio:', error);
        URL.revokeObjectURL(url);
    });

    return audio;
}
