/**
 * Model Setup and Initialization
 * Handles local (Gemini Nano) and remote (Gemini API) model setup
 */

import { builtInAI } from '@built-in-ai/core';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateId } from 'ai';
import { createLogger } from '~logger';
import { getGoogleApiKey } from '@/utils/credentials';
import { APIError, ErrorType } from '../../errors/errorTypes';

// Helper function for compatibility
async function validateAndGetApiKey(): Promise<string> {
  const apiKey = await getGoogleApiKey();
  if (!apiKey) {
    throw new APIError({
      message: 'No API key configured',
      statusCode: 401,
      retryable: false,
      userMessage: 'Please configure your Google AI API key in settings.',
      technicalDetails: 'No API key found in storage',
      errorCode: ErrorType.API_AUTH_FAILED,
    });
  }
  return apiKey;
}
import {
  downloadLanguageModel,
  downloadSummarizer,
  type DownloadProgressEvent,
} from '../models/downloader';
import { BrowserAPIError } from '../../errors/errorTypes';
import { writeErrorToStream, writeDownloadProgressToStream } from '../stream/streamHelpers'; const log = createLogger('ModelSetup', 'AI_CHAT');

export interface LocalModelSetup {
  model: any;
  success: boolean;
  error?: Error;
}

export interface RemoteModelSetup {
  model: any;
  success: boolean;
}

/**
 * Setup local Gemini Nano model with progress tracking
 */
export async function setupLocalModel(
  writer: any,
  onError?: (error: Error) => void
): Promise<LocalModelSetup> {
  log.info('🔧 Using LOCAL Gemini Nano');

  try {
    // Download Language Model with progress tracking
    await downloadLanguageModel((progress: DownloadProgressEvent) => {
      const percentage = Math.round(progress.loaded * 100);
      log.info(`📥 Language Model download: ${percentage}%`);
      writeDownloadProgressToStream(writer, 'language', percentage);
    });

    log.info('✅ Language Model ready');

    // Download Summarizer Model with progress tracking (optional)
    try {
      await downloadSummarizer((progress: DownloadProgressEvent) => {
        const percentage = Math.round(progress.loaded * 100);
        log.info(`📥 Summarizer download: ${percentage}%`);
        writeDownloadProgressToStream(writer, 'summarizer', percentage);
      });

      log.info('✅ Summarizer ready');
    } catch (error) {
      // Summarizer is optional, just log warning
      log.warn('⚠️ Summarizer unavailable:', error);
    }

    // Get local model
    const model = builtInAI();

    return { model, success: true };
  } catch (error) {
    log.error('❌ Failed to download Language Model:', error);

    // Check if it's our storage error
    if (error instanceof BrowserAPIError &&
      error.errorCode === ErrorType.BROWSER_AI_MODEL_STORAGE_ERROR) {
      // Write storage error to chat stream
      writeErrorToStream(writer, error, 'Model download - insufficient storage');

      // Call onError callback to potentially show toast
      onError?.(error);

      return { model: null, success: false, error: error as Error };
    }

    // For other errors, wrap in generic error message
    const genericError = new Error(
      `Language Model unavailable: ${error instanceof Error ? error.message : String(error)}`
    );
    return { model: null, success: false, error: genericError };
  }
}

/**
 * Setup remote Gemini API model
 */
export async function setupRemoteModel(modelName: string): Promise<RemoteModelSetup> {
  log.info('🌐 Using REMOTE model:', modelName);

  // Validate and get API key (throws APIError if invalid)
  const apiKey = await validateAndGetApiKey();

  // Custom fetch to remove referrer header (fixes 403 errors in Chrome extensions)
  const customFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    const newInit = { ...init };
    if (newInit.headers) {
      delete (newInit.headers as any).Referer;
    }
    return fetch(url, newInit);
  };

  // Initialize model
  const google = createGoogleGenerativeAI({ apiKey, fetch: customFetch });
  const model = google(modelName);

  return { model, success: true };
}

/**
 * Write missing API key error message to stream
 */
export function writeMissingApiKeyError(writer: any): void {
  const errorMsg = 'Please configure your Gemini API key to use the AI assistant.';
  const instructionMsg = '\n\n**How to add your API key:**\n1. Click the **⋯** (three dots) menu in the chat header\n2. Select "Gemini API Key Setup"\n3. Enter your Gemini API key\n4. Click "Save API Key"\n\n**Don\'t have an API key?**\nGet a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)';

  log.error('❌ Missing API key for remote mode');

  // Write error message to the stream
  writer.write({
    type: 'text-delta',
    id: 'api-key-error-' + generateId(),
    delta: `⚠️ **API Key Required**\n\n${errorMsg}${instructionMsg}`,
  });
}

