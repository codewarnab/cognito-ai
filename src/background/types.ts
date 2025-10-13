/**
 * Type definitions for background service worker
 */

// Settings
export interface Settings {
    paused?: boolean;
}

// Message schemas
export type BgMsgFromContent =
    | { type: 'TogglePause'; paused: boolean }
    | { type: 'CheckModelReady' }
    | { type: 'GetModelDebugInfo' }
    | { type: 'GET_SETTINGS' }
    | { type: 'SET_PAUSED'; paused: boolean }
    | { type: 'privacy:wipe'; alsoRemoveModel?: boolean; delayMs?: number }
    | { type: 'privacy:wipe:cancel' };

export type BgMsgToContent =
    | { type: 'Ack'; id?: string }
    | { type: 'Error'; message: string };
