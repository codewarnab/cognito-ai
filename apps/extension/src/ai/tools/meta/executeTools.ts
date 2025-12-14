/**
 * Execute Tools - Meta-tool for Adaptive Mode
 * 
 * Allows the AI to write JavaScript code that orchestrates multiple tool calls
 * in a single execution step, reducing round-trips and improving efficiency.
 * 
 * Security: Code is validated using AST analysis before execution.
 */

import { z } from 'zod';
import { createLogger } from '~logger';
import { validateCode } from './validateCode';
import { getAllTools } from '../registryUtils';
import { getMCPToolsFromBackground } from '../../mcp/proxy';
import { getWebMCPToolsFromBackground } from '../webmcpTools';

const log = createLogger('ExecuteTools');

/**
 * Execute validated JavaScript code with access to tools
 */
async function executeToolsCode(
    code: string,
    abortSignal?: AbortSignal
): Promise<{ output: string; success: boolean; error?: string }> {
    try {
        // Step 1: Validate the code before execution
        const validation = validateCode(code);
        if (!validation.isValid) {
            const errorMsg = `Code validation failed:\n${validation.errors.join('\n')}`;
            log.warn('Code validation failed:', validation.errors);
            return {
                output: errorMsg,
                success: false,
                error: 'VALIDATION_FAILED',
            };
        }

        // Step 2: Gather all available tools
        const extensionTools = getAllTools(abortSignal);

        // Get MCP tools
        let mcpTools: Record<string, any> = {};
        try {
            const mcpManager = await getMCPToolsFromBackground();
            mcpTools = mcpManager.tools || {};
        } catch (error) {
            log.debug('MCP tools unavailable for execution:', error);
        }

        // Get WebMCP tools
        let webmcpTools: Record<string, any> = {};
        try {
            const webmcpResult = await getWebMCPToolsFromBackground();
            webmcpTools = webmcpResult.tools || {};
        } catch (error) {
            log.debug('WebMCP tools unavailable for execution:', error);
        }

        // Combine all tools
        const allTools = { ...extensionTools, ...mcpTools, ...webmcpTools };

        // Step 3: Wrap tools so they can be called directly as functions
        // IMPORTANT: We wrap in anonymous functions to prevent toString() from exposing implementation
        const wrappedTools: Record<string, any> = {};
        for (const [name, tool] of Object.entries(allTools)) {
            // Create a wrapper function that hides the original implementation
            const wrapper = async (...args: any[]) => {
                // Check abort before each tool call
                if (abortSignal?.aborted) {
                    throw new Error('Operation cancelled');
                }
                log.info(`Executing tool from code: ${name}`, { args });
                // Handle both direct call and .execute() patterns
                return await tool.execute(...args);
            };

            // Make the tool callable directly
            wrappedTools[name] = wrapper;

            // Also keep the original structure for tools.name.execute() pattern
            wrappedTools[name].execute = wrapper;
            wrappedTools[name].description = tool.description;
        }

        log.info('Executing code with tools:', {
            codeLength: code.length,
            availableTools: Object.keys(wrappedTools).length,
        });

        // Step 4: Create the async function with tools in scope
        // eslint-disable-next-line no-new-func
        const asyncFunc = new Function(
            'tools',
            `return (async () => {
${code}
            })();`
        );

        // Step 5: Execute the function with the wrapped tools context
        const result = await asyncFunc(wrappedTools);

        // Step 6: Format and return the result
        const output =
            typeof result === 'object'
                ? JSON.stringify(result, null, 2)
                : String(result ?? 'undefined');

        log.info('Code execution completed:', {
            outputLength: output.length,
            resultType: typeof result,
        });

        return {
            output,
            success: true,
        };
    } catch (error: any) {
        log.error('Code execution failed:', error);
        return {
            output: `Error: ${error.message}`,
            success: false,
            error: error.message,
        };
    }
}

/**
 * executeTools tool definition for AI SDK
 */
export const executeTools = {
    description: `Execute JavaScript code with access to all available tools via the 'tools' object.
    
SECURITY RULES:
- Code is validated before execution using AST analysis
- Blocked: require, import, eval, Function constructor, process, global, setTimeout, while loops
- Only use this to call the available tools and return their results

HOW TO USE:
1. First use discoverTools to find the tools you need
2. Write JavaScript code that calls those tools
3. Return the result you want

EXAMPLE:
\`\`\`javascript
const weather = await tools.getCurrentWeather({ location: "NYC" });
const result = await tools.sendEmail({
    to: "user@example.com",
    subject: "Weather Update",
    body: \`Temperature: \${weather.temperature}°F\`
});
return result;
\`\`\`

TIPS:
- All tool calls must use await (they're async)
- Use tools.toolName({ param1: value1 }) format
- Return the data you want to access
- Can use for loops and Promise.all for parallel execution`,

    inputSchema: z.object({
        code: z.string().describe(
            'JavaScript code to execute. Must use await for tool calls. Return the result.'
        ),
    }),

    execute: async (input: { code: string }, abortSignal?: AbortSignal) => {
        return await executeToolsCode(input.code, abortSignal);
    },
};
