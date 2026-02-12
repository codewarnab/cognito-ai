import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import { readJson, sendJson, sendError } from '../http/json';
import type http from 'node:http';

function createMockReadable(body: string): http.IncomingMessage {
    const readable = new Readable({
        read() {
            this.push(Buffer.from(body));
            this.push(null);
        },
    });
    return readable as unknown as http.IncomingMessage;
}

function createMockRes() {
    let endData = '';
    const res = {
        statusCode: 200,
        setHeader: vi.fn(),
        end: vi.fn((data?: string) => { endData = data || ''; }),
    } as unknown as http.ServerResponse;
    return { res, getEndData: () => endData };
}

describe('readJson', () => {
    it('parses a valid JSON body', async () => {
        const req = createMockReadable(JSON.stringify({ hello: 'world' }));
        const result = await readJson(req);
        expect(result).toEqual({ hello: 'world' });
    });

    it('returns empty object for empty body', async () => {
        const req = createMockReadable('');
        const result = await readJson(req);
        expect(result).toEqual({});
    });

    it('throws for invalid JSON', async () => {
        const req = createMockReadable('not json');
        await expect(readJson(req)).rejects.toThrow();
    });
});

describe('sendJson', () => {
    it('sends JSON with default 200 status', () => {
        const { res, getEndData } = createMockRes();
        sendJson(res, { ok: true });

        expect(res.statusCode).toBe(200);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
        expect(JSON.parse(getEndData())).toEqual({ ok: true });
    });

    it('sends JSON with custom status code', () => {
        const { res } = createMockRes();
        sendJson(res, { error: 'bad' }, 400);

        expect(res.statusCode).toBe(400);
    });
});

describe('sendError', () => {
    it('sends error with default 400 status', () => {
        const { res, getEndData } = createMockRes();
        sendError(res, 'Something went wrong');

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(getEndData())).toEqual({ error: 'Something went wrong' });
    });

    it('sends error with custom status code', () => {
        const { res, getEndData } = createMockRes();
        sendError(res, 'Not found', 404);

        expect(res.statusCode).toBe(404);
        expect(JSON.parse(getEndData())).toEqual({ error: 'Not found' });
    });
});
