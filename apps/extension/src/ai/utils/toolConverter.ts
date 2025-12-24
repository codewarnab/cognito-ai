/**
 * Tool Converter for Gemini API
 * Converts AI SDK v6 tool format (with Zod schemas) to Gemini API format
 */

import { z } from 'zod';
// Migrated to @google/genai for consistency with browser action agent
import { Type as SchemaType } from '@google/genai';
import type { FunctionDeclaration, Schema } from '@google/genai';
import type { ToolDefinition } from '../tools/registryUtils';
import { createLogger } from '~logger';

// Type aliases for backwards compatibility
type FunctionDeclarationSchema = Schema;
type FunctionDeclarationSchemaProperty = Schema;

const log = createLogger('ToolConverter', 'TOOLS_REGISTRY');

/**
 * Map Zod types to Gemini API SchemaType
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
    // Check for .describe() metadata at various levels
    if (schema._def?.description) {
        return schema._def.description;
    }

    // Sometimes description is nested in innerType
    if (schema._def?.innerType?._def?.description) {
        return schema._def.innerType._def.description;
    }

    // Check the schema property (for ZodEffects)
    if (schema._def?.schema?._def?.description) {
        return schema._def.schema._def.description;
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
 * Unwrap Zod schema to get the innermost type (handles .describe(), .optional(), .default(), etc.)
 */
function unwrapZodSchema(schema: any): any {
    let current = schema;
    const wrappers: string[] = [];
    let maxIterations = 10; // Prevent infinite loops

    // Keep unwrapping until we find the base type
    while (current?._def && maxIterations > 0) {
        maxIterations--;
        const typeName = current._def.typeName;

        if (!typeName) {
            // No typeName, return what we have
            break;
        }

        // Track wrapper types (including those created by .describe())
        if (['ZodOptional', 'ZodDefault', 'ZodNullable', 'ZodEffects', 'ZodBranded', 'ZodPipeline', 'ZodCatch'].includes(typeName)) {
            wrappers.push(typeName);

            // Unwrap to inner type
            if (current._def.innerType) {
                current = current._def.innerType;
            } else if (current._def.schema) {
                current = current._def.schema;
            } else {
                break;
            }
        } else {
            // Found a base type (ZodString, ZodNumber, ZodObject, etc.)
            break;
        }
    }

    return current;
}

/**
 * Convert Zod schema to Gemini API Schema format
 */
export function zodToGeminiAPISchema(schema: z.ZodSchema, parentContext?: string): FunctionDeclarationSchemaProperty {
    // First unwrap any wrapper types (describe, optional, default, etc.)
    const unwrapped = unwrapZodSchema(schema);
    const zodDef = unwrapped?._def;
    let zodType = zodDef?.typeName;

    // Debug logging for problematic cases
    if (!zodType && parentContext) {
        log.info(`🔍 Debugging schema without typeName`, {
            context: parentContext,
            originalTypeName: (schema as any)?._def?.typeName,
            unwrappedTypeName: zodType,
            originalDef: (schema as any)?._def ? {
                hasTypeName: !!(schema as any)._def.typeName,
                hasInnerType: !!(schema as any)._def.innerType,
                hasSchema: !!(schema as any)._def.schema,
                hasShape: !!(schema as any)._def.shape,
                keys: Object.keys((schema as any)._def),
            } : 'no _def',
        });
    }

    // Handle undefined zodType - might be a converted MCP schema or empty Zod object
    if (!zodType) {
        // Check if this is a Zod object by looking for shape property
        if (zodDef?.shape !== undefined) {
            log.info('✅ Detected ZodObject from shape property (missing typeName)', {
                context: parentContext || 'unknown',
                hasShape: true,
            });
            zodType = 'ZodObject';
        }
        // Infer type from _def structure (for MCP-converted schemas)
        else if (zodDef?.type) {
            // Map _def.type to ZodType names
            const typeMap: Record<string, string> = {
                'object': 'ZodObject',
                'string': 'ZodString',
                'number': 'ZodNumber',
                'boolean': 'ZodBoolean',
                'array': 'ZodArray',
            };

            zodType = typeMap[zodDef.type];

            if (zodType) {
                log.info(`✅ Inferred type: ${zodType} from _def.type="${zodDef.type}"`);
            } else {
                log.warn(`⚠️ Unknown _def.type: ${zodDef.type}, defaulting to STRING`, {
                    context: parentContext || 'unknown',
                });
                return {
                    type: SchemaType.STRING,
                } as any;
            }
        } else {
            log.warn('⚠️ Cannot infer type, defaulting to STRING', {
                context: parentContext || 'unknown',
                hasDef: !!zodDef,
                defKeys: zodDef ? Object.keys(zodDef) : [],
            });
            return {
                type: SchemaType.STRING,
            } as any;
        }
    }

    // Handle ZodOptional by unwrapping (shouldn't reach here after unwrap, but keep for safety)
    if (zodType === 'ZodOptional') {
        return zodToGeminiAPISchema(zodDef.innerType, `${parentContext || 'schema'}.optional`);
    }

    // Handle ZodDefault by unwrapping (shouldn't reach here after unwrap, but keep for safety)
    if (zodType === 'ZodDefault') {
        return zodToGeminiAPISchema(zodDef.innerType, `${parentContext || 'schema'}.default`);
    }

    const result: FunctionDeclarationSchemaProperty = {
        type: getSchemaType(zodType),
    } as any;

    // Add description if available - check both original schema and unwrapped
    const description = extractDescription(schema) || extractDescription(unwrapped);
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
                (result as any).items = zodToGeminiAPISchema(zodDef.type, `${parentContext || 'schema'}.array.items`);
            }
            break;

        case 'ZodObject':
            // Convert object properties
            // Handle both native Zod schemas (shape is a function) and converted schemas (shape is an object)
            let shape: any;
            if (typeof zodDef.shape === 'function') {
                shape = zodDef.shape();
            } else if (typeof zodDef.shape === 'object') {
                // For MCP-converted schemas, shape is already the object
                shape = zodDef.shape;
            } else {
                log.warn(`⚠️ No valid shape found for ZodObject at ${parentContext || 'schema'}`);
                shape = {};
            }

            const properties: Record<string, FunctionDeclarationSchemaProperty> = {};
            const required: string[] = [];

            log.info(`🔍 Processing ZodObject for ${parentContext || 'schema'}`, {
                hasShape: !!shape,
                shapeType: typeof shape,
                shapeIsFunction: typeof zodDef.shape === 'function',
                shapeKeys: shape ? Object.keys(shape) : [],
            });

            // Handle empty objects gracefully
            if (shape && typeof shape === 'object') {
                for (const [key, value] of Object.entries(shape)) {
                    // Skip undefined or null values
                    if (!value) {
                        log.warn(`⚠️ Skipping property ${key} with undefined/null value`, {
                            parentContext: parentContext || 'schema',
                            propertyName: key,
                        });
                        continue;
                    }

                    const zodValue = value as z.ZodSchema;
                    const unwrappedValue = unwrapZodSchema(zodValue);
                    const valueTypeName = unwrappedValue?._def?.typeName || (zodValue as any)?._def?.typeName || 'unknown';

                    log.info(`  📝 Processing property: ${key}`, {
                        valueType: valueTypeName,
                        hasDescription: !!(zodValue as any)?._def?.description,
                    });

                    properties[key] = zodToGeminiAPISchema(zodValue, `${parentContext || 'schema'}.${key}`);

                    // Track required fields (not optional, not with default)
                    if (!isOptional(zodValue) && (zodValue as any)._def?.typeName !== 'ZodDefault') {
                        required.push(key);
                    }
                }
            }

            log.info(`✅ ZodObject processed for ${parentContext || 'schema'}`, {
                propertyCount: Object.keys(properties).length,
                requiredCount: required.length,
                propertyNames: Object.keys(properties),
            });

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
                log.warn('⚠️ ZodUnion detected, using first option only', {
                    context: parentContext || 'schema',
                    optionCount: zodDef.options.length,
                });
                return zodToGeminiAPISchema(zodDef.options[0], `${parentContext || 'schema'}.union[0]`);
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
 * Convert a tool definition from AI SDK v6 format to Gemini API format
 */
export function convertToolToGeminiAPIFormat(
    toolName: string,
    toolDef: ToolDefinition
): FunctionDeclaration {
    try {
        log.info(`🔄 Converting tool: ${toolName}`);

        // AI SDK v6: Use inputSchema instead of parameters
        const inputSchema = toolDef.inputSchema;

        // Log the input schema for debugging
        const schemaType = (inputSchema as any)?._def?.typeName;
        log.info(`📋 Tool ${toolName} schema type: ${schemaType}`, {
            hasInputSchema: !!inputSchema,
            hasDef: !!(inputSchema as any)?._def,
            schemaTypeName: schemaType,
        });

        // Convert the Zod schema to Gemini API schema
        const parametersSchema = zodToGeminiAPISchema(inputSchema, toolName);

        // Build parameters object carefully, only including defined fields
        // This prevents undefined values from appearing in the serialized JSON
        const parameters: FunctionDeclarationSchema = {
            type: SchemaType.OBJECT,
            properties: (parametersSchema as any).properties || {},
        };

        // Only add optional fields if they have actual values (not undefined)
        const requiredFields = (parametersSchema as any).required;
        if (requiredFields && Array.isArray(requiredFields) && requiredFields.length > 0) {
            parameters.required = requiredFields;
        }

        const schemaDescription = parametersSchema.description;
        if (schemaDescription && typeof schemaDescription === 'string') {
            parameters.description = schemaDescription;
        }

        // Create the function declaration
        const functionDeclaration: FunctionDeclaration = {
            name: toolName,
            description: toolDef.description,
            parameters,
        };

        log.info(`✅ Converted tool: ${toolName}`, {
            hasDescription: !!toolDef.description,
            descriptionPreview: toolDef.description?.substring(0, 50),
            propertyCount: Object.keys(parameters.properties || {}).length,
            hasRequired: !!parameters.required,
            requiredCount: parameters.required?.length || 0,
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
            const declaration = convertToolToGeminiAPIFormat(toolName, toolDef);
            declarations.push(declaration);
        } catch (error) {
            log.error(`❌ Skipping tool due to conversion error: ${toolName}`, error);
        }
    });

    log.info(`📦 Converted ${declarations.length} tools to Gemini API format`);
    return declarations;
}

/**
 * Converts all registered tools to Gemini API format
 * Accepts the tools object returned by getAllTools()
 */
export function convertAllTools(
    tools: Record<string, { description: string; inputSchema: z.ZodSchema; execute: (args: any) => Promise<any> }>
): FunctionDeclaration[] {
    const declarations: FunctionDeclaration[] = [];

    for (const [toolName, toolDef] of Object.entries(tools)) {
        try {
            // Validate that description exists
            if (!toolDef.description) {
                log.warn(`⚠️ Tool ${toolName} has no description, using fallback`);
            }

            // Convert to ToolDefinition format (AI SDK v6: inputSchema)
            const normalizedTool: ToolDefinition = {
                name: toolName,
                description: toolDef.description || `Tool: ${toolName}`,
                inputSchema: toolDef.inputSchema, // AI SDK v6: inputSchema
                execute: toolDef.execute,
            };

            const declaration = convertToolToGeminiAPIFormat(toolName, normalizedTool);
            declarations.push(declaration);
        } catch (error) {
            log.error(`❌ Skipping tool due to conversion error: ${toolName}`, error);
        }
    }

    log.info(`📦 Converted ${declarations.length} tools to Gemini API format`);
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
    log.info(`\n=== Testing ${name} ===`);
    log.info('Input Zod Schema:', schema);

    const result = zodToGeminiAPISchema(schema);
    log.info('Output Gemini API Schema:', JSON.stringify(result, null, 2));

    const validation = validateFunctionDeclaration({
        name,
        description: 'Test function',
        parameters: {
            type: SchemaType.OBJECT,
            properties: (result as any).properties || {},
        },
    });
    log.info('Validation:', validation);
}

/**
 * Convert Zod schema to JSON Schema format
 * Used for sending tool schemas to the backend API
 */
export function zodToJsonSchema(schema: z.ZodSchema, parentContext?: string): Record<string, unknown> {
    // First unwrap any wrapper types (describe, optional, default, etc.)
    const unwrapped = unwrapZodSchema(schema);
    const zodDef = unwrapped?._def;
    let zodType = zodDef?.typeName;

    // Handle undefined zodType
    if (!zodType) {
        if (zodDef?.shape !== undefined) {
            zodType = 'ZodObject';
        } else if (zodDef?.type) {
            const typeMap: Record<string, string> = {
                'object': 'ZodObject',
                'string': 'ZodString',
                'number': 'ZodNumber',
                'boolean': 'ZodBoolean',
                'array': 'ZodArray',
            };
            zodType = typeMap[zodDef.type];
        }
        
        if (!zodType) {
            return { type: 'string' };
        }
    }

    // Handle ZodOptional by unwrapping
    if (zodType === 'ZodOptional') {
        return zodToJsonSchema(zodDef.innerType, `${parentContext || 'schema'}.optional`);
    }

    // Handle ZodDefault by unwrapping
    if (zodType === 'ZodDefault') {
        return zodToJsonSchema(zodDef.innerType, `${parentContext || 'schema'}.default`);
    }

    const result: Record<string, unknown> = {};

    // Add description if available
    const description = extractDescription(schema) || extractDescription(unwrapped);
    if (description) {
        result.description = description;
    }

    // Map Zod types to JSON Schema types
    switch (zodType) {
        case 'ZodString':
            result.type = 'string';
            break;

        case 'ZodNumber':
            result.type = 'number';
            break;

        case 'ZodBoolean':
            result.type = 'boolean';
            break;

        case 'ZodArray':
            result.type = 'array';
            if (zodDef.type) {
                result.items = zodToJsonSchema(zodDef.type, `${parentContext || 'schema'}.array.items`);
            }
            break;

        case 'ZodObject': {
            result.type = 'object';
            
            let shape: any;
            if (typeof zodDef.shape === 'function') {
                shape = zodDef.shape();
            } else if (typeof zodDef.shape === 'object') {
                shape = zodDef.shape;
            } else {
                shape = {};
            }

            const properties: Record<string, unknown> = {};
            const required: string[] = [];

            if (shape && typeof shape === 'object') {
                for (const [key, value] of Object.entries(shape)) {
                    if (!value) continue;

                    const zodValue = value as z.ZodSchema;
                    properties[key] = zodToJsonSchema(zodValue, `${parentContext || 'schema'}.${key}`);

                    // Track required fields
                    if (!isOptional(zodValue) && (zodValue as any)?._def?.typeName !== 'ZodDefault') {
                        required.push(key);
                    }
                }
            }

            result.properties = properties;
            if (required.length > 0) {
                result.required = required;
            }
            break;
        }

        case 'ZodEnum':
            result.type = 'string';
            if (zodDef.values && Array.isArray(zodDef.values)) {
                result.enum = zodDef.values;
            }
            break;

        case 'ZodUnion':
            // For unions, use first option as simplification
            if (zodDef.options && zodDef.options.length > 0) {
                return zodToJsonSchema(zodDef.options[0], `${parentContext || 'schema'}.union[0]`);
            }
            result.type = 'string';
            break;

        case 'ZodLiteral':
            result.type = typeof zodDef.value;
            result.enum = [zodDef.value];
            break;

        case 'ZodNull':
            result.type = 'null';
            break;

        default:
            result.type = 'string';
    }

    return result;
}
