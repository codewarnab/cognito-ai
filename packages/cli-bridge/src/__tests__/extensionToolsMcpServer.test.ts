import { describe, it, expect, beforeEach } from 'vitest';
import {
    isExtensionTool,
    extractOriginalToolName,
    getExtensionToolNames,
    getExtensionToolNamesBase,
} from '../mcp/extensionToolsMcpServer';
import { registerTools, clearTools, type ExtensionToolSchema } from '../mcp/toolStore';

const sampleTools: ExtensionToolSchema[] = [
    {
        name: 'navigateTo',
        description: 'Navigate to a URL',
        parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    },
    {
        name: 'clickByText',
        description: 'Click by text',
        parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    },
];

describe('extensionToolsMcpServer', () => {
    beforeEach(() => {
        clearTools();
    });

    describe('isExtensionTool', () => {
        it('returns true for prefixed tool names', () => {
            expect(isExtensionTool('mcp__extension__navigateTo')).toBe(true);
            expect(isExtensionTool('mcp__extension__clickByText')).toBe(true);
        });

        it('returns false for non-prefixed tool names', () => {
            expect(isExtensionTool('navigateTo')).toBe(false);
            expect(isExtensionTool('Read')).toBe(false);
            expect(isExtensionTool('mcp__other__tool')).toBe(false);
        });
    });

    describe('extractOriginalToolName', () => {
        it('strips the mcp__extension__ prefix', () => {
            expect(extractOriginalToolName('mcp__extension__navigateTo')).toBe('navigateTo');
        });

        it('returns the original name if not prefixed', () => {
            expect(extractOriginalToolName('navigateTo')).toBe('navigateTo');
        });
    });

    describe('getExtensionToolNamesBase', () => {
        it('returns empty array when no tools registered', () => {
            expect(getExtensionToolNamesBase()).toEqual([]);
        });

        it('returns base (un-prefixed) tool names', () => {
            registerTools(sampleTools);
            const names = getExtensionToolNamesBase();
            expect(names).toEqual(['navigateTo', 'clickByText']);
        });
    });

    describe('getExtensionToolNames', () => {
        it('returns empty array when no tools registered', () => {
            expect(getExtensionToolNames()).toEqual([]);
        });

        it('returns prefixed tool names', () => {
            registerTools(sampleTools);
            const names = getExtensionToolNames();
            expect(names).toEqual([
                'mcp__extension__navigateTo',
                'mcp__extension__clickByText',
            ]);
        });
    });
});
