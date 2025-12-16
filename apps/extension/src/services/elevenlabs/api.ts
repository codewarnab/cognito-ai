/**
 * ElevenLabs API Service
 * Handles communication with Cloudflare Worker for signed URLs and voice data
 */

import { createLogger } from '~logger';
import { ENV } from '@/utils/env';

const log = createLogger('ElevenLabs-API', 'VOICE_CLIENT');

// Worker URL from environment variables (with fallback to default)
const WORKER_BASE_URL = ENV.ELEVENLABS_WORKER_URL;

// Timeout for API requests (10 seconds)
const API_TIMEOUT_MS = 10000;

export interface SignedUrlResponse {
  signedUrl: string;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

export interface VoicesResponse {
  voices: ElevenLabsVoice[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
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
 * Fetch signed URL from Cloudflare Worker
 */
export async function getSignedUrl(): Promise<string> {
  try {
    log.info('Fetching signed URL from worker...');

    const fetchPromise = fetch(`${WORKER_BASE_URL}/api/signed-url`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await Promise.race([
      fetchPromise,
      createTimeoutPromise<Response>(API_TIMEOUT_MS),
    ]);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get signed URL: ${response.status} - ${errorText}`);
    }

    const data: unknown = await response.json();

    // Validate response structure
    if (!data || typeof data !== 'object' || !('signedUrl' in data)) {
      throw new Error('Invalid response structure from signed URL endpoint');
    }

    const typedData = data as SignedUrlResponse;
    if (typeof typedData.signedUrl !== 'string' || !typedData.signedUrl) {
      throw new Error('Invalid signed URL in response');
    }

    log.info('Signed URL obtained successfully');
    return typedData.signedUrl;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to fetch signed URL', { error: errorMessage });
    throw new Error(`Failed to get signed URL: ${errorMessage}`);
  }
}


/**
 * Fetch available voices from Cloudflare Worker
 */
export async function getAvailableVoices(): Promise<ElevenLabsVoice[]> {
  try {
    log.info('Fetching available voices...');

    const fetchPromise = fetch(`${WORKER_BASE_URL}/api/voices`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await Promise.race([
      fetchPromise,
      createTimeoutPromise<Response>(API_TIMEOUT_MS),
    ]);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to fetch voices: ${response.status} - ${errorText}`);
    }

    const data: unknown = await response.json();

    // Validate response structure
    if (!data || typeof data !== 'object' || !('voices' in data)) {
      throw new Error('Invalid response structure from voices endpoint');
    }

    const typedData = data as VoicesResponse;
    if (!Array.isArray(typedData.voices)) {
      throw new Error('Invalid voices array in response');
    }

    log.info('Voices fetched successfully', { count: typedData.voices.length });
    return typedData.voices;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to fetch voices', { error: errorMessage });
    throw new Error(`Failed to fetch voices: ${errorMessage}`);
  }
}

/**
 * Check worker health status
 */
export async function checkWorkerHealth(): Promise<boolean> {
  try {
    log.debug('Checking worker health...');

    const fetchPromise = fetch(`${WORKER_BASE_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await Promise.race([
      fetchPromise,
      createTimeoutPromise<Response>(5000), // Shorter timeout for health check
    ]);

    if (!response.ok) {
      return false;
    }

    const data: unknown = await response.json();

    // Validate response structure
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return false;
    }

    const typedData = data as HealthResponse;
    return typedData.status === 'ok';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.warn('Worker health check failed', { error: errorMessage });
    return false;
  }
}
