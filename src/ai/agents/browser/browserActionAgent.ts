/**
 * Browser Action Agent for Gemini Live
 * 
 * This agent acts as an intermediary between Gemini Live models (which struggle with
 * structured tool calling) and the actual browser action tools.
 * 
 * Problem: Gemini Live models are optimized for voice conversation, not structured
 * function calling with precise parameter formats.
 * 
 * Solution: Use a regular Gemini model (excellent at tool calling) as an agent that:
 * 1. Receives natural language task descriptions from the Live model
 * 2. Determines which tools to use and with what parameters
 * 3. Executes the tools and returns results
 * 
 * The Live model only needs to describe WHAT to do, this agent figures out HOW.
 */

// Migrated to @google/genai with provider-aware initialization
// Uses client.chats.create() for multi-turn conversation with function calling
import { Type as SchemaType } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';
import { createLogger } from '~logger';
import { getAllTools } from '../../tools/registryUtils';
import { convertAllTools } from '../../geminiLive/toolConverter';
import { getYouTubeTranscript } from '../youtube';
import { BROWSER_ACTION_AGENT_SYSTEM_INSTRUCTION, BROWSER_ACTION_TOOL_DESCRIPTION } from './prompts';
import { initializeGenAIClient } from '../../core/genAIFactory';

const log = createLogger('Browser-Action-Agent');

// Execution tracking to prevent duplicate task execution
const executionTracker = new Map<string, { timestamp: number; promise: Promise<string> }>();
const EXECUTION_DEDUPE_WINDOW_MS = 3000; // 3 seconds

/**
 * Generate a stable hash for a task to detect duplicates
 */
function getTaskHash(taskDescription: string): string {
    // Normalize the task description for comparison
    return taskDescription.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if a task is already executing
 */
function getExecutingTask(taskHash: string): Promise<string> | null {
    const existing = executionTracker.get(taskHash);
    if (!existing) return null;

    const age = Date.now() - existing.timestamp;
    if (age > EXECUTION_DEDUPE_WINDOW_MS) {
        // Stale entry, clean it up
        executionTracker.delete(taskHash);
        return null;
    }

    log.info('🔄 Task already executing, reusing promise', { taskHash, age });
    return existing.promise;
}

/**
 * Track a new task execution
 */
function trackExecution(taskHash: string, promise: Promise<string>): void {
    executionTracker.set(taskHash, {
        timestamp: Date.now(),
        promise
    });

    // Auto-cleanup after deduplication window
    setTimeout(() => {
        executionTracker.delete(taskHash);
    }, EXECUTION_DEDUPE_WINDOW_MS);
}

/**
 * Execute a browser action task using an intelligent agent
 * @param taskDescription - Natural language description of what to do
 * @param abortSignal - Optional abort signal to cancel the operation
 * @returns Result of executing the task
 */
async function executeBrowserTask(taskDescription: string, abortSignal?: AbortSignal): Promise<string> {
    // Check if aborted before starting
    if (abortSignal?.aborted) {
        log.info('🛑 Browser action agent aborted before execution');
        throw new Error('Operation cancelled');
    }

    const taskHash = getTaskHash(taskDescription);

    // Check if this exact task is already executing
    const existingExecution = getExecutingTask(taskHash);
    if (existingExecution) {
        log.info('⏭️ Duplicate task detected, waiting for existing execution', { taskDescription });
        return existingExecution;
    }

    log.info('🤖 Browser Action Agent received NEW task', { taskDescription, taskHash });

    // Create and track the execution promise
    const executionPromise = (async () => {
        try {
            // Check abort signal periodically
            if (abortSignal?.aborted) {
                log.info('🛑 Browser action agent aborted during setup');
                throw new Error('Operation cancelled');
            }
            // Initialize Gen AI client with provider awareness (supports Google AI and Vertex AI)
            const client = await initializeGenAIClient();

            // Get all available browser tools (excluding MCP tools and this agent itself)
            const allTools = getAllTools();
            const availableTools: Record<string, any> = {};

            for (const [name, tool] of Object.entries(allTools)) {
                // Filter out:
                // - MCP tools (start with 'mcp_')
                // - This agent itself ('executeBrowserAction')
                // - YouTube agent ('youtubeAgent')
                // - Memory tools (saveMemory, getMemory, listMemories, deleteMemory, suggestSaveMemory)
                const isMemoryTool = [
                    'saveMemory',
                    'getMemory',
                    'listMemories',
                    'deleteMemory',
                    'suggestSaveMemory'
                ].includes(name);

                if (!name.startsWith('mcp_') &&
                    name !== 'executeBrowserAction' &&
                    name !== 'youtubeAgent' &&
                    !isMemoryTool) {
                    availableTools[name] = tool;
                }
            }

            // Add YouTube transcript tool (it's an agent tool, not in registry)
            availableTools['getYouTubeTranscript'] = getYouTubeTranscript;

            const toolNames = Object.keys(availableTools);
            log.info('Available tools for agent', { count: toolNames.length, tools: toolNames });

            if (toolNames.length === 0) {
                return 'No browser tools are currently available. Please ensure the extension has loaded properly.';
            }

            // Convert browser tools to Gemini format
            const geminiToolDeclarations = convertAllTools(availableTools);

            // Use the centralized system instruction from prompts.ts
            // This prompt tells the agent HOW to execute browser automation tasks
            const systemInstruction = BROWSER_ACTION_AGENT_SYSTEM_INSTRUCTION;

            // Create a chat session with tool calling capabilities AND system instruction
            const chat = client.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: systemInstruction,
                    tools: [{ functionDeclarations: geminiToolDeclarations }],
                }
            });

            // Send the task
            log.info('📤 Sending task to agent model', { taskDescription });
            let response = await chat.sendMessage({ message: taskDescription });

            // Log initial response
            log.info('📥 Received initial response from model', {
                hasFunctionCalls: !!response?.functionCalls?.length,
                functionCallCount: response?.functionCalls?.length || 0,
                hasText: !!response?.text
            });

            let iterations = 0;
            const maxIterations = 10; // FIXED: Was 0, should be at least 5-10 for multi-step tasks

            log.info('🔄 Starting function calling loop', { maxIterations });

            // Handle function calling loop
            while (iterations < maxIterations) {
                // Check abort signal at start of each iteration
                if (abortSignal?.aborted) {
                    log.info('🛑 Browser action agent aborted during iteration', { iteration: iterations });
                    throw new Error('Operation cancelled');
                }

                // Safety check for response object
                if (!response) {
                    log.error('❌ Response is undefined in function calling loop', { iteration: iterations });
                    break;
                }

                const functionCalls = response.functionCalls;

                log.info(`🔍 Iteration ${iterations + 1}/${maxIterations} - Checking for function calls`, {
                    hasFunctionCalls: !!functionCalls,
                    functionCallCount: functionCalls?.length || 0
                });

                if (!functionCalls || functionCalls.length === 0) {
                    // No more function calls, we have the final response
                    log.info('✅ No more function calls - agent has final response');
                    break;
                }

                iterations++;
                log.info(`🔧 Iteration ${iterations}: Executing ${functionCalls.length} tool(s)`, {
                    tools: functionCalls.map(fc => ({ name: fc.name, args: fc.args }))
                });

                // Execute all function calls
                const functionResponses = [];

                for (const fc of functionCalls) {
                    const toolName = fc.name!; // Function call name is always defined
                    const toolArgs = fc.args;

                    log.info(`🔨 Executing tool: ${toolName}`, {
                        args: toolArgs,
                        toolType: 'Browser Tool'
                    });

                    try {
                        let toolResult;

                        // Handle regular browser tools (including getYouTubeTranscript)
                        const tool = availableTools[toolName];
                        if (!tool) {
                            throw new Error(`Tool not found: ${toolName}`);
                        }
                        log.info('🌐 Executing browser tool...', { toolName });
                        toolResult = await tool.execute(toolArgs);
                        log.info('✅ Browser tool completed', {
                            toolName,
                            resultLength: JSON.stringify(toolResult).length,
                            hasResult: !!toolResult
                        });

                        log.info(`✅ Tool ${toolName} completed successfully`, {
                            resultType: typeof toolResult,
                            resultPreview: JSON.stringify(toolResult).substring(0, 200) + '...'
                        });

                        functionResponses.push({
                            name: toolName,
                            response: toolResult,
                        });
                    } catch (error) {
                        log.error(`❌ Tool ${toolName} failed`, {
                            error: error instanceof Error ? error.message : String(error),
                            stack: error instanceof Error ? error.stack : undefined
                        });
                        functionResponses.push({
                            name: toolName,
                            response: {
                                error: error instanceof Error ? error.message : String(error),
                            },
                        });
                    }
                }

                // Send function responses back - need to wrap in correct format
                log.info('📤 Sending function responses back to model', {
                    responseCount: functionResponses.length,
                    responses: functionResponses.map(fr => ({
                        name: fr.name,
                        hasError: !!(fr.response as any)?.error,
                        responsePreview: JSON.stringify(fr.response).substring(0, 100) + '...'
                    }))
                });

                // Send function responses using the new SDK format
                response = await chat.sendMessage({
                    message: functionResponses.map(fr => ({
                        functionResponse: {
                            name: fr.name,
                            response: fr.response,
                        }
                    }))
                });

                log.info('📥 Received next response from model', {
                    iteration: iterations,
                    hasFunctionCalls: !!response?.functionCalls?.length,
                    functionCallCount: response?.functionCalls?.length || 0,
                    hasText: !!response?.text
                });
            }

            if (iterations >= maxIterations) {
                log.warn('⚠️ Max iterations reached in agent loop', {
                    maxIterations,
                    lastResponseHadCalls: !!response?.functionCalls?.length
                });
            }

            // Get final text response with null safety
            if (!response || !response.text) {
                log.error('❌ Invalid response object - cannot extract text', {
                    hasResponse: !!response,
                    responseType: typeof response,
                    responseKeys: response ? Object.keys(response) : []
                });
                throw new Error('Browser Action Agent received an invalid response from the model');
            }

            const finalResponse = response.text;
            log.info('✅ Browser Action Agent completed', {
                iterations,
                responseLength: finalResponse.length,
                responsePreview: finalResponse.substring(0, 200) + (finalResponse.length > 200 ? '...' : '')
            });

            return finalResponse;

        } catch (error) {
            log.error('❌ Browser Action Agent error', error);
            return `I encountered an error while trying to execute the task: ${error instanceof Error ? error.message : String(error)}`;
        }
    })();

    // Track this execution
    trackExecution(taskHash, executionPromise);

    // Return the execution promise
    return executionPromise;
}

/**
 * Browser Action Agent Tool Declaration for Gemini Live API
 * This is in the native Gemini Live format, not AI SDK format
 * 
 * NOTE: Description is loaded from centralized prompts.ts file
 */
export const browserActionAgentDeclaration: FunctionDeclaration = {
    name: 'executeBrowserAction',
    description: BROWSER_ACTION_TOOL_DESCRIPTION,
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            taskDescription: {
                type: SchemaType.STRING,
                description: 'Natural language description of the browser task to perform, INCLUDING YouTube video analysis. ' +
                    'Be specific about what you want to do. ' +
                    'For typing tasks, mention both WHAT to type and WHERE to type it. ' +
                    'For video tasks, describe what you want to know about the video. ' +
                    'Examples: "Click the login button", "Type hello into the search box", ' +
                    '"Navigate to github.com", "Read the page content", ' +
                    '"Summarize this YouTube video", "What are the key points in this video?"'
            }
        },
        required: ['taskDescription']
    }
};

/**
 * Browser Action Agent Executor
 * This function executes the agent with the given parameters
 */
export async function executeBrowserActionAgent(args: { taskDescription: string }, abortSignal?: AbortSignal): Promise<any> {
    log.info('🎯 Browser Action Agent called', { taskDescription: args.taskDescription });

    try {
        const result = await executeBrowserTask(args.taskDescription, abortSignal);

        return {
            success: true,
            result,
            taskDescription: args.taskDescription,
        };

    } catch (error) {
        log.error('❌ Browser Action Agent error', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            taskDescription: args.taskDescription,
        };
    }
}

