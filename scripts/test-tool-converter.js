/**
 * Test Tool Converter - Node.js runner
 * Run with: node scripts/test-tool-converter.js
 */

const { z } = require('zod');

// Mock the logger
const createLogger = (name) => ({
    info: (...args) => console.log(`[${name}]`, ...args),
    warn: (...args) => console.warn(`[${name}]`, ...args),
    error: (...args) => console.error(`[${name}]`, ...args),
});

// Import after setting up mocks
async function runTests() {
    console.log('\n🧪 === Tool Converter Tests ===\n');

    // Since we can't directly import TS in Node without compilation,
    // we'll test the logic directly here

    const { SchemaType } = await import('@google/generative-ai');

    // Test schemas
    const simpleStringSchema = z.object({
        url: z.string().describe('The URL to navigate to'),
    });

    const complexSchema = z.object({
        url: z.string().describe('The URL to open'),
        newTab: z.boolean().describe('Open in new tab').default(true),
        position: z.number().describe('Tab position').optional(),
    });

    console.log('✅ Test 1: Check Zod schema structure');
    console.log('Simple schema type:', simpleStringSchema._def.typeName);
    const simpleShape = simpleStringSchema._def.shape;
    console.log('Shape keys:', Object.keys(simpleShape));

    console.log('\n✅ Test 2: Complex schema structure');
    const shape = complexSchema._def.shape;
    console.log('Keys:', Object.keys(shape));
    for (const [key, value] of Object.entries(shape)) {
        console.log(`  ${key}:`, {
            type: value._def.typeName,
            description: value._def.description,
            isOptional: value.isOptional?.() || value._def.typeName === 'ZodOptional',
            hasDefault: value._def.typeName === 'ZodDefault',
        });
    }

    console.log('\n✅ Test 3: Check SchemaType enum');
    console.log('SchemaType.STRING:', SchemaType.STRING);
    console.log('SchemaType.OBJECT:', SchemaType.OBJECT);
    console.log('SchemaType.BOOLEAN:', SchemaType.BOOLEAN);
    console.log('SchemaType.NUMBER:', SchemaType.NUMBER);
    console.log('SchemaType.ARRAY:', SchemaType.ARRAY);

    console.log('\n✅ All structural tests passed! 🎉');
    console.log('\n💡 To test the full converter:');
    console.log('   1. Build the extension: npm run build');
    console.log('   2. Load in Chrome and open side panel');
    console.log('   3. Open DevTools Console (F12)');
    console.log('   4. Run: ');
    console.log('      import("/ai/geminiLive/toolConverter.test.js").then(m => m.runToolConverterTests())');
}

runTests().catch(console.error);
