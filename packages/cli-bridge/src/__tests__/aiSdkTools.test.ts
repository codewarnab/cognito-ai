import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { sanitizeToolName, jsonSchemaToZod, generateToolCallId } from '../handlers/aiSdkTools';

describe('sanitizeToolName', () => {
    it('returns valid names unchanged', () => {
        expect(sanitizeToolName('navigateTo')).toBe('navigateTo');
        expect(sanitizeToolName('click_by_text')).toBe('click_by_text');
        expect(sanitizeToolName('a.b.c')).toBe('a.b.c');
        expect(sanitizeToolName('tool:name')).toBe('tool:name');
        expect(sanitizeToolName('my-tool')).toBe('my-tool');
    });

    it('prefixes names starting with a digit', () => {
        expect(sanitizeToolName('123abc')).toBe('fn_123abc');
        expect(sanitizeToolName('0start')).toBe('fn_0start');
    });

    it('replaces invalid characters with underscores', () => {
        expect(sanitizeToolName('tool name')).toBe('tool_name');
        expect(sanitizeToolName('tool@name!')).toBe('tool_name_');
        expect(sanitizeToolName('hello(world)')).toBe('hello_world_');
    });

    it('handles both digit prefix and invalid characters', () => {
        expect(sanitizeToolName('9tool name')).toBe('fn_9tool_name');
    });

    it('handles empty string', () => {
        expect(sanitizeToolName('')).toBe('');
    });
});

describe('jsonSchemaToZod', () => {
    it('returns z.any() for null/undefined input', () => {
        const schema = jsonSchemaToZod(null);
        expect(schema.safeParse('anything').success).toBe(true);
        expect(schema.safeParse(42).success).toBe(true);
    });

    it('converts string type', () => {
        const schema = jsonSchemaToZod({ type: 'string' });
        expect(schema.safeParse('hello').success).toBe(true);
        expect(schema.safeParse(42).success).toBe(false);
    });

    it('converts number type', () => {
        const schema = jsonSchemaToZod({ type: 'number' });
        expect(schema.safeParse(42).success).toBe(true);
        expect(schema.safeParse('str').success).toBe(false);
    });

    it('converts integer type as number', () => {
        const schema = jsonSchemaToZod({ type: 'integer' });
        expect(schema.safeParse(42).success).toBe(true);
        expect(schema.safeParse('str').success).toBe(false);
    });

    it('converts boolean type', () => {
        const schema = jsonSchemaToZod({ type: 'boolean' });
        expect(schema.safeParse(true).success).toBe(true);
        expect(schema.safeParse('yes').success).toBe(false);
    });

    it('converts null type', () => {
        const schema = jsonSchemaToZod({ type: 'null' });
        expect(schema.safeParse(null).success).toBe(true);
        expect(schema.safeParse('str').success).toBe(false);
    });

    it('converts array type', () => {
        const schema = jsonSchemaToZod({ type: 'array', items: { type: 'string' } });
        expect(schema.safeParse(['a', 'b']).success).toBe(true);
        expect(schema.safeParse([1, 2]).success).toBe(false);
    });

    it('converts array without items to z.array(z.any())', () => {
        const schema = jsonSchemaToZod({ type: 'array' });
        expect(schema.safeParse([1, 'a', true]).success).toBe(true);
    });

    it('converts object with properties and required', () => {
        const schema = jsonSchemaToZod({
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' },
            },
            required: ['name'],
        });

        // Valid with required field
        expect(schema.safeParse({ name: 'Alice' }).success).toBe(true);
        // Valid with both fields
        expect(schema.safeParse({ name: 'Alice', age: 30 }).success).toBe(true);
        // Invalid without required field
        expect(schema.safeParse({ age: 30 }).success).toBe(false);
    });

    it('object schema allows extra properties (passthrough)', () => {
        const schema = jsonSchemaToZod({
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
        });
        const result = schema.safeParse({ name: 'Alice', extra: true });
        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as any).extra).toBe(true);
        }
    });

    it('converts object without properties as record', () => {
        const schema = jsonSchemaToZod({ type: 'object' });
        expect(schema.safeParse({ any: 'value' }).success).toBe(true);
    });

    it('converts enum to z.enum', () => {
        const schema = jsonSchemaToZod({ enum: ['on', 'off'] });
        expect(schema.safeParse('on').success).toBe(true);
        expect(schema.safeParse('off').success).toBe(true);
        expect(schema.safeParse('maybe').success).toBe(false);
    });

    it('anyOf/oneOf falls back to z.any()', () => {
        const schema = jsonSchemaToZod({ anyOf: [{ type: 'string' }, { type: 'number' }] });
        expect(schema.safeParse('anything').success).toBe(true);
        expect(schema.safeParse(123).success).toBe(true);
    });

    it('unknown type falls back to z.any()', () => {
        const schema = jsonSchemaToZod({ type: 'custom_type' });
        expect(schema.safeParse('whatever').success).toBe(true);
    });
});

describe('generateToolCallId', () => {
    it('generates a string starting with "tool_"', () => {
        const id = generateToolCallId();
        expect(id.startsWith('tool_')).toBe(true);
    });

    it('generates unique IDs', () => {
        const ids = new Set(Array.from({ length: 20 }, () => generateToolCallId()));
        expect(ids.size).toBe(20);
    });
});
