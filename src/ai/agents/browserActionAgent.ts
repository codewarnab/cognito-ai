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

const log = createLogger('Browser-Action-Agent');

// Initialize Google AI for the agent
const apiKey = "AIzaSyAxTFyeqmms2eV9zsp6yZpCSAHGZebHzqc";
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Execute a browser action task using an intelligent agent
 * @param taskDescription - Natural language description of what to do
 * @returns Result of executing the task
 */
async function executeBrowserTask(taskDescription: string): Promise<string> {
    log.info('🤖 Browser Action Agent received task', { taskDescription });

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

        // Convert tools to Gemini format
        const geminiToolDeclarations = convertAllTools(availableTools);

        // Create the agent model with tool calling capabilities
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            tools: [{ functionDeclarations: geminiToolDeclarations }],
        });

        // System instruction for the agent
        const systemInstruction = `You are a browser automation agent. Your job is to execute browser tasks by calling the appropriate tools.

Available capabilities:
- Navigate to URLs
- Click on elements (by text, selector, or coordinates)
- Type text into input fields
- Scroll pages
- Read page content
- Manage tabs (open, close, switch)
- Search browser history
- Extract selected text
- Take screenshots
- And more...

When given a task:
1. Analyze what needs to be done
2. Call the appropriate tool(s) with correct parameters
3. If multiple steps are needed, execute them in sequence
4. Report results clearly

IMPORTANT RULES:
- For clicking: Use clickByText when you know the visible text of an element
- For typing: ALWAYS specify both the "text" to type AND the "target" field describing where to type
- If you need to type but don't know the target, first click on the field description, then type
- For navigation: Use navigateToUrl with full URLs
- For reading: Use readPageContent to get page text
- Always call tools when asked to perform actions - don't just describe what to do

Be precise with parameters and execute the task efficiently.`;

        // Start a chat session
        const chat = model.startChat({
            history: [],
        });

        // Send the task
        const result = await chat.sendMessage(taskDescription);
        let response = result.response;
        let iterations = 0;
        const maxIterations = 20;

        // Handle function calling loop
        while (iterations < maxIterations) {
            const functionCalls = response.functionCalls();

            if (!functionCalls || functionCalls.length === 0) {
                // No more function calls, we have the final response
                break;
            }

            iterations++;
            log.info(`Iteration ${iterations}: Executing ${functionCalls.length} tool(s)`, {
                tools: functionCalls.map(fc => fc.name)
            });

            // Execute all function calls
            const functionResponses = [];

            for (const fc of functionCalls) {
                const toolName = fc.name;
                const toolArgs = fc.args;

                log.info(`Executing tool: ${toolName}`, { args: toolArgs });

                try {
                    const tool = availableTools[toolName];
                    if (!tool) {
                        throw new Error(`Tool not found: ${toolName}`);
                    }

                    const toolResult = await tool.execute(toolArgs);
                    log.info(`Tool ${toolName} completed`, { result: toolResult });

                    functionResponses.push({
                        name: toolName,
                        response: toolResult,
                    });
                } catch (error) {
                    log.error(`Tool ${toolName} failed`, error);
                    functionResponses.push({
                        name: toolName,
                        response: {
                            error: error instanceof Error ? error.message : String(error),
                        },
                    });
                }
            }

            // Send function responses back - need to wrap in correct format
            const nextResult = await chat.sendMessage(
                functionResponses.map(fr => ({
                    functionResponse: {
                        name: fr.name,
                        response: fr.response,
                    }
                }))
            );
            response = nextResult.response;
        }

        if (iterations >= maxIterations) {
            log.warn('Max iterations reached in agent loop');
        }

        // Get final text response
        const finalResponse = response.text();
        log.info('✅ Browser Action Agent completed', {
            iterations,
            responseLength: finalResponse.length
        });

        return finalResponse;

    } catch (error) {
        log.error('❌ Browser Action Agent error', error);
        return `I encountered an error while trying to execute the task: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * Browser Action Agent Tool Declaration for Gemini Live API
 * This is in the native Gemini Live format, not AI SDK format
 */
export const browserActionAgentDeclaration: FunctionDeclaration = {
    name: 'executeBrowserAction',
    description: `Execute browser actions and tasks using natural language.
  
This is your primary tool for interacting with the browser. Instead of calling
specific tools directly, describe what you want to do in natural language, and
the agent will handle the details.

Examples of tasks you can delegate:
- "Click on the Sign In button"
- "Type 'hello world' into the search box"
- "Navigate to google.com"
- "Read the main content of this page"
- "Open a new tab with youtube.com"
- "Scroll down to the bottom of the page"
- "Take a screenshot of the current page"
- "Find the email input field and type user@example.com"

Complex multi-step tasks:
- "Search for 'cats' on this page - click the search icon, type 'cats', and press enter"
- "Fill out the login form with email test@example.com and password 12345"
- "Navigate to twitter.com and read the first tweet"

Available capabilities:
- Navigation (open URLs, go back/forward)
- Element interaction (click buttons, links, any visible text)
- Text input (type into fields - always specify which field)
- Page reading (extract text content, get selected text)
- Tab management (open, close, switch tabs)
- Scrolling (up, down, to element)
- Screenshots
- History search
- Memory storage
- And more...

Just describe what you want to accomplish, and the agent will figure out how to do it.`,
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            taskDescription: {
                type: SchemaType.STRING,
                description: 'Natural language description of the browser task to perform. ' +
                    'Be specific about what you want to do. ' +
                    'For typing tasks, mention both WHAT to type and WHERE to type it. ' +
                    'Examples: "Click the login button", "Type hello into the search box", ' +
                    '"Navigate to github.com", "Read the page content"'
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
 */
export function getBrowserCapabilitiesSummary(): string {
    return `You have access to a powerful browser automation agent that can:

**Navigation:**
- Open URLs and navigate to websites
- Go back/forward in history
- Refresh pages

**Page Interaction:**
- Click on any visible text (buttons, links, etc.)
- Type text into input fields (specify what and where)
- Scroll pages (up, down, to specific elements)
- Extract and read page content

**Tab Management:**
- Open new tabs
- Close tabs
- Switch between tabs
- List all open tabs

**Information:**
- Read current page content
- Get selected text
- Search browser history
- Take screenshots

**Smart Features:**
- Store and retrieve memories
- Set reminders
- YouTube video analysis (separate tool)

To use these capabilities, simply describe what you want to do in natural language.
The agent will determine the best way to accomplish it and execute the necessary actions.

Examples:
- "Click on the sign in button" → Agent finds and clicks it
- "Type my email into the email field" → Agent locates field and types
- "Read what's on this page" → Agent extracts and returns content
- "Open YouTube in a new tab" → Agent creates tab and navigates`;
}
