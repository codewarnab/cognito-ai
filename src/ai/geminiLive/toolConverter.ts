/**
 * Tool Converter for Gemini Live API
 * Converts AI SDK v5 tool format (with Zod schemas) to Gemini Live API format
 */

import { z } from 'zod';
import { SchemaType } from '@google/generative-ai';
import type { FunctionDeclaration, FunctionDeclarationSchema, FunctionDeclarationSchemaProperty } from '@google/generative-ai';
import type { ToolDefinition } from '../toolRegistryUtils';
import { createLogger } from '../../logger';

const log = createLogger('ToolConverter');

/**
 * Map Zod types to Gemini Live API SchemaType
 */
function getSchemaType(zodType: string): FunctionDeclarationSchemaProperty['type'] {
    switch (zodType) {
        case 'ZodString':
            return SchemaType.STRING;
        case 'ZodNumber':
            return SchemaType.NUMBER;
        case 'ZodBoolean':
            return SchemaType.BOOLEAN;
        case 'ZodArray':
            return SchemaType.ARRAY;
        case 'ZodObject':
            return SchemaType.OBJECT;
        default:
            log.warn(`⚠️ Unsupported Zod type: ${zodType}, defaulting to STRING`);
            return SchemaType.STRING;
    }
}

/**
 * Extract description from Zod schema if available
 */
function extractDescription(schema: any): string | undefined {
    // Check for .describe() metadata
    if (schema._def?.description) {
        return schema._def.description;
    }
    return undefined;
}

/**
 * Check if a Zod schema is optional
 */
function isOptional(schema: any): boolean {
    return schema._def?.typeName === 'ZodOptional' || schema.isOptional?.();
}

/**
 * Convert Zod schema to Gemini Live API Schema format
 */
export function zodToLiveAPISchema(schema: z.ZodSchema): FunctionDeclarationSchemaProperty {
    const zodDef = (schema as any)._def;
    const zodType = zodDef?.typeName;

    // Handle ZodOptional by unwrapping
    if (zodType === 'ZodOptional') {
        return zodToLiveAPISchema(zodDef.innerType);
    }

    // Handle ZodDefault by unwrapping
    if (zodType === 'ZodDefault') {
        return zodToLiveAPISchema(zodDef.innerType);
    }

    const result: FunctionDeclarationSchemaProperty = {
        type: getSchemaType(zodType),
    } as any;

    // Add description if available
    const description = extractDescription(schema);
    if (description) {
        result.description = description;
    }

    // Handle specific types
    switch (zodType) {
        case 'ZodString':
            // Check for enum (ZodEnum is wrapped in ZodString sometimes)
            break;

        case 'ZodNumber':
            // Could add min/max if needed in future
            break;

        case 'ZodBoolean':
            // No additional properties
            break;

        case 'ZodArray':
            // Convert array items
            if (zodDef.type) {
                (result as any).items = zodToLiveAPISchema(zodDef.type);
            }
            break;

        case 'ZodObject':
            // Convert object properties
            const shape = zodDef.shape();
            const properties: Record<string, FunctionDeclarationSchemaProperty> = {};
            const required: string[] = [];

            for (const [key, value] of Object.entries(shape)) {
                const zodValue = value as z.ZodSchema;
                properties[key] = zodToLiveAPISchema(zodValue);

                // Track required fields (not optional, not with default)
                if (!isOptional(zodValue) && (zodValue as any)._def?.typeName !== 'ZodDefault') {
                    required.push(key);
                }
            }

            (result as any).properties = properties;
            if (required.length > 0) {
                (result as any).required = required;
            }
            break;

        case 'ZodEnum':
            // Enum values as description
            if (zodDef.values && Array.isArray(zodDef.values)) {
                const enumDescription = `One of: ${zodDef.values.join(', ')}`;
                result.description = description
                    ? `${description} (${enumDescription})`
                    : enumDescription;
                (result as any).enum = zodDef.values;
            }
            break;

        case 'ZodUnion':
            // For unions, try to merge or pick first option
            // This is a simplification - complex unions may not convert well
            if (zodDef.options && zodDef.options.length > 0) {
                log.warn('⚠️ ZodUnion detected, using first option only');
                return zodToLiveAPISchema(zodDef.options[0]);
            }
            break;

        case 'ZodLiteral':
            // Literal values treated as enum with single value
            (result as any).enum = [zodDef.value];
            break;

        default:
            log.warn(`⚠️ Unhandled Zod type: ${zodType}`);
    }

    return result;
}

/**
 * Convert a tool definition from AI SDK v5 format to Gemini Live API format
 */
export function convertToolToLiveAPIFormat(
    toolName: string,
    toolDef: ToolDefinition
): FunctionDeclaration {
    try {
        log.info(`🔄 Converting tool: ${toolName}`);

        // Convert the Zod schema to Live API schema
        const parametersSchema = zodToLiveAPISchema(toolDef.parameters);

        // Ensure it's an object schema for parameters
        const parameters: FunctionDeclarationSchema = {
            type: SchemaType.OBJECT,
            properties: (parametersSchema as any).properties || {},
            required: (parametersSchema as any).required,
            description: parametersSchema.description,
        };

        // Create the function declaration
        const functionDeclaration: FunctionDeclaration = {
            name: toolName,
            description: toolDef.description,
            parameters,
        };

        log.info(`✅ Converted tool: ${toolName}`, {
            parameters,
        });

        return functionDeclaration;
    } catch (error) {
        log.error(`❌ Failed to convert tool: ${toolName}`, error);

        // Return a minimal declaration as fallback
        return {
            name: toolName,
            description: `${toolDef.description} (conversion failed)`,
            parameters: {
                type: SchemaType.OBJECT,
                properties: {},
            },
        };
    }
}

/**
 * Convert multiple tools from a Map
 */
export function convertToolsFromMap(
    tools: Map<string, ToolDefinition>
): FunctionDeclaration[] {
    const declarations: FunctionDeclaration[] = [];

    tools.forEach((toolDef, toolName) => {
        try {
            const declaration = convertToolToLiveAPIFormat(toolName, toolDef);
            declarations.push(declaration);
        } catch (error) {
            log.error(`❌ Skipping tool due to conversion error: ${toolName}`, error);
        }
    });

    log.info(`📦 Converted ${declarations.length} tools to Live API format`);
    return declarations;
}

/**
 * Converts all registered tools to Live API format
 * Accepts the tools object returned by getAllTools()
 */
export function convertAllTools(
    tools: Record<string, { description: string; inputSchema: z.ZodSchema; execute: (args: any) => Promise<any> }>
): FunctionDeclaration[] {
    const declarations: FunctionDeclaration[] = [];

    for (const [toolName, toolDef] of Object.entries(tools)) {
        try {
            // Convert to ToolDefinition format
            const normalizedTool: ToolDefinition = {
                name: toolName,
                description: toolDef.description,
                parameters: toolDef.inputSchema,
                execute: toolDef.execute,
            };

            const declaration = convertToolToLiveAPIFormat(toolName, normalizedTool);
            declarations.push(declaration);
        } catch (error) {
            log.error(`❌ Skipping tool due to conversion error: ${toolName}`, error);
        }
    }

    log.info(`📦 Converted ${declarations.length} tools to Live API format`);
    return declarations;
}

/**
 * Validate that a function declaration is properly formatted
 */
export function validateFunctionDeclaration(
    declaration: FunctionDeclaration
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!declaration.name || typeof declaration.name !== 'string') {
        errors.push('Missing or invalid name');
    }

    if (!declaration.description || typeof declaration.description !== 'string') {
        errors.push('Missing or invalid description');
    }

    if (!declaration.parameters) {
        errors.push('Missing parameters');
    } else {
        if (!declaration.parameters.type) {
            errors.push('Missing parameters.type');
        }

        // If type is OBJECT, should have properties
        if (declaration.parameters.type === SchemaType.OBJECT && !declaration.parameters.properties) {
            log.warn(`⚠️ Tool ${declaration.name} has OBJECT parameters but no properties defined`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Test helper: Convert a single Zod schema and log the result
 */
export function testSchemaConversion(schema: z.ZodSchema, name: string = 'test'): void {
    console.log(`\n=== Testing ${name} ===`);
    console.log('Input Zod Schema:', schema);

    const result = zodToLiveAPISchema(schema);
    console.log('Output Live API Schema:', JSON.stringify(result, null, 2));

    const validation = validateFunctionDeclaration({
        name,
        description: 'Test function',
        parameters: {
            type: SchemaType.OBJECT,
            properties: (result as any).properties || {},
        },
    });
    console.log('Validation:', validation);
}
