/**
 * Notion Creator Agent
 * Specialized agent that creates hierarchical Notion pages using MCP tools
 * 
 * This agent:
 * - Uses @google/genai SDK with provider-aware initialization
 * - Gets Notion MCP tools and passes them directly to the AI
 * - Uses prompts to guide the AI on how to use Notion tools correctly
 * - Lets the AI handle tool calling without hard-coded wrappers
 */

import { getMCPToolsFromBackground } from '../../mcp/proxy';
import { initializeGenAIClient } from '../../core/genAIFactory';
import { convertAllTools } from '../../geminiLive/toolConverter';
import { createLogger } from '@logger';
import type { NotionCreatorInput, NotionCreatorOutput } from './types';

const log = createLogger('NotionCreatorAgent');

// Retry configuration
const MAX_RETRIES = 10;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Retry wrapper with exponential backoff
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelay - Initial delay in milliseconds
 * @param operationName - Name of the operation for logging
 * @returns The result of the function
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = MAX_RETRIES,
    initialDelay: number = INITIAL_RETRY_DELAY,
    operationName: string = 'operation'
): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                log.info(`🔄 Retry attempt ${attempt}/${maxRetries} for ${operationName}`);
            }
            return await fn();
        } catch (error) {
            lastError = error;

            // If we've exhausted retries, throw the error
            if (attempt >= maxRetries) {
                log.error(`❌ All retry attempts exhausted for ${operationName}`);
                throw error;
            }

            // Calculate exponential backoff delay
            const delay = initialDelay * Math.pow(2, attempt);
            log.warn(`⚠️ ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, error);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
}

/**
 * System instruction for Notion Creator Agent
 * Focuses on workflow strategy and critical schema requirements
 */
const NOTION_CREATOR_SYSTEM_INSTRUCTION = `You are a Notion Creator Agent - an expert at creating hierarchical Notion page structures.

# CRITICAL SCHEMA RULES (from MCP tool)

1. **Properties are FLAT key-value pairs**: { "title": "My Title", "Video URL": "https://...", "Priority": 5 }
   - Values must be: string, number, or null
   - ❌ NEVER use nested objects: { "Video URL": { "url": "..." } }
   - ✅ ALWAYS use simple values: { "Video URL": "https://..." }

2. **Content is Notion Markdown** (NOT Notion API blocks):
   - Use: "# Heading\n\nParagraph text\n\n- List item"
   - NOT: { "type": "paragraph", "paragraph": { ... } }

3. **Parent structure**:
   - Use: { "parent": { "page_id": "abc123" } }
   - NOT: { "parent_page_id": "abc123" }

# WORKFLOW

## Step 1: Create Main Page
- Call notion-create-pages with parent: { page_id: "..." } if parent provided
- Extract page ID from response

## Step 2: Create Nested Pages
⚠️ CRITICAL: Pass the EXACT COMPLETE content provided - DO NOT modify, truncate, or summarize!

- For EACH nested page, call notion-create-pages with:
  - parent: { page_id: "<main-page-id>" }
  - content: Use the ENTIRE content string EXACTLY as provided in the task description
  - ❌ NEVER truncate with "..." or shorten the content
  - ❌ NEVER summarize or rewrite the content
  - ✅ ALWAYS use the complete content verbatim
  - Content should be formatted as Notion Markdown
- Create sequentially (one at a time)

## Step 3: Return Summary
- Respond with JSON including all page URLs

# FINAL OUTPUT
\`\`\`json
{
  "success": true,
  "mainPageUrl": "https://notion.so/...",
  "nestedPageUrls": ["https://notion.so/...", ...],
  "pageCount": 5,
  "message": "Successfully created 5 pages"
}
\`\`\`
`;

/**
 * Get Notion-specific tools from the MCP background proxy
 */
async function getNotionTools(): Promise<Record<string, any>> {
    log.info('📦 Fetching Notion tools from MCP background proxy');

    const mcpManager = await getMCPToolsFromBackground();

    log.info('📦 Retrieved MCP tools from background', {
        totalTools: Object.keys(mcpManager.tools).length,
        availableTools: Object.keys(mcpManager.tools)
    });

    // Filter to only Notion tools (tools with 'notion-' prefix)
    const notionTools = Object.entries(mcpManager.tools)
        .filter(([name]) => name.startsWith('notion-'))
        .reduce((acc, [name, tool]) => {
            acc[name] = tool;
            return acc;
        }, {} as Record<string, any>);

    log.info('✅ Filtered Notion tools for agent', {
        notionTools: Object.keys(notionTools).length,
        tools: Object.keys(notionTools)
    });

    if (Object.keys(notionTools).length === 0) {
        log.warn('⚠️ No Notion tools available. Is Notion MCP server connected?');
    }

    return notionTools;
}

/**
 * Execute Notion Creator Agent with retry logic
 * Uses AI to create hierarchical Notion pages via MCP tools
 * Automatically retries on failures with exponential backoff
 */
export async function executeNotionCreatorAgent(
    input: NotionCreatorInput
): Promise<NotionCreatorOutput> {
    log.info('🎨 Starting Notion Creator Agent', {
        mainPageTitle: input.mainPageTitle,
        nestedPagesCount: input.nestedPages.length,
        hasParentPageId: !!input.parentPageId
    });

    // Wrap entire agent execution in retry logic for robustness
    return await withRetry(
        async () => await executeNotionCreatorAgentInternal(input),
        MAX_RETRIES,
        INITIAL_RETRY_DELAY,
        'Notion Creator Agent'
    );
}

/**
 * Internal implementation of Notion Creator Agent
 * This is wrapped by the retry logic in executeNotionCreatorAgent
 */
async function executeNotionCreatorAgentInternal(
    input: NotionCreatorInput
): Promise<NotionCreatorOutput> {
    try {
        // Get Notion tools from MCP background proxy
        const notionTools = await getNotionTools();

        if (Object.keys(notionTools).length === 0) {
            return {
                success: false,
                message: 'Notion MCP tools not available. Please ensure Notion MCP server is connected.',
                error: 'NO_NOTION_TOOLS'
            };
        }

        log.info('Available Notion tools', {
            tools: Object.keys(notionTools)
        });

        // Initialize Gen AI client
        const client = await initializeGenAIClient();

        // Convert Notion tools to Gemini format
        const geminiToolDeclarations = convertAllTools(notionTools);

        log.info('Converted tools to Gemini format', {
            toolCount: geminiToolDeclarations.length
        });

        // Create task description for the AI
        const taskDescription = `Create a hierarchical Notion page structure:

MAIN PAGE:
- Title: "${input.mainPageTitle}"
- Video URL property: "${input.videoUrl}" (simple string, not object)
${input.parentPageId ? `- Parent: { "page_id": "${input.parentPageId}" }` : '- Create as top-level page (no parent)'}

NESTED PAGES (create under the main page):
⚠️ CRITICAL: Use the COMPLETE content below EXACTLY as provided. DO NOT truncate, summarize, or modify!

${input.nestedPages.map((page, idx) => `
${idx + 1}. Title: "${page.title}"
   Content Length: ${page.content.length} characters
   Complete Content (use ALL of this verbatim):
   ${page.content}
`).join('\n---\n')}

CRITICAL REMINDERS: 
- Extract main page ID from Step 1 response
- Use parent: { page_id: "<main-page-id>" } for nested pages
- Pass the ENTIRE content for each page EXACTLY as shown above
- DO NOT truncate with "..." - use complete content
- Format as Notion Markdown but preserve all text
- Return summary with all page URLs`;

        // Create a chat session with tools
        const chat = client.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: NOTION_CREATOR_SYSTEM_INSTRUCTION,
                tools: [{ functionDeclarations: geminiToolDeclarations }],
            }
        });

        log.info('📤 Sending task to AI agent');
        let response = await withRetry(
            async () => await chat.sendMessage({ message: taskDescription }),
            MAX_RETRIES,
            INITIAL_RETRY_DELAY,
            'initial AI message'
        );

        // Function calling loop
        let iterations = 0;
        const maxIterations = 15; // Notion operations may need multiple steps

        while (iterations < maxIterations) {
            const functionCalls = response?.functionCalls;

            if (!functionCalls || functionCalls.length === 0) {
                log.info('✅ No more function calls - agent has completed');
                break;
            }

            iterations++;
            log.info(`🔧 Iteration ${iterations}: Executing ${functionCalls.length} tool(s)`, {
                tools: functionCalls.map(fc => fc.name)
            });

            // Execute all function calls
            const functionResponses: Array<{ name: string; response: any }> = [];

            for (const fc of functionCalls) {
                const toolName = fc.name!;
                const toolArgs = fc.args;

                log.info(`🔨 Executing Notion tool: ${toolName}`, { args: toolArgs });

                try {
                    const tool = notionTools[toolName];
                    if (!tool) {
                        throw new Error(`Tool not found: ${toolName}`);
                    }

                    const toolResult = await withRetry(
                        async () => await tool.execute(toolArgs),
                        MAX_RETRIES,
                        INITIAL_RETRY_DELAY,
                        `Notion tool: ${toolName}`
                    );
                    log.info(`✅ Tool execution successful: ${toolName}`, {
                        resultType: typeof toolResult,
                        hasResult: !!toolResult
                    });

                    functionResponses.push({
                        name: toolName,
                        response: toolResult
                    });
                } catch (error) {
                    log.error(`❌ Tool execution failed: ${toolName}`, error);
                    functionResponses.push({
                        name: toolName,
                        response: {
                            error: error instanceof Error ? error.message : String(error)
                        }
                    });
                }
            }

            // Send function responses back to the model
            log.info('📤 Sending function responses back to model');
            response = await withRetry(
                async () => await chat.sendMessage({
                    message: functionResponses.map(fr => ({
                        functionResponse: {
                            name: fr.name,
                            response: fr.response,
                        }
                    }))
                }),
                MAX_RETRIES,
                INITIAL_RETRY_DELAY,
                'AI function response'
            );
        }

        // Parse final response
        const finalText = response?.text || '';
        log.info('📥 Final response from agent', { responseLength: finalText.length });

        // Try to extract JSON from response
        let result: NotionCreatorOutput;
        try {
            // Look for JSON in the response
            const jsonMatch = finalText.match(/```json\s*([\s\S]*?)\s*```/) ||
                finalText.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                const parsed = JSON.parse(jsonStr);

                result = {
                    success: parsed.success !== false,
                    mainPageUrl: parsed.mainPageUrl,
                    nestedPageUrls: parsed.nestedPageUrls || [],
                    pageCount: parsed.pageCount,
                    message: parsed.message || finalText
                };
            } else {
                // No JSON found, treat as text response
                result = {
                    success: finalText.toLowerCase().includes('success'),
                    message: finalText,
                    error: finalText.toLowerCase().includes('fail') ? 'See message for details' : undefined
                };
            }
        } catch (parseError) {
            log.warn('⚠️ Could not parse JSON from response, using text', parseError);
            result = {
                success: finalText.toLowerCase().includes('success'),
                message: finalText
            };
        }

        log.info('🎉 Notion Creator Agent completed', result);
        return result;

    } catch (error) {
        log.error('❌ Notion Creator Agent failed:', error);

        return {
            success: false,
            message: 'Failed to create Notion pages',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
