/**
 * Branded types for domain-specific values
 * Prevents mixing up similar primitive types
 */

import type { Brand } from './helpers';

// IDs
export type ThreadId = Brand<string, 'ThreadId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type UserId = Brand<string, 'UserId'>;
export type TabId = Brand<number, 'TabId'>;
export type SessionId = Brand<string, 'SessionId'>;

// Validated values
export type EmailAddress = Brand<string, 'EmailAddress'>;
export type URL = Brand<string, 'URL'>;
export type ApiKey = Brand<string, 'ApiKey'>;

// Numeric ranges
export type Temperature = Brand<number, 'Temperature'>; // 0-1
export type Percentage = Brand<number, 'Percentage'>; // 0-100
export type TokenCount = Brand<number, 'TokenCount'>; // >= 0

// Constructors with validation
export function createThreadId(id: string): ThreadId {
    if (!id || typeof id !== 'string') {
        throw new Error('Invalid thread ID');
    }
    return id as ThreadId;
}

export function createMessageId(id: string): MessageId {
    if (!id || typeof id !== 'string') {
        throw new Error('Invalid message ID');
    }
    return id as MessageId;
}

export function createTemperature(value: number): Temperature {
    if (value < 0 || value > 1) {
        throw new Error('Temperature must be between 0 and 1');
    }
    return value as Temperature;
}

export function createPercentage(value: number): Percentage {
    if (value < 0 || value > 100) {
        throw new Error('Percentage must be between 0 and 100');
    }
    return value as Percentage;
}

export function createTokenCount(value: number): TokenCount {
    if (value < 0 || !Number.isInteger(value)) {
        throw new Error('Token count must be a non-negative integer');
    }
    return value as TokenCount;
}

export function createURL(url: string): URL {
    try {
        new globalThis.URL(url);
        return url as URL;
    } catch {
        throw new Error(`Invalid URL: ${url}`);
    }
}

export function createEmailAddress(email: string): EmailAddress {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error(`Invalid email address: ${email}`);
    }
    return email as EmailAddress;
}

export function createApiKey(key: string): ApiKey {
    if (!key || typeof key !== 'string' || key.length < 8) {
        throw new Error('Invalid API key');
    }
    return key as ApiKey;
}

// Helper to unwrap branded types
export function unwrap<T extends Brand<any, any>>(value: T): T extends Brand<infer U, any> ? U : never {
    return value as any;
}
