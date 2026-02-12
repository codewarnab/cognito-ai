import { describe, it, expect, vi } from 'vitest';
import { handleCors } from '../http/cors';
import type http from 'node:http';

function createMockReqRes(method: string, origin?: string) {
    const req = {
        method,
        headers: origin ? { origin } : {},
    } as unknown as http.IncomingMessage;

    const headers = new Map<string, string>();
    const res = {
        setHeader: vi.fn((key: string, value: string) => headers.set(key, value)),
        statusCode: 200,
        end: vi.fn(),
        _headers: headers,
    } as unknown as http.ServerResponse;

    return { req, res };
}

describe('handleCors', () => {
    it('sets CORS headers for chrome-extension origin', () => {
        const { req, res } = createMockReqRes('GET', 'chrome-extension://abc123');
        const result = handleCors(req, res);

        expect(result).toBe(false);
        expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'chrome-extension://abc123');
        expect(res.setHeader).toHaveBeenCalledWith('Vary', 'Origin');
        expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    });

    it('sets CORS headers for http://localhost origin', () => {
        const { req, res } = createMockReqRes('GET', 'http://localhost:3000');
        handleCors(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:3000');
    });

    it('sets CORS headers for http://127.0.0.1 origin', () => {
        const { req, res } = createMockReqRes('GET', 'http://127.0.0.1:8787');
        handleCors(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://127.0.0.1:8787');
    });

    it('does NOT set CORS headers for disallowed origin', () => {
        const { req, res } = createMockReqRes('GET', 'https://evil.com');
        const result = handleCors(req, res);

        expect(result).toBe(false);
        expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('does NOT set CORS headers when origin is absent', () => {
        const { req, res } = createMockReqRes('GET');
        handleCors(req, res);

        expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('handles OPTIONS preflight and returns true', () => {
        const { req, res } = createMockReqRes('OPTIONS', 'chrome-extension://abc');
        const result = handleCors(req, res);

        expect(result).toBe(true);
        expect(res.statusCode).toBe(204);
        expect(res.end).toHaveBeenCalled();
    });

    it('handles OPTIONS without origin (no CORS headers, but still returns true)', () => {
        const { req, res } = createMockReqRes('OPTIONS');
        const result = handleCors(req, res);

        expect(result).toBe(true);
        expect(res.statusCode).toBe(204);
    });
});
