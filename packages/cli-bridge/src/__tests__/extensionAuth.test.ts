import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateExtensionOrigin } from '../auth/extensionAuth';

describe('validateExtensionOrigin', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Default to non-production
        delete process.env.NODE_ENV;
        delete process.env.EXTENSION_ID;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('returns invalid when origin is undefined', () => {
        const result = validateExtensionOrigin(undefined);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Missing Origin header');
    });

    it('returns invalid for non-parseable origin', () => {
        const result = validateExtensionOrigin('not-a-url');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid Origin header');
    });

    it('returns invalid for non-chrome-extension protocol', () => {
        const result = validateExtensionOrigin('https://example.com');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid origin protocol');
    });

    it('returns valid for any chrome-extension origin in dev mode', () => {
        const result = validateExtensionOrigin('chrome-extension://abcdef123456');
        expect(result.valid).toBe(true);
        expect(result.extensionId).toBe('abcdef123456');
    });

    it('returns valid in production when EXTENSION_ID matches', () => {
        process.env.NODE_ENV = 'production';
        process.env.EXTENSION_ID = 'myextensionid';
        const result = validateExtensionOrigin('chrome-extension://myextensionid');
        expect(result.valid).toBe(true);
        expect(result.extensionId).toBe('myextensionid');
    });

    it('returns invalid in production when EXTENSION_ID does not match', () => {
        process.env.NODE_ENV = 'production';
        process.env.EXTENSION_ID = 'expected-id';
        const result = validateExtensionOrigin('chrome-extension://wrong-id');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Unauthorized extension id');
    });

    it('returns invalid in production when EXTENSION_ID env is not set', () => {
        process.env.NODE_ENV = 'production';
        const result = validateExtensionOrigin('chrome-extension://some-id');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('EXTENSION_ID environment variable not set');
    });
});
