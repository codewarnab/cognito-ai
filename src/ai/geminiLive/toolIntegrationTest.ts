/**
 * Tool Integration Test for Gemini Live API
 * 
 * Tests Phase 8 implementation:
 * - Extension tool retrieval
 * - MCP tool filtering
 * - Tool conversion to Live API format
 * - Tool validation
 */

import { getAllTools, getTool } from '../tools/registryUtils';
import { convertAllTools, validateFunctionDeclaration } from './toolConverter';
import { createLogger } from '@logger';

const log = createLogger('ToolIntegrationTest', 'TOOLS_INTEGRATION');

/**
 * Test tool integration for voice mode
 */
export async function testToolIntegration(): Promise<{
    success: boolean;
    extensionTools: string[];
    mcpToolsFiltered: string[];
    convertedTools: number;
    validationResults: Array<{ name: string; valid: boolean; errors: string[] }>;
    errors: string[];
}> {
    const errors: string[] = [];

    try {
        log.info('🧪 Starting tool integration test...');

        // Step 1: Get all registered tools
        log.info('📋 Step 1: Retrieving all registered tools');
        const allTools = getAllTools();
        const allToolNames = Object.keys(allTools);

        log.info(`Found ${allToolNames.length} total tools:`, allToolNames);

        if (allToolNames.length === 0) {
            errors.push('No tools registered in the tool registry');
            return {
                success: false,
                extensionTools: [],
                mcpToolsFiltered: [],
                convertedTools: 0,
                validationResults: [],
                errors
            };
        }

        // Step 2: Filter extension tools (exclude MCP tools)
        log.info('🔍 Step 2: Filtering extension tools (excluding MCP)');
        const extensionTools: typeof allTools = {};
        const mcpToolsFiltered: string[] = [];

        for (const [name, tool] of Object.entries(allTools)) {
            if (name.startsWith('mcp_')) {
                mcpToolsFiltered.push(name);
                log.debug(`Filtered out MCP tool: ${name}`);
            } else {
                extensionTools[name] = tool;
            }
        }

        const extensionToolNames = Object.keys(extensionTools);
        log.info(`Extension tools: ${extensionToolNames.length}`, extensionToolNames);
        log.info(`MCP tools filtered: ${mcpToolsFiltered.length}`, mcpToolsFiltered);

        // Step 3: Convert tools to Live API format
        log.info('🔄 Step 3: Converting tools to Live API format');
        const convertedDeclarations = convertAllTools(extensionTools);

        log.info(`Converted ${convertedDeclarations.length} tools to Live API format`);

        if (convertedDeclarations.length !== extensionToolNames.length) {
            errors.push(
                `Tool conversion count mismatch: expected ${extensionToolNames.length}, got ${convertedDeclarations.length}`
            );
        }

        // Step 4: Validate each converted tool
        log.info('✅ Step 4: Validating converted tools');
        const validationResults = convertedDeclarations.map(declaration => {
            const validation = validateFunctionDeclaration(declaration);

            if (!validation.valid) {
                log.warn(`Invalid tool declaration: ${declaration.name}`, validation.errors);
                errors.push(`Tool ${declaration.name} validation failed: ${validation.errors.join(', ')}`);
            } else {
                log.debug(`✓ Valid: ${declaration.name}`);
            }

            return {
                name: declaration.name,
                valid: validation.valid,
                errors: validation.errors
            };
        });

        const validCount = validationResults.filter(r => r.valid).length;
        const invalidCount = validationResults.filter(r => !r.valid).length;

        log.info(`Validation complete: ${validCount} valid, ${invalidCount} invalid`);

        // Step 5: Test tool execution (without actually executing)
        log.info('🔧 Step 5: Verifying tool execute functions');
        for (const toolName of extensionToolNames) {
            const toolDef = getTool(toolName);

            if (!toolDef) {
                errors.push(`Tool definition not found for: ${toolName}`);
                continue;
            }

            if (typeof toolDef.execute !== 'function') {
                errors.push(`Tool ${toolName} has invalid execute function`);
            }
        }

        // Summary
        const success = errors.length === 0 && invalidCount === 0;

        log.info('📊 Test Summary:', {
            success,
            totalTools: allToolNames.length,
            extensionTools: extensionToolNames.length,
            mcpToolsFiltered: mcpToolsFiltered.length,
            convertedTools: convertedDeclarations.length,
            validTools: validCount,
            invalidTools: invalidCount,
            errors: errors.length
        });

        if (success) {
            log.info('✅ Tool integration test PASSED');
        } else {
            log.error('❌ Tool integration test FAILED');
            errors.forEach(err => log.error(`  - ${err}`));
        }

        return {
            success,
            extensionTools: extensionToolNames,
            mcpToolsFiltered,
            convertedTools: convertedDeclarations.length,
            validationResults,
            errors
        };

    } catch (error) {
        log.error('❌ Test failed with exception:', error);
        errors.push(`Exception: ${error instanceof Error ? error.message : String(error)}`);

        return {
            success: false,
            extensionTools: [],
            mcpToolsFiltered: [],
            convertedTools: 0,
            validationResults: [],
            errors
        };
    }
}

/**
 * Print detailed tool information for debugging
 */
export function printToolDetails(): void {
    log.info('📋 Detailed Tool Information');
    log.info('='.repeat(80));

    const allTools = getAllTools();

    for (const [name, tool] of Object.entries(allTools)) {
        const isMCP = name.startsWith('mcp_');

        log.info(`\nTool: ${name} ${isMCP ? '[MCP]' : '[Extension]'}`);
        log.info(`  Description: ${tool.description}`);
        log.info(`  Has execute: ${typeof tool.execute === 'function'}`);

        // Try to get schema info
        try {
            const schema = tool.inputSchema;
            const zodDef = (schema as any)._def;
            log.info(`  Schema type: ${zodDef?.typeName || 'unknown'}`);

            if (zodDef?.typeName === 'ZodObject') {
                const shape = zodDef.shape();
                const params = Object.keys(shape);
                log.info(`  Parameters (${params.length}): ${params.join(', ')}`);
            }
        } catch (error) {
            log.warn(`  Schema inspection failed: ${error}`);
        }
    }

    log.info('\n' + '='.repeat(80));
}

/**
 * Run integration test and return formatted report
 */
export async function runToolIntegrationReport(): Promise<string> {
    const result = await testToolIntegration();

    let report = '╔════════════════════════════════════════════════════════════════╗\n';
    report += '║       Gemini Live Tool Integration Test Report                ║\n';
    report += '╚════════════════════════════════════════════════════════════════╝\n\n';

    report += `Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}\n\n`;

    report += '📊 Statistics:\n';
    report += `  Extension Tools:     ${result.extensionTools.length}\n`;
    report += `  MCP Tools Filtered:  ${result.mcpToolsFiltered.length}\n`;
    report += `  Converted Tools:     ${result.convertedTools}\n`;
    report += `  Valid Tools:         ${result.validationResults.filter(r => r.valid).length}\n`;
    report += `  Invalid Tools:       ${result.validationResults.filter(r => !r.valid).length}\n\n`;

    if (result.extensionTools.length > 0) {
        report += '🔧 Extension Tools (for Voice Mode):\n';
        result.extensionTools.forEach(name => {
            const validation = result.validationResults.find(v => v.name === name);
            const status = validation?.valid ? '✓' : '✗';
            report += `  ${status} ${name}\n`;
        });
        report += '\n';
    }

    if (result.mcpToolsFiltered.length > 0) {
        report += '🚫 MCP Tools (Filtered Out):\n';
        result.mcpToolsFiltered.forEach(name => {
            report += `  - ${name}\n`;
        });
        report += '\n';
    }

    if (result.errors.length > 0) {
        report += '❌ Errors:\n';
        result.errors.forEach(err => {
            report += `  - ${err}\n`;
        });
        report += '\n';
    }

    if (result.validationResults.some(r => !r.valid)) {
        report += '⚠️  Invalid Tools:\n';
        result.validationResults
            .filter(r => !r.valid)
            .forEach(({ name, errors }) => {
                report += `  ${name}:\n`;
                errors.forEach(err => report += `    - ${err}\n`);
            });
        report += '\n';
    }

    return report;
}

// Export for use in tests
export default {
    testToolIntegration,
    printToolDetails,
    runToolIntegrationReport
};
