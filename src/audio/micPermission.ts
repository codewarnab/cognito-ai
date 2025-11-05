/**
 * Microphone Permission Helper
 * Handles requesting and checking microphone access
 */

import { createLogger } from '../logger';

const log = createLogger('MicPermission');

export interface MicPermissionResult {
  granted: boolean;
  error?: string;
  errorType?: 'not-allowed' | 'not-found' | 'not-supported' | 'unknown';
}

/**
 * Request microphone permission from the user
 */
export async function requestMicrophonePermission(): Promise<MicPermissionResult> {
  try {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      log.warn('getUserMedia not supported');
      return {
        granted: false,
        error: 'Microphone access is not supported in this browser',
        errorType: 'not-supported',
      };
    }

    // Request microphone access
    log.info('Requesting microphone permission...');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Stop the stream immediately - we just needed permission
    stream.getTracks().forEach(track => track.stop());

    log.info('Microphone permission granted');
    return { granted: true };

  } catch (error: unknown) {
    log.error('Microphone permission error', error);

    const errorName = error instanceof DOMException ? error.name : undefined;
    const errorMessage = error instanceof Error ? error.message : 'Failed to access microphone';

    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      return {
        granted: false,
        error: 'Microphone access was denied. Please allow microphone access in your browser settings.',
        errorType: 'not-allowed',
      };
    }

    if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
      return {
        granted: false,
        error: 'No microphone found. Please connect a microphone and try again.',
        errorType: 'not-found',
      };
    }

    return {
      granted: false,
      error: errorMessage,
      errorType: 'unknown',
    };
  }
}

/**
 * Check if microphone permission is already granted
 */
export async function checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  try {
    // Check if Permissions API is available
    if (!navigator.permissions || !navigator.permissions.query) {
      log.warn('Permissions API not supported, will need to request directly');
      return 'prompt';
    }

    // Query microphone permission status
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    log.info('Microphone permission status:', result.state);

    return result.state as 'granted' | 'denied' | 'prompt';

  } catch (error) {
    log.warn('Could not check microphone permission', error);
    return 'prompt';
  }
}

/**
 * Open browser settings to enable microphone
 */
export function openMicrophoneSettings() {
  // In Chrome extensions, we can't directly open settings
  // But we can provide instructions to the user
  const instructions = `
To enable microphone access:

1. Click the lock icon (🔒) or site settings icon in the address bar
2. Find "Microphone" in the permissions list
3. Change it to "Allow"
4. Refresh the page or restart the extension

Alternatively:
- Go to chrome://settings/content/microphone
- Make sure microphone access is allowed for this extension
  `.trim();

  log.info('Microphone settings instructions:', instructions);
  return instructions;
}

/**
 * Request permission with user-friendly UI
 */
export async function requestMicrophoneWithUI(): Promise<MicPermissionResult> {
  // First check if already granted
  const status = await checkMicrophonePermission();

  if (status === 'granted') {
    log.info('Microphone permission already granted');
    return { granted: true };
  }

  if (status === 'denied') {
    log.warn('Microphone permission was previously denied');
    return {
      granted: false,
      error: 'Microphone access was previously denied. Please enable it in browser settings.',
      errorType: 'not-allowed',
    };
  }

  // Request permission
  return requestMicrophonePermission();
}

/**
 * Diagnose microphone access issues
 * Helpful for debugging permission problems
 */
export async function diagnoseMicrophoneAccess(): Promise<{
  hasGetUserMedia: boolean;
  permissionState: string;
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Check getUserMedia availability
  const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  if (!hasGetUserMedia) {
    errors.push('getUserMedia API not available');
  }

  // Check Permissions API
  let permissionState = 'unknown';
  if (navigator.permissions) {
    try {
      const result = await navigator.permissions.query({
        name: 'microphone' as PermissionName
      });
      permissionState = result.state;
    } catch (e) {
      permissionState = 'query-failed';
      errors.push(`Permissions API error: ${e}`);
    }
  } else {
    errors.push('Permissions API not available');
  }

  // Check secure context
  const isSecureContext = window.isSecureContext;
  if (!isSecureContext) {
    errors.push('Not in secure context (HTTPS required)');
  }

  // Check MediaDevices
  const hasMediaDevices = !!navigator.mediaDevices;
  if (!hasMediaDevices) {
    errors.push('MediaDevices API not available');
  }

  const diagnostics = {
    hasGetUserMedia,
    permissionState,
    isSecureContext,
    hasMediaDevices,
    errors
  };

  log.info('Microphone diagnostics:', diagnostics);

  return diagnostics;
}
