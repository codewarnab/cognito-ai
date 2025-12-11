/**
 * WebMCP Tools Converter
 * Converts WebMCP tools discovered from websites to AI SDK tool format
 * 
 * Similar to MCP proxy, but for browser-based WebMCP tools from the active tab.
 * Tools are discovered by the content script and managed by the background service.
 */

import { z } from 'zod';
import { createLogger } from '~logger';
import type { WebMCPTool } from '@/types/webmcp';

const log = createLogger('WebMCP-Tools', 'WEBMCP');

/**
 * Convert JSON Schema to Zod schema
 * Handles the inputSchema from WebMCP tools
 */
function convertToZodSchema(inputSchema: unknown): z.ZodObject<Record<string, z.ZodTypeAny>> {
  if (!inputSchema || typeof inputSchema !== 'object') {
    return z.object({});
  }

  const schema = inputSchema as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };

  if (schema.type !== 'object' || !schema.properties) {
    return z.object({});
  }

  const properties = schema.properties;
  const required = schema.required || [];
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, propValue] of Object.entries(properties)) {
    const prop = propValue as {
      type?: string;
      description?: string;
      items?: unknown;
      properties?: Record<string, unknown>;
    };

    let zodType: z.ZodTypeAny;

    switch (prop.type) {
      case 'string':
        zodType = z.string();
        break;
      case 'number':
      case 'integer':
        zodType = z.number();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      case 'array':
        zodType = z.array(z.any());
        break;
      case 'object':
        zodType = z.object({}).passthrough();
        break;
      default:
        zodType = z.any();
    }

    // Add description if available
    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }

    // Make optional if not in required array
    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return z.object(shape);
}


/**
 * Convert WebMCP tools to AI SDK tool format
 * Creates proxy executors that route tool calls through the background service
 * 
 * @param webmcpTools - Array of WebMCP tools from the active tab
 * @returns Record of AI SDK compatible tools
 */
export function convertWebMCPToolsToAITools(
  webmcpTools: WebMCPTool[]
): Record<string, unknown> {
  const tools: Record<string, unknown> = {};

  for (const webmcpTool of webmcpTools) {
    const toolName = webmcpTool.name;

    try {
      // Convert input schema to Zod
      const zodSchema = convertToZodSchema(webmcpTool.inputSchema);

      // Create tool in AI SDK format with proxy executor
      tools[toolName] = {
        description: `[WebMCP - ${webmcpTool.domain}] ${webmcpTool.description || 'No description'}`,
        inputSchema: zodSchema,
        execute: async (args: Record<string, unknown>) => {
          log.info(`🌐 Executing WebMCP tool: ${toolName}`, {
            domain: webmcpTool.domain,
            originalName: webmcpTool.originalName,
            args,
          });

          try {
            // Execute via background service worker
            const response = await chrome.runtime.sendMessage({
              type: 'webmcp/tool/call',
              payload: {
                toolName,
                args,
              },
            });

            if (!response?.success) {
              const errorMsg = response?.error || 'Tool execution failed';
              log.error(`❌ WebMCP tool failed: ${toolName}`, { error: errorMsg });

              // Return error in AI-friendly format
              return {
                error: true,
                message: errorMsg,
                toolName,
                domain: webmcpTool.domain,
                feedback: `The WebMCP tool "${webmcpTool.originalName}" from ${webmcpTool.domain} failed: ${errorMsg}. The website's tool may be unavailable or the parameters may be incorrect.`,
              };
            }

            log.info(`✅ WebMCP tool succeeded: ${toolName}`);
            return response.result;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            log.error(`❌ WebMCP tool error: ${toolName}`, { error: errorMsg });

            return {
              error: true,
              message: errorMsg,
              toolName,
              domain: webmcpTool.domain,
              feedback: `Failed to execute WebMCP tool "${webmcpTool.originalName}": ${errorMsg}`,
            };
          }
        },
      };

      log.debug(`✅ Converted WebMCP tool: ${toolName}`, {
        originalName: webmcpTool.originalName,
        domain: webmcpTool.domain,
        hasDescription: !!webmcpTool.description,
        hasInputSchema: !!webmcpTool.inputSchema,
      });
    } catch (error) {
      log.error(`❌ Failed to convert WebMCP tool: ${toolName}`, { error });
    }
  }

  log.info('🌐 Converted WebMCP tools', {
    count: Object.keys(tools).length,
    names: Object.keys(tools),
  });

  return tools;
}

/**
 * Get WebMCP tools from background service worker
 * Fetches the current active tab's WebMCP tools
 * 
 * @returns Promise with tools record and metadata
 */
export async function getWebMCPToolsFromBackground(): Promise<{
  tools: Record<string, unknown>;
  rawTools: WebMCPTool[];
  domain: string | null;
}> {
  log.info('🔍 Fetching WebMCP tools from background...');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'webmcp/tools/list',
    });

    if (!response?.success) {
      log.warn('⚠️ Failed to fetch WebMCP tools:', response?.error);
      return { tools: {}, rawTools: [], domain: null };
    }

    const rawTools: WebMCPTool[] = response.data?.tools || [];
    
    if (rawTools.length === 0) {
      log.debug('No WebMCP tools available on active tab');
      return { tools: {}, rawTools: [], domain: null };
    }

    const domain = rawTools[0]?.domain || null;
    const tools = convertWebMCPToolsToAITools(rawTools);

    log.info(`📦 Loaded ${rawTools.length} WebMCP tools from ${domain}`);

    return { tools, rawTools, domain };
  } catch (error) {
    log.error('❌ Error fetching WebMCP tools:', error);
    return { tools: {}, rawTools: [], domain: null };
  }
}
