import { describe, it, expect } from 'vitest';
import {
    TextContentPartSchema,
    ImageContentPartSchema,
    AudioContentPartSchema,
    ResourceContentPartSchema,
    ContentPartSchema,
    CliChatRequestSchema,
} from '../types';

describe('ContentPartSchema', () => {
    it('validates a text content part', () => {
        const result = TextContentPartSchema.safeParse({ type: 'text', text: 'hello' });
        expect(result.success).toBe(true);
    });

    it('rejects text part with missing text field', () => {
        const result = TextContentPartSchema.safeParse({ type: 'text' });
        expect(result.success).toBe(false);
    });

    it('validates an image content part', () => {
        const result = ImageContentPartSchema.safeParse({
            type: 'image',
            data: 'base64data',
            mimeType: 'image/png',
        });
        expect(result.success).toBe(true);
    });

    it('validates an audio content part', () => {
        const result = AudioContentPartSchema.safeParse({
            type: 'audio',
            data: 'base64audio',
            mimeType: 'audio/mp3',
        });
        expect(result.success).toBe(true);
    });

    it('validates a resource content part', () => {
        const result = ResourceContentPartSchema.safeParse({
            type: 'resource',
            data: 'base64file',
            mimeType: 'application/pdf',
            name: 'doc.pdf',
        });
        expect(result.success).toBe(true);
    });

    it('discriminated union resolves text type', () => {
        const result = ContentPartSchema.safeParse({ type: 'text', text: 'hi' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.type).toBe('text');
        }
    });

    it('discriminated union resolves image type', () => {
        const result = ContentPartSchema.safeParse({
            type: 'image',
            data: 'abc',
            mimeType: 'image/jpeg',
        });
        expect(result.success).toBe(true);
    });

    it('rejects unknown content part type', () => {
        const result = ContentPartSchema.safeParse({ type: 'video', data: 'x' });
        expect(result.success).toBe(false);
    });
});

describe('CliChatRequestSchema', () => {
    const validRequest = {
        messages: [
            {
                role: 'user',
                content: [{ type: 'text', text: 'Hello' }],
            },
        ],
        agent: {
            name: 'Gemini CLI',
            command: 'gemini',
            args: [],
        },
    };

    it('validates a minimal valid request', () => {
        const result = CliChatRequestSchema.safeParse(validRequest);
        expect(result.success).toBe(true);
    });

    it('defaults toolsMode to "agent"', () => {
        const result = CliChatRequestSchema.safeParse(validRequest);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.toolsMode).toBe('agent');
        }
    });

    it('accepts all valid toolsMode values', () => {
        for (const mode of ['chat', 'agent', 'adaptive', 'custom'] as const) {
            const result = CliChatRequestSchema.safeParse({ ...validRequest, toolsMode: mode });
            expect(result.success).toBe(true);
        }
    });

    it('rejects invalid toolsMode', () => {
        const result = CliChatRequestSchema.safeParse({ ...validRequest, toolsMode: 'invalid' });
        expect(result.success).toBe(false);
    });

    it('rejects request missing messages', () => {
        const { messages, ...rest } = validRequest;
        const result = CliChatRequestSchema.safeParse(rest);
        expect(result.success).toBe(false);
    });

    it('rejects request missing agent', () => {
        const { agent, ...rest } = validRequest;
        const result = CliChatRequestSchema.safeParse(rest);
        expect(result.success).toBe(false);
    });

    it('rejects invalid message role', () => {
        const result = CliChatRequestSchema.safeParse({
            ...validRequest,
            messages: [{ role: 'system', content: [{ type: 'text', text: 'hi' }] }],
        });
        expect(result.success).toBe(false);
    });

    it('accepts optional enabledTools array', () => {
        const result = CliChatRequestSchema.safeParse({
            ...validRequest,
            enabledTools: ['navigateTo', 'clickByText'],
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.enabledTools).toEqual(['navigateTo', 'clickByText']);
        }
    });

    it('accepts optional sessionId', () => {
        const result = CliChatRequestSchema.safeParse({
            ...validRequest,
            sessionId: 'sess-123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.sessionId).toBe('sess-123');
        }
    });
});
