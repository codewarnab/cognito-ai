import { describe, it, expect } from 'vitest';
import { findAgent, CODE_MODE_AGENTS } from '../agents';

describe('CODE_MODE_AGENTS', () => {
    it('contains 3 agents', () => {
        expect(CODE_MODE_AGENTS).toHaveLength(3);
    });

    it('each agent has required fields', () => {
        for (const agent of CODE_MODE_AGENTS) {
            expect(agent.name).toBeTruthy();
            expect(agent.command).toBeTruthy();
            expect(agent.args).toBeInstanceOf(Array);
        }
    });

    it('includes Gemini CLI, Claude Code, and Codex CLI', () => {
        const names = CODE_MODE_AGENTS.map(a => a.name);
        expect(names).toContain('Gemini CLI');
        expect(names).toContain('Claude Code');
        expect(names).toContain('Codex CLI');
    });

    it('each agent has an aiSdkProvider', () => {
        for (const agent of CODE_MODE_AGENTS) {
            expect(agent.aiSdkProvider).toBeTruthy();
        }
    });
});

describe('findAgent', () => {
    it('finds agent by exact name', () => {
        const agent = findAgent('Gemini CLI');
        expect(agent).toBeDefined();
        expect(agent!.name).toBe('Gemini CLI');
    });

    it('finds agent case-insensitively', () => {
        const agent = findAgent('gemini cli');
        expect(agent).toBeDefined();
        expect(agent!.name).toBe('Gemini CLI');
    });

    it('finds agent with mixed case', () => {
        const agent = findAgent('CLAUDE CODE');
        expect(agent).toBeDefined();
        expect(agent!.name).toBe('Claude Code');
    });

    it('returns undefined for unknown agent', () => {
        const agent = findAgent('Unknown Agent');
        expect(agent).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
        const agent = findAgent('');
        expect(agent).toBeUndefined();
    });
});
