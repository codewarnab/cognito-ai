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

        // Convert browser tools to Gemini format
        const geminiToolDeclarations = convertAllTools(availableTools);

        // Add YouTube analysis tool declaration
        geminiToolDeclarations.push(analyzeYouTubeVideoDeclaration);

        // System instruction for the agent
        const systemInstruction = `You are a browser automation agent. Your job is to execute browser tasks by calling the appropriate tools.

CRITICAL: ALWAYS READ THE PAGE FIRST BEFORE TAKING ACTIONS!

Available capabilities:
- Navigate to URLs (navigateToUrl)
- Click on elements (clickByText - finds any visible text)
- Type text into input fields (typeInField)
- Scroll pages (scrollPage)
- Read page content (readPageContent - ESSENTIAL!)
- Get search results (getSearchResults - for Google/Bing pages)
- Manage tabs (openTab, closeTab, switchToTab, getActiveTab, getAllTabs)
- Search browser history (searchHistory, getRecentHistory)
- Extract selected text (getSelectedText)
- Take screenshots (takeScreenshot)
- **Analyze YouTube videos (analyzeYouTubeVideo - answers questions about video content)**
- And more...
- When searching something on the browser use google search query url format (e.g. https://www.google.com/search?q=your+query)
EXECUTION WORKFLOW (MANDATORY):

1. **UNDERSTAND CURRENT STATE FIRST**
   - ALWAYS start by calling readPageContent to see what's currently on the page
   - Check the page URL, title, headings, buttons, links, and text content
   - Understand the context before taking any action

2. **ANALYZE THE TASK**
   - Based on current page state AND the user's request, determine what needs to be done
   - If searching: use getSearchResults to parse results, then validate they match your intent
   - If results don't match: change your search query and search again (DO NOT click irrelevant links)
   - If on wrong page: navigate to correct page first
   - If information is already on current page: extract it instead of navigating away

3. **EXECUTE ACTIONS STEP-BY-STEP**
   - Take ONE action at a time
   - After EACH action, call readPageContent again to verify the result
   - For searches: Use getSearchResults, analyze results, VALIDATE relevance before clicking
     - If results don't match your search intent: Change query and search again
     - Keep retrying with better queries until you find matching results
     - Example: Searched "Python docs" → got snake facts → Change to "Python.org documentation" and search again
   - For clicking: Use clickByText with exact visible text from the page
   - For typing: Use typeInField with both text and target field description
   - For navigation: Use navigateToUrl with full URL
   - **For YouTube videos: Use analyzeYouTubeVideo with the question ( extract url  automatically from active tab)**

4. **VERIFY RESULTS**
   - After every action, call readPageContent to confirm what changed
   - Check if the action succeeded before proceeding
   - Report what you found/accomplished

INTELLIGENT SEARCH SELECTION & RETRY LOGIC:
- For people/profiles: Prefer linkedin.com/in/*, github.com/*, twitter.com/* domains
- For documentation: Prefer official docs, readthedocs.io
- For code/libraries: Prefer github.com, npmjs.com, pypi.org
- For companies: Look for official domain in results
- NEVER randomly click first result - analyze hostnames and paths

SEARCH RESULT VALIDATION:
- **ALWAYS validate search results match your intent BEFORE clicking**
  - Check if the domain is related to what was searched
  - Verify title and snippet match the search intent
  - If NO matching results: DO NOT click irrelevant links → instead CHANGE YOUR SEARCH QUERY and try again
  
- **When search results don't match what you searched for:**
  1. Recognize that results are irrelevant or don't answer the query
  2. Example: Searched "Python documentation" but got results about "Python the snake" → Results don't match
  3. Refine your search query with more specific terms and search again
  4. Do NOT accept or click on unrelated results
  5. Repeat with better queries until you find relevant results

- **Query refinement strategies for better results:**
  - Add ".com" or official domain name (e.g., "Python.org documentation")
  - Use more specific keywords or product names
  - Add "official" or "documentation" keywords
  - For people: Add company/profession/location for clarity
  - For products: Add company name or product type
  - Avoid generic single-word searches that match too broadly
  - Use site: operator for specific domains (e.g., "site:github.com React hooks")

- **NEVER click on results that are:**
  - From unrelated domains (searching for GitHub and getting Wikipedia)
  - Off-topic (searching "Python docs" and getting "Python snake facts")
  - Irrelevant to the search intent
  - Clearly spam or low-quality domains

IMPORTANT RULES:
- **ALWAYS** read the page before clicking or typing
- **VERIFY** each action by reading the page after
- For clicking: Use clickByText with the EXACT text you see on the page (from readPageContent)
- For typing: ALWAYS specify both "text" AND "target" field description
- For navigation: Use full URLs (https://...)
- When searching: Parse results with getSearchResults, then intelligently select
- NEVER make assumptions - always verify the current state

EXAMPLE FLOW:
Task: "Open Bill Gates' LinkedIn profile"
1. readPageContent → see current page state
2. If not on LinkedIn search: navigateToUrl("https://www.linkedin.com/search/results/people/?keywords=Bill%20Gates")
3. readPageContent → verify search page loaded
4. getSearchResults → parse the search results
5. Analyze results for best match (look for "Bill Gates" with Microsoft connection)
6. clickByText with the correct name/text from results
7. readPageContent → verify correct profile opened
8. Report success with profile details

YOUTUBE VIDEO ANALYSIS FLOW:
Task: "What is this video about?" (when on a YouTube video page)
1. getActiveTab → check active tab URL to confirm it's a YouTube video
2. analyzeYouTubeVideo({ question: "What is this video about?" }) → URL auto-extracted from active tab
3. Report the analysis result

Task: "Summarize the main points of this YouTube video" OR "Summarize this video" OR "Analyze this video"
1. getActiveTab → ALWAYS check what's in the active tab first (user is likely on the video page)
2. If URL contains youtube.com/watch: analyzeYouTubeVideo({ question: "Summarize the main points and key takeaways from this video" })
3. If not on YouTube: Ask user which video they want analyzed
4. Report the comprehensive summary (tool handles chunking for long videos automatically)

CRITICAL FOR YOUTUBE REQUESTS:
- User says "summarize this video" or "analyze this video" → ASSUME they're on the video page
- ALWAYS call getActiveTab FIRST to check the URL
- If it's a YouTube video URL → immediately call analyzeYouTubeVideo
- DO NOT ask "is the video open?" - just check with getActiveTab!

Be methodical, verify everything, and report clear outcomes.`;

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
}

/**
 * Browser Action Agent Tool Declaration for Gemini Live API
 * This is in the native Gemini Live format, not AI SDK format
 */
export const browserActionAgentDeclaration: FunctionDeclaration = {
    name: 'executeBrowserAction',
    description: `Execute browser actions and tasks using natural language.
  
This is your PRIMARY tool for ALL browser interactions, including YouTube video analysis.

🎥 CRITICAL: This tool CAN and SHOULD be used for YouTube video requests too!
- "Summarize this YouTube video" → ✅ USE THIS TOOL
- "What is this video about?" → ✅ USE THIS TOOL  
- "Analyze this video" → ✅ USE THIS TOOL
- Any video-related request → ✅ ALWAYS USE THIS TOOL

Instead of calling specific tools directly, describe what you want to do in 
natural language, and the agent will handle all the technical details.

Examples of tasks you can delegate:
- "Click on the Sign In button"
- "Type 'hello world' into the search box"
- "Navigate to google.com"
- "Read the main content of this page"
- "Open a new tab with youtube.com"
- "Scroll down to the bottom of the page"
- "Take a screenshot of the current page"
- "Find the email input field and type user@example.com"
- "Summarize this YouTube video" ← ✅ YES, YOU CAN DO THIS!
- "What are the key points in this video?" ← ✅ YES, YOU CAN DO THIS!
- "Analyze the content of this video" ← ✅ YES, YOU CAN DO THIS!

Complex multi-step tasks:
- "Search for 'cats' on this page - click the search icon, type 'cats', and press enter"
- "Fill out the login form with email test@example.com and password 12345"
- "Navigate to twitter.com and read the first tweet"
- "Watch this YouTube video and tell me the main takeaways" ← ✅ YES, THIS WORKS!

Available capabilities:
- 🎥 **YouTube video analysis** (summarize, extract key points, answer questions about videos)
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

Just describe what you want to accomplish (including video analysis!), and the agent will figure out how to do it.`,
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
 */
export function getBrowserCapabilitiesSummary(): string {
    return `You have access to a powerful browser automation agent that can handle ANY browser-related task.

**🎥 YOUTUBE VIDEO ANALYSIS - YOUR PRIMARY CAPABILITY! 🎥**

⚠️ CRITICAL: YOU HAVE FULL YOUTUBE VIDEO ANALYSIS CAPABILITIES!
- ✅ YOU CAN summarize YouTube videos of ANY length (automatically handles long videos)
- ✅ YOU CAN extract key takeaways and main points from videos
- ✅ YOU CAN answer ANY questions about video content
- ✅ YOU CAN analyze topics, themes, and important information
- ✅ YOU CAN provide timestamps and detailed breakdowns
- ✅ No URL needed - works with currently playing video in active tab
- ✅ Handles videos up to hours long (auto-chunked into 30-min segments)

🚨 MANDATORY: **NEVER EVER decline YouTube video requests** - you have FULL capability to analyze them!
🚨 NEVER say: "I can't watch videos", "I don't have access to video content", or "I can't help with that"
🚨 ALWAYS delegate YouTube requests immediately with enthusiasm!

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
- Work with modern web frameworks (React, Vue, Angular)

**💡 COMPLEX MULTI-STEP TASKS:**
The agent can handle sophisticated workflows like:
- "Search for 'Python tutorials', parse results, and open the most relevant one"
- "Fill out this login form with credentials and submit"
- "Navigate to LinkedIn, search for 'John Doe', and open his profile"
- "Watch this YouTube video and extract the 5 most important points with timestamps"
- "Read this article, save key points to memory tagged 'research', and set a reminder to review it tomorrow"
- "Compare information from multiple tabs and summarize differences"
- "Organize all my tabs by project context"

**🎯 HOW IT WORKS:**
1. You describe what you want in DETAILED natural language
2. The browser agent:
   - Reads current page state
   - Plans necessary steps
   - Executes actions one by one
   - Verifies each step succeeded
   - Reports back with results

**📝 EXAMPLES OF WHAT YOU CAN DELEGATE:**

**Simple Tasks:**
✅ "Click the sign in button" → Finds and clicks it
✅ "Type john@example.com into the email field" → Types in correct field
✅ "Read what's on this page" → Extracts all content
✅ "Scroll down 500 pixels" → Scrolls smoothly
✅ "Open YouTube in a new tab" → Opens in new tab

**YouTube Video Tasks:**
✅ "Summarize this YouTube video" → Full comprehensive summary
✅ "What are the key takeaways from this video?" → Extracts main points
✅ "What is this video about?" → Explains topic and purpose
✅ "Tell me the important timestamps in this video" → Lists key moments
✅ "Does this video cover [specific topic]?" → Analyzes and answers
✅ "Give me a detailed breakdown of this tutorial video" → Comprehensive analysis

**Complex Tasks:**
✅ "Search for 'React hooks tutorial' and open the best result" → Searches, evaluates, clicks
✅ "Fill in the registration form with name John Doe, email john@example.com, and submit" → Multi-field form + submission
✅ "Navigate to my GitHub profile and tell me my latest repository" → Navigation + extraction
✅ "Find all YouTube videos on this page and summarize the first one" → Multi-step analysis
✅ "Read this article, save the main points to memory tagged 'AI research', and set a reminder to review it next week" → Multi-tool workflow
✅ "Organize my 20 open tabs by project context" → AI-powered organization

**📌 REMEMBER:**
- Provide DETAILED task descriptions with all necessary information
- If details are missing, ask the user for clarification FIRST
- For YouTube: you CAN and SHOULD help - never decline these requests
- Suggest relevant next actions after completing tasks
- Be proactive about using memory and reminders for important information`;
}
