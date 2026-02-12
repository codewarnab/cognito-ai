import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isIsolatedMode, getAgentCwd } from '../utils/sandbox';

describe('sandbox', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        delete process.env.COGNITO_BRIDGE_ALLOW_LOCAL_ACCESS;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('isIsolatedMode', () => {
        it('returns true by default (no env var set)', () => {
            expect(isIsolatedMode()).toBe(true);
        });

        it('returns false when COGNITO_BRIDGE_ALLOW_LOCAL_ACCESS=true', () => {
            process.env.COGNITO_BRIDGE_ALLOW_LOCAL_ACCESS = 'true';
            expect(isIsolatedMode()).toBe(false);
        });

        it('returns true for any other value of the env var', () => {
            process.env.COGNITO_BRIDGE_ALLOW_LOCAL_ACCESS = 'false';
            expect(isIsolatedMode()).toBe(true);

            process.env.COGNITO_BRIDGE_ALLOW_LOCAL_ACCESS = '1';
            expect(isIsolatedMode()).toBe(true);
        });
    });

    describe('getAgentCwd', () => {
        it('returns sandbox path in isolated mode (default)', () => {
            const cwd = getAgentCwd('/user/project');
            // Should NOT return the user's path, should return a temp sandbox
            expect(cwd).not.toBe('/user/project');
            expect(cwd).toContain('cognito-bridge-sandbox');
        });

        it('returns user CWD when isolation is disabled', () => {
            process.env.COGNITO_BRIDGE_ALLOW_LOCAL_ACCESS = 'true';
            const cwd = getAgentCwd('/user/project');
            expect(cwd).toBe('/user/project');
        });
    });
});
