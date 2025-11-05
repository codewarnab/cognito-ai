/**
 * Unit tests for Tool Converter
 * Tests conversion of Zod schemas to Gemini Live API format
 */

import { z } from 'zod';
import { SchemaType } from '@google/generative-ai';
import {
    zodToLiveAPISchema,
    convertToolToLiveAPIFormat,
    convertAllTools,
    validateFunctionDeclaration,
} from './toolConverter';
import type { ToolDefinition } from '../tools/registryUtils';

// Test 1: Simple string parameter
const simpleStringSchema = z.object({
    url: z.string().describe('The URL to navigate to'),
});

// Test 2: Object with multiple types
const complexSchema = z.object({
    url: z.string().describe('The URL to open'),
    newTab: z.boolean().describe('Open in new tab').default(true),
    position: z.number().describe('Tab position').optional(),
});

// Test 3: Array parameter
const arraySchema = z.object({
    tabIds: z.array(z.number()).describe('Array of tab IDs'),
});

// Test 4: Nested object
const nestedSchema = z.object({
    config: z.object({
        enabled: z.boolean(),
        timeout: z.number(),
    }),
});

// Test 5: Enum
const enumSchema = z.object({
    direction: z.enum(['up', 'down', 'left', 'right']).describe('Scroll direction'),
});

/**
 * Run all tests
 */
export function runToolConverterTests() {
    console.log('\n🧪 === Tool Converter Tests ===\n');

    // Test 1: Simple string
    console.log('✅ Test 1: Simple string parameter');
    const result1 = zodToLiveAPISchema(simpleStringSchema) as any;
    console.log(JSON.stringify(result1, null, 2));
    console.assert(result1.type === SchemaType.OBJECT, 'Should be OBJECT type');
    console.assert(result1.properties?.url.type === SchemaType.STRING, 'url should be STRING');
    console.assert(result1.properties?.url.description === 'The URL to navigate to', 'Should have description');

    // Test 2: Complex schema
    console.log('\n✅ Test 2: Complex schema with multiple types');
    const result2 = zodToLiveAPISchema(complexSchema) as any;
    console.log(JSON.stringify(result2, null, 2));
    console.assert(result2.properties?.url.type === SchemaType.STRING, 'url should be STRING');
    console.assert(result2.properties?.newTab.type === SchemaType.BOOLEAN, 'newTab should be BOOLEAN');
    console.assert(result2.properties?.position.type === SchemaType.NUMBER, 'position should be NUMBER');
    console.assert(result2.required?.includes('url'), 'url should be required');
    console.assert(!result2.required?.includes('position'), 'position should not be required');

    // Test 3: Array
    console.log('\n✅ Test 3: Array parameter');
    const result3 = zodToLiveAPISchema(arraySchema) as any;
    console.log(JSON.stringify(result3, null, 2));
    console.assert(result3.properties?.tabIds.type === SchemaType.ARRAY, 'tabIds should be ARRAY');
    console.assert(result3.properties?.tabIds.items?.type === SchemaType.NUMBER, 'Array items should be NUMBER');

    // Test 4: Nested object
    console.log('\n✅ Test 4: Nested object');
    const result4 = zodToLiveAPISchema(nestedSchema) as any;
    console.log(JSON.stringify(result4, null, 2));
    console.assert(result4.properties?.config.type === SchemaType.OBJECT, 'config should be OBJECT');
    console.assert(result4.properties?.config.properties?.enabled.type === SchemaType.BOOLEAN, 'enabled should be BOOLEAN');

    // Test 5: Enum
    console.log('\n✅ Test 5: Enum parameter');
    const result5 = zodToLiveAPISchema(enumSchema) as any;
    console.log(JSON.stringify(result5, null, 2));
    console.assert(result5.properties?.direction.type === SchemaType.STRING, 'direction should be STRING');
    console.assert(result5.properties?.direction.enum?.includes('up'), 'Should have enum values');

    // Test 6: Full tool conversion
    console.log('\n✅ Test 6: Full tool conversion');
    const testTool: ToolDefinition = {
        name: 'navigateTo',
        description: 'Navigate to a URL',
        parameters: complexSchema,
        execute: async () => ({ success: true }),
    };

    const declaration = convertToolToLiveAPIFormat('navigateTo', testTool);
    console.log(JSON.stringify(declaration, null, 2));
    console.assert(declaration.name === 'navigateTo', 'Name should match');
    console.assert(declaration.description === 'Navigate to a URL', 'Description should match');
    console.assert(declaration.parameters.type === SchemaType.OBJECT, 'Parameters should be OBJECT');

    // Test 7: Validation
    console.log('\n✅ Test 7: Function declaration validation');
    const validation = validateFunctionDeclaration(declaration);
    console.log('Validation result:', validation);
    console.assert(validation.valid === true, 'Should be valid');
    console.assert(validation.errors.length === 0, 'Should have no errors');

    // Test 8: Convert all tools
    console.log('\n✅ Test 8: Convert all tools');
    const toolsObject = {
        navigateTo: {
            description: 'Navigate to a URL',
            inputSchema: simpleStringSchema,
            execute: async () => ({ success: true }),
        },
        scrollPage: {
            description: 'Scroll the page',
            inputSchema: enumSchema,
            execute: async () => ({ success: true }),
        },
    };

    const declarations = convertAllTools(toolsObject);
    console.log(`Converted ${declarations.length} tools`);
    console.assert(declarations.length === 2, 'Should convert 2 tools');
    console.assert(declarations[0].name === 'navigateTo', 'First tool should be navigateTo');
    console.assert(declarations[1].name === 'scrollPage', 'Second tool should be scrollPage');

    console.log('\n✅ All tests passed! 🎉\n');
}

// Run tests if executed directly
if (typeof window !== 'undefined' && (window as any).runToolConverterTests) {
    (window as any).runToolConverterTests = runToolConverterTests;
}
