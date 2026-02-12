import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// Mock fs/promises before importing tokenStore
vi.mock('node:fs/promises', () => {
    let fileContent: string | null = null;
    return {
        default: {
            mkdir: vi.fn(async () => { }),
            readFile: vi.fn(async () => {
                if (fileContent === null) throw new Error('ENOENT');
                return fileContent;
            }),
            writeFile: vi.fn(async (_path: string, data: string) => {
                fileContent = data;
            }),
        },
        mkdir: vi.fn(async () => { }),
        readFile: vi.fn(async () => {
            if (fileContent === null) throw new Error('ENOENT');
            return fileContent;
        }),
        writeFile: vi.fn(async (_path: string, data: string) => {
            fileContent = data;
        }),
    };
});

import { hashToken, generateToken, addToken, validateToken, loadTokens } from '../pairing/tokenStore';

describe('tokenStore', () => {
    beforeEach(async () => {
        // Reset the mocked file system state by re-importing
        const fs = await import('node:fs/promises');
        // Clear write state by writing null-like value
        vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
        vi.mocked(fs.writeFile).mockImplementation(async () => { });
        vi.mocked(fs.mkdir).mockImplementation(async () => undefined as any);

        // Track written content
        let stored: string | null = null;
        vi.mocked(fs.writeFile).mockImplementation(async (_path: any, data: any) => {
            stored = data as string;
        });
        vi.mocked(fs.readFile).mockImplementation(async () => {
            if (stored === null) throw new Error('ENOENT');
            return stored as any;
        });
    });

    describe('hashToken', () => {
        it('produces a deterministic SHA-256 hex string', () => {
            const hash1 = hashToken('my-secret-token');
            const hash2 = hashToken('my-secret-token');
            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256 hex = 64 chars
        });

        it('matches Node.js crypto output', () => {
            const token = 'test-token-123';
            const expected = crypto.createHash('sha256').update(token).digest('hex');
            expect(hashToken(token)).toBe(expected);
        });

        it('different tokens produce different hashes', () => {
            expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
        });
    });

    describe('generateToken', () => {
        it('produces a 64-character hex string', () => {
            const token = generateToken();
            expect(token).toMatch(/^[0-9a-f]{64}$/);
        });

        it('generates unique tokens', () => {
            const tokens = new Set(Array.from({ length: 10 }, () => generateToken()));
            expect(tokens.size).toBe(10);
        });
    });

    describe('addToken + validateToken', () => {
        it('validates a previously added token', async () => {
            const token = generateToken();
            await addToken(token);
            const result = await validateToken(token);
            expect(result).toBe(true);
        });

        it('returns false for an unknown token', async () => {
            const result = await validateToken('nonexistent-token');
            expect(result).toBe(false);
        });

        it('is idempotent — adding same token twice does not duplicate', async () => {
            const token = generateToken();
            await addToken(token);
            await addToken(token);
            const tokens = await loadTokens();
            const hash = hashToken(token);
            const matches = tokens.filter(t => t.tokenHash === hash);
            expect(matches.length).toBe(1);
        });
    });
});
