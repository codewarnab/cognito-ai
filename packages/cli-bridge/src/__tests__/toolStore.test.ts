import { describe, it, expect, beforeEach } from 'vitest';
import {
    registerTools,
    getRegisteredTools,
    clearTools,
    handleToolResult,
    type ExtensionToolSchema,
} from '../mcp/toolStore';

const sampleTools: ExtensionToolSchema[] = [
    {
        name: 'navigateTo',
        description: 'Navigate to a URL',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string' },
            },
            required: ['url'],
        },
    },
    {
        name: 'clickByText',
        description: 'Click an element by text',
        parameters: {
            type: 'object',
            properties: {
                text: { type: 'string' },
            },
            required: ['text'],
        },
    },
];

describe('toolStore', () => {
    beforeEach(() => {
        clearTools();
    });

    describe('registerTools / getRegisteredTools', () => {
        it('starts with no tools', () => {
            expect(getRegisteredTools()).toEqual([]);
        });

        it('registers and retrieves tools', () => {
            registerTools(sampleTools);
            expect(getRegisteredTools()).toHaveLength(2);
            expect(getRegisteredTools()[0].name).toBe('navigateTo');
        });

        it('replaces previous tools on re-register', () => {
            registerTools(sampleTools);
            registerTools([sampleTools[0]]);
            expect(getRegisteredTools()).toHaveLength(1);
        });
    });

    describe('clearTools', () => {
        it('clears all registered tools', () => {
            registerTools(sampleTools);
            clearTools();
            expect(getRegisteredTools()).toEqual([]);
        });
    });

    describe('handleToolResult', () => {
        it('returns false for unknown requestId', () => {
            const result = handleToolResult({
                requestId: 'unknown-id',
                success: true,
                result: 'done',
            });
            expect(result).toBe(false);
        });
    });
});
