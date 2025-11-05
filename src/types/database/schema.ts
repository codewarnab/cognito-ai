/**
 * Strongly typed database schema
 */

import type { AppUsage } from '../ai/usage';
import type { UIMessage } from 'ai';

export interface SettingRecord<T = unknown> {
    key: string;
    value: T;
}

// Settings type map for type-safe get/set
export interface SettingsTypeMap {
    paused: boolean;
    lastActiveThreadId: string;
    browserSessionId: string;
    theme: 'light' | 'dark' | 'system';
    voiceEnabled: boolean;
    autoSave: boolean;
    maxTokens: number;
    temperature: number;
    // Add more typed settings here as needed
}

export type SettingKey = keyof SettingsTypeMap;

export interface ChatThread {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    initialPageContext?: string;
    lastUsage?: AppUsage;
}

export interface ChatMessage {
    id: string;
    threadId: string;
    message: UIMessage;
    timestamp: number;
    sequenceNumber?: number;
    usage?: AppUsage;
}

export interface DBStats {
    chatMessageCount: number;
    settingsCount: number;
    threadCount: number;
}

export interface MemoryEntry {
    id: string;
    content: string;
    metadata?: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
}
