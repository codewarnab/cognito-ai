import { describe, it, expect } from 'vitest';
import {
    getSystemPromptForToolsMode,
    convertBridgeMessagesToAISDK,
} from '../handlers/chatUtils';

describe('getSystemPromptForToolsMode', () => {
    it('returns a prompt containing CLI bridge instructions for agent mode', () => {
        const prompt = getSystemPromptForToolsMode('agent');
        expect(prompt).toContain('CLI BRIDGE MODE');
        expect(prompt).toContain('AUTONOMOUS EXECUTION');
    });

    it('returns a prompt containing CLI bridge instructions for chat mode', () => {
        const prompt = getSystemPromptForToolsMode('chat');
        expect(prompt).toContain('CLI BRIDGE MODE');
    });

    it('returns a prompt containing CLI bridge instructions for adaptive mode', () => {
        const prompt = getSystemPromptForToolsMode('adaptive');
        expect(prompt).toContain('CLI BRIDGE MODE');
    });

    it('uses agent prompt for custom mode', () => {
        const customPrompt = getSystemPromptForToolsMode('custom');
        const agentPrompt = getSystemPromptForToolsMode('agent');
        expect(customPrompt).toBe(agentPrompt);
    });

    it('defaults to agent prompt when undefined', () => {
        const defaultPrompt = getSystemPromptForToolsMode(undefined);
        const agentPrompt = getSystemPromptForToolsMode('agent');
        expect(defaultPrompt).toBe(agentPrompt);
    });

    it('different modes produce different base prompts', () => {
        const chatPrompt = getSystemPromptForToolsMode('chat');
        const agentPrompt = getSystemPromptForToolsMode('agent');
        // They should differ at the beginning (different base prompts)
        // but both end with CLI bridge instructions
        expect(chatPrompt).not.toBe(agentPrompt);
    });
});

describe('convertBridgeMessagesToAISDK', () => {
    it('converts text content parts', () => {
        const result = convertBridgeMessagesToAISDK([
            { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].role).toBe('user');
        expect(result[0].content).toEqual([{ type: 'text', text: 'Hello' }]);
    });

    it('converts image parts to file parts for user messages', () => {
        const result = convertBridgeMessagesToAISDK([
            {
                role: 'user',
                content: [{ type: 'image', data: 'base64', mimeType: 'image/png' }],
            },
        ]);

        expect(result[0].content[0]).toEqual({
            type: 'file',
            data: 'base64',
            mediaType: 'image/png',
        });
    });

    it('converts non-text assistant parts to placeholder text', () => {
        const result = convertBridgeMessagesToAISDK([
            {
                role: 'assistant',
                content: [{ type: 'image', data: 'base64', mimeType: 'image/png' }],
            },
        ]);

        expect(result[0].content[0].type).toBe('text');
        expect(result[0].content[0].text).toContain('Attachment omitted');
        expect(result[0].content[0].text).toContain('image/png');
    });

    it('includes filename in placeholder when available', () => {
        const result = convertBridgeMessagesToAISDK([
            {
                role: 'assistant',
                content: [{ type: 'resource', data: 'base64', mimeType: 'application/pdf', name: 'report.pdf' }],
            },
        ]);

        expect(result[0].content[0].text).toContain('report.pdf');
    });

    it('filters out messages with no valid content parts', () => {
        const result = convertBridgeMessagesToAISDK([
            { role: 'user', content: [null, undefined] as any },
            { role: 'user', content: [{ type: 'text', text: 'valid' }] },
        ]);

        // The first message should be filtered because all parts are null
        expect(result).toHaveLength(1);
        expect(result[0].content[0].text).toBe('valid');
    });

    it('handles empty messages array', () => {
        const result = convertBridgeMessagesToAISDK([]);
        expect(result).toEqual([]);
    });

    it('handles non-object content parts gracefully', () => {
        const result = convertBridgeMessagesToAISDK([
            { role: 'user', content: ['string', 123, true] as any },
        ]);
        // Non-object parts should be filtered out
        expect(result).toHaveLength(0);
    });
});
