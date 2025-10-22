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

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { FunctionDeclaration } from '@google/generative-ai';
import { createLogger } from '../../logger';
import { getAllTools } from '../toolRegistryUtils';
import { convertAllTools } from '../geminiLive/toolConverter';
import { analyzeYouTubeVideoDeclaration, executeYouTubeAnalysis } from './youtubeAgentTool';
import { BROWSER_ACTION_AGENT_SYSTEM_INSTRUCTION, BROWSER_ACTION_TOOL_DESCRIPTION } from './prompts';

const log = createLogger('Browser-Action-Agent');

// Initialize Google AI for the agent
// const apiKey = "AIzaSyAxTFyeqmms2eV9zsp6yZpCSAHGZebHzqc";
const apiKey = "AIzaSyAdqyd9kSD_12B_WQ4Fm-Qk6IcL-6p5wjE";
const genAI = new GoogleGenerativeAI(apiKey);

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
 * @returns Result of executing the task
 */
async function executeBrowserTask(taskDescription: string): Promise<string> {
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
            // Get all available browser tools (excluding MCP tools and this agent itself)
            const allTools = getAllTools();
            const availableTools: Record<string, any> = {};

            for (const [name, tool] of Object.entries(allTools)) {
                // Filter out MCP tools and the agent itself
                if (!name.startsWith('mcp_') && name !== 'executeBrowserAction' && name !== 'youtubeAgent') {
                    availableTools[name] = tool;
                }
            }

            const toolNames = Object.keys(availableTools);
            log.info('Available tools for agent', { count: toolNames.length, tools: toolNames });

            if (toolNames.length === 0) {
                return 'No browser tools are currently available. Please ensure the extension has loaded properly.';
            }

            // Convert browser tools to Gemini format
            const geminiToolDeclarations = convertAllTools(availableTools);

            // Add YouTube analysis tool declaration
            geminiToolDeclarations.push(analyzeYouTubeVideoDeclaration);

            // Use the centralized system instruction from prompts.ts
            // This prompt tells the agent HOW to execute browser automation tasks
            const systemInstruction = BROWSER_ACTION_AGENT_SYSTEM_INSTRUCTION;

            // Create the agent model with tool calling capabilities AND system instruction
            const model = genAI.getGenerativeModel({
                model: "gemini-2.0-flash",
                tools: [{ functionDeclarations: geminiToolDeclarations }],
                systemInstruction: systemInstruction,
            });

            // Start a chat session
            const chat = model.startChat({
                history: [],
            });

            // Send the task
            log.info('📤 Sending task to agent model', { taskDescription });
            const result = await chat.sendMessage(taskDescription);
            let response = result.response;

            // Log initial response
            log.info('📥 Received initial response from model', {
                hasFunctionCalls: !!response.functionCalls()?.length,
                functionCallCount: response.functionCalls()?.length || 0,
                hasText: !!response.text()
            });

            let iterations = 0;
            const maxIterations = 10; // FIXED: Was 0, should be at least 5-10 for multi-step tasks

            log.info('🔄 Starting function calling loop', { maxIterations });

            // Handle function calling loop
            while (iterations < maxIterations) {
                const functionCalls = response.functionCalls();

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
                    const toolName = fc.name;
                    const toolArgs = fc.args;

                    log.info(`🔨 Executing tool: ${toolName}`, {
                        args: toolArgs,
                        toolType: toolName === 'analyzeYouTubeVideo' ? 'YouTube Agent' : 'Browser Tool'
                    });

                    try {
                        let toolResult;

                        // Handle YouTube analysis tool separately
                        if (toolName === 'analyzeYouTubeVideo') {
                            log.info('🎥 Calling YouTube analysis tool...');
                            toolResult = await executeYouTubeAnalysis(toolArgs as { question: string; youtubeUrl?: string });
                            log.info('✅ YouTube analysis completed', {
                                resultLength: JSON.stringify(toolResult).length,
                                hasResult: !!toolResult
                            });
                        } else {
                            // Handle regular browser tools
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
                        }

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

                const nextResult = await chat.sendMessage(
                    functionResponses.map(fr => ({
                        functionResponse: {
                            name: fr.name,
                            response: fr.response,
                        }
                    }))
                );
                response = nextResult.response;

                log.info('📥 Received next response from model', {
                    iteration: iterations,
                    hasFunctionCalls: !!response.functionCalls()?.length,
                    functionCallCount: response.functionCalls()?.length || 0,
                    hasText: !!response.text()
                });
            }

            if (iterations >= maxIterations) {
                log.warn('⚠️ Max iterations reached in agent loop', {
                    maxIterations,
                    lastResponseHadCalls: !!response.functionCalls()?.length
                });
            }

            // Get final text response
            const finalResponse = response.text();
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
export async function executeBrowserActionAgent(args: { taskDescription: string }): Promise<any> {
    log.info('🎯 Browser Action Agent called', { taskDescription: args.taskDescription });

    try {
        const result = await executeBrowserTask(args.taskDescription);

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

/**
 * Get a simplified list of capabilities for the Live model's system instruction
 * This helps the Live model know what kinds of tasks it can delegate
 * 
 * NOTE: This is a CATALOG of capabilities - just lists WHAT is available.
 * HOW and WHEN to use them is defined in getGeminiLiveSystemInstruction().
 */
export function getBrowserCapabilitiesSummary(): string {
    return `You have access to a powerful browser automation agent that can handle ANY browser-related task.

**Available Capabilities:**

**🎥 YOUTUBE VIDEO ANALYSIS:**
- Summarize videos of any length (auto-chunked for long content)
- Extract key takeaways and main points
- Answer specific questions about video content
- Analyze topics, themes, and timestamps
- No URL needed (works with active tab)

**📍 NAVIGATION & BROWSING:**
- Open any URL in new tab or current tab (navigateTo)
- Navigate to websites
- Access browser history
- Get information about active tab

**🖱️ PAGE INTERACTION:**
- **Click ANY visible text** (clickByText) - buttons, links, headings, labels, any text on page
  - Fuzzy matching for typos
  - Works in shadow DOM and iframes
  - Automatically scrolls element into view and highlights it
  - Can click by element type (button, link, or any)
- **Type into ANY input field** (typeInField) - finds fields by description
  - Search by placeholder, label, aria-label, or nearby text
  - Examples: "search box", "email field", "first input", "comment box"
  - Works with regular inputs, textareas, contentEditable, shadow DOM, iframes
  - Can clear field first and/or press Enter after typing
- **Focus elements** (focusElement) - focus any interactive element
- **Scroll pages** (scrollPage) - up, down, top, bottom, or to specific element
  - Precise pixel control or scroll to CSS selector
  - Smooth scrolling animations
- **Press special keys** (pressKey) - Enter, Tab, Escape, Arrow keys, etc.

**🔍 SEARCH & EXTRACTION:**
- **Parse search results** (getSearchResults) - extracts Google/Bing search results with rankings, titles, URLs, snippets
- **Open search results** (openSearchResult) - open specific search result by rank
- **Search within pages** (search) - find text on current page
- **Read page content** (readPageContent) - extracts all visible text, title, URL
  - Can limit character count for large pages
  - Perfect for summarizing websites
- **Get selected text** (getSelectedText) - retrieves user's highlighted text

**📑 TAB MANAGEMENT:**
- **Switch tabs** (switchTabs) - switch to specific tab by title/URL pattern
- **Get active tab** (getActiveTab) - information about current tab
- **Apply tab groups** (applyTabGroups) - organize tabs into colored groups
- **Ungroup tabs** (ungroupTabs) - remove tabs from groups
- **Organize by context** (organizeTabsByContext) - AI-powered tab organization
  - Groups related tabs even from different websites
  - Analyzes content to find topical connections

**🕐 HISTORY:**
- **Search history** (searchHistory) - find previously visited pages by keywords
- **Get URL visits** (getUrlVisits) - get visit count and last visit time for specific URLs

**🧠 MEMORY SYSTEM:**
- **Save memories** (saveMemory) - store information permanently across sessions
  - Tag-based organization
  - Full-text search support
- **Get memories** (getMemory) - retrieve stored information by tags or search
- **List all memories** (listMemories) - show all stored information
- **Delete memories** (deleteMemory) - remove specific memories
- **Suggest saving** (suggestSaveMemory) - AI suggests what to remember from conversations

**⏰ REMINDERS:**
- **Create reminders** (createReminder) - set time-based or context-based reminders
- **List reminders** (listReminders) - show all active reminders
- **Cancel reminders** (cancelReminder) - remove specific reminders

**📸 OTHER CAPABILITIES:**
- Take screenshots of pages
- Extract metadata from pages
- Interact with forms (fill, submit)
- Handle multiple frames and shadow DOM
- Work with modern web frameworks (React, Vue, Angular)`;
}
