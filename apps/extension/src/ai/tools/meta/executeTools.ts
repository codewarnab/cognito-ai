/**
 * Execute Tools - Meta-tool for Adaptive Mode
 * 
 * Allows the AI to write JavaScript code that orchestrates multiple tool calls
 * in a single execution step, reducing round-trips and improving efficiency.
 * 
 * Security: Code is validated using AST analysis before execution.
 * Execution: Code is executed in a sandboxed iframe to comply with MV3 CSP.
 */

import { z } from 'zod';
import { createLogger } from '~logger';
import { validateCode } from './validateCode';
import { getAllTools } from '../registryUtils';
import { getMCPToolsFromBackground } from '../../mcp/proxy';
import { getWebMCPToolsFromBackground } from '../webmcpTools';
import { executeInSandbox, type ExecutionResult } from './SandboxBridge';

const log = createLogger('ExecuteTools');

/** Store for active abort controllers to cancel pending sandbox operations */
const pendingOperations = new Map<string, { cancelled: boolean }>();

/**
 * Execute validated JavaScript code with access to tools via sandbox.
 * Uses the SandboxBridge to execute code in an isolated iframe that permits
 * `new Function()` and `eval()`, which are blocked by MV3 CSP in extension pages.
 */
async function executeToolsCode(
    code: string,
    abortSignal?: AbortSignal
): Promise<{ output: string; success: boolean; error?: string }> {
    // Generate a unique operation ID for abort tracking
    const operationId = `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const operationState = { cancelled: false };
    pendingOperations.set(operationId, operationState);

    try {
        // Step 1: Validate the code before sending to sandbox
        // This runs in the main thread BEFORE code is sent to sandbox
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

        // Check abort signal before proceeding
        if (abortSignal?.aborted) {
            return {
                output: 'Operation cancelled',
                success: false,
                error: 'ABORTED',
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
        const availableToolNames = Object.keys(allTools);

        log.info('Executing code via sandbox with tools:', {
            codeLength: code.length,
            availableTools: availableToolNames.length,
        });

        // Step 3: Create the tool executor callback
        // This is called by the sandbox bridge when code calls a tool
        const toolExecutor = async (toolName: string, args: unknown[]): Promise<unknown> => {
            // Check abort signal before executing tool
            if (abortSignal?.aborted || operationState.cancelled) {
                throw new Error('Operation cancelled');
            }

            const tool = allTools[toolName];
            if (!tool) {
                throw new Error(`Tool not found: ${toolName}`);
            }

            log.info(`Executing tool from sandbox: ${toolName}`, { args });

            // Execute the tool - args is an array, typically with a single object argument
            const result = await tool.execute(...args);
            return result;
        };

        // Step 4: Set up abort signal listener
        const abortHandler = () => {
            operationState.cancelled = true;
            log.info('Operation aborted by signal');
        };

        if (abortSignal) {
            abortSignal.addEventListener('abort', abortHandler, { once: true });
        }

        try {
            // Step 5: Execute code in the sandbox with abort signal support
            const sandboxResult: ExecutionResult = await executeInSandbox(
                code,
                availableToolNames,
                toolExecutor,
                { abortSignal }
            );

            // Step 6: Format and return the result
            if (!sandboxResult.success) {
                // Include detailed error information from sandbox
                let errorOutput = sandboxResult.error || 'Unknown sandbox error';

                // Add error details if available
                if (sandboxResult.errorDetails) {
                    errorOutput += `\n\nError Type: ${sandboxResult.errorDetails.type}`;
                    if (sandboxResult.errorDetails.context) {
                        errorOutput += `\nContext: ${JSON.stringify(sandboxResult.errorDetails.context, null, 2)}`;
                    }
                }

                return {
                    output: errorOutput,
                    success: false,
                    error: sandboxResult.errorCode || sandboxResult.error,
                };
            }

            const output =
                typeof sandboxResult.result === 'object'
                    ? JSON.stringify(sandboxResult.result, null, 2)
                    : String(sandboxResult.result ?? 'undefined');

            log.info('Sandbox code execution completed:', {
                outputLength: output.length,
                resultType: typeof sandboxResult.result,
            });

            return {
                output,
                success: true,
            };
        } finally {
            // Clean up abort listener
            if (abortSignal) {
                abortSignal.removeEventListener('abort', abortHandler);
            }
        }
    } catch (error: any) {
        log.error('Code execution failed:', error);
        return {
            output: `Error: ${error.message}`,
            success: false,
            error: error.message,
        };
    } finally {
        // Clean up operation tracking
        pendingOperations.delete(operationId);
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
