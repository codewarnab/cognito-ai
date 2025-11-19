/**
 * Notion Page Writer Agent
 * Specialized agent for creating single Notion pages incrementally
 * 
 * This agent:
 * - Creates ONE page per call (main or child)
 * - Captures pageId from tool response for parent-child relationships
 * - Uses same MCP tool infrastructure as notionCreatorAgent
 * - Simplified for sequential page creation workflow
 */

import { getMCPToolsFromBackground } from '../../mcp/proxy';
import { initializeGenAIClient } from '../../core/genAIFactory';
import { convertAllTools } from '../../geminiLive/toolConverter';
import { createLogger } from '~logger';
import { progressStore } from '../youtubeToNotion/progressStore';

const log = createLogger('NotionPageWriterAgent');

// Retry configuration
const MAX_RETRIES = 10;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Retry wrapper with exponential backoff
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

            if (attempt >= maxRetries) {
                log.error(`❌ All retry attempts exhausted for ${operationName}`);
                throw error;
            }

            const delay = initialDelay * Math.pow(2, attempt);
            log.warn(`⚠️ ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, error);

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * System instruction for single-page creation
 */
const SYSTEM_INSTRUCTION = `You create ONE Notion page per request using Notion MCP tools.

# CRITICAL SCHEMA RULES

1. **Properties are FLAT key-value pairs**: { "title": "My Title", "Video URL": "https://...", "Priority": 5 }
   - Values must be: string, number, or null
   - ❌ NEVER use nested objects: { "Video URL": { "url": "..." } }
   - ✅ ALWAYS use simple values: { "Video URL": "https://..." }

2. **Content is Notion Markdown** (NOT Notion API blocks):
   - Use: "# Heading\\n\\nParagraph text\\n\\n- List item"
   - NOT: { "type": "paragraph", "paragraph": { ... } }

3. **Parent structure**:
   - Use: { "parent": { "page_id": "abc123" } }
   - NOT: { "parent_page_id": "abc123" }

# TASK

Create the single page specified in the request. Use notion-create-pages tool with:
- Correct parent structure if provided
- Flat properties
- Complete Notion Markdown content

# OUTPUT

Return JSON with the page details:
\`\`\`json
{
  "success": true,
  "pageUrl": "https://notion.so/...",
  "pageId": "abc123",
  "message": "Page created successfully"
}
\`\`\``;

/**
 * Response from page creation
 */
export interface PageCreationResult {
    success: boolean;
    pageId?: string;
    pageUrl?: string;
    message?: string;
}

/**
 * Get Notion-specific tools from MCP background proxy
 */
async function getNotionTools(): Promise<Record<string, any>> {
    const mcpManager = await getMCPToolsFromBackground();

    const notionTools = Object.entries(mcpManager.tools)
        .filter(([name]) => name.startsWith('notion-'))
        .reduce((acc, [name, tool]) => {
            acc[name] = tool;
            return acc;
        }, {} as Record<string, any>);

    if (Object.keys(notionTools).length === 0) {
        log.warn('⚠️ No Notion tools available. Is Notion MCP server connected?');
    }

    return notionTools;
}

/**
 * Create main Notion page
 */
export async function createMainPage(params: {
    title: string;
    videoUrl?: string;
    parentPageId?: string;
}): Promise<PageCreationResult> {
    const content = `# ${params.title}\n\nVideo: ${params.videoUrl || 'N/A'}`;

    log.info('📄 Creating main Notion page', {
        title: params.title,
        hasParent: !!params.parentPageId
    });

    // Progress: Start main page creation
    const mainPageStepId = progressStore.add({
        title: 'Creating main Notion page...',
        status: 'active',
        type: 'page-created'
    });

    const result = await createSinglePage({
        title: params.title,
        content,
        parentPageId: params.parentPageId,
        videoUrl: params.videoUrl
    });

    // Progress: Main page creation result
    if (result.success) {
        progressStore.update(mainPageStepId, {
            title: 'Main Notion page created',
            status: 'complete',
            data: {
                url: result.pageUrl,
                title: params.title
            }
        });
    } else {
        progressStore.update(mainPageStepId, {
            title: 'Failed to create main page',
            status: 'error',
            data: { error: result.message }
        });
    }

    return result;
}

/**
 * Create child Notion page under a parent
 */
export async function createChildPage(params: {
    parentPageId: string;
    title: string;
    content: string;
}): Promise<PageCreationResult> {
    log.info('📝 Creating child Notion page', {
        title: params.title,
        parentPageId: params.parentPageId,
        contentLength: params.content.length
    });

    // Progress: Start child page creation
    const childPageStepId = progressStore.add({
        title: `Creating: "${params.title}"`,
        status: 'active',
        type: 'page-created'
    });

    const result = await createSinglePage({
        title: params.title,
        content: params.content,
        parentPageId: params.parentPageId
    });

    // Progress: Child page creation result
    if (result.success) {
        progressStore.update(childPageStepId, {
            title: `Created: "${params.title}"`,
            status: 'complete',
            data: { url: result.pageUrl }
        });
    } else {
        progressStore.update(childPageStepId, {
            title: `Failed: "${params.title}"`,
            status: 'error',
            data: { error: result.message }
        });
    }

    return result;
}

/**
 * Internal implementation for creating a single page
 */
async function createSinglePage(params: {
    title: string;
    content: string;
    parentPageId?: string;
    videoUrl?: string;
}): Promise<PageCreationResult> {
    try {
        // Get Notion tools
        const notionTools = await getNotionTools();

        if (Object.keys(notionTools).length === 0) {
            return {
                success: false,
                message: 'Notion MCP tools not available. Please ensure Notion MCP server is connected.'
            };
        }

        // Initialize Gen AI client
        const client = await initializeGenAIClient();

        // Convert Notion tools to Gemini format
        const geminiToolDeclarations = convertAllTools(notionTools);

        // Create chat session
        const chat = client.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                tools: [{ functionDeclarations: geminiToolDeclarations }],
            }
        });

        // Build task description
        const propertiesJson = params.videoUrl
            ? `{ "Video URL": "${params.videoUrl}" }`
            : '{}';

        const parentJson = params.parentPageId
            ? `{ "page_id": "${params.parentPageId}" }`
            : 'none';

        const task = `Create one page with:
- Title: "${params.title}"
- Parent: ${parentJson}
- Properties (flat): ${propertiesJson}
- Content (Notion Markdown, use COMPLETE content verbatim):
${params.content}

Return JSON with pageId, pageUrl, success, and message.`;

        // Send initial message
        let response = await withRetry(
            async () => await chat.sendMessage({ message: task }),
            MAX_RETRIES,
            INITIAL_RETRY_DELAY,
            'initial page creation message'
        );

        // Function calling loop (max 8 iterations for single page)
        let iterations = 0;
        const maxIterations = 8;

        while (iterations < maxIterations) {
            const functionCalls = response?.functionCalls;

            if (!functionCalls || functionCalls.length === 0) {
                log.info('✅ No more function calls - page creation complete');
                break;
            }

            iterations++;
            log.info(`🔧 Iteration ${iterations}: Executing ${functionCalls.length} tool(s)`);

            // Execute function calls
            const functionResponses: Array<{ name: string; response: any }> = [];

            for (const fc of functionCalls) {
                const toolName = fc.name!;
                const toolArgs = fc.args;

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

                    log.info(`✅ Tool execution successful: ${toolName}`);

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

            // Send function responses back
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
                'function response'
            );
        }

        // Parse final response
        const finalText = response?.text || '';

        // Try to extract JSON
        try {
            const jsonMatch = finalText.match(/```json\s*([\s\S]*?)\s*```/) ||
                finalText.match(/\{[\s\S]*?\}/);

            if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                const parsed = JSON.parse(jsonStr);

                const result: PageCreationResult = {
                    success: parsed.success !== false,
                    pageId: parsed.pageId || parsed.page_id,
                    pageUrl: parsed.pageUrl || parsed.page_url || parsed.url,
                    message: parsed.message || 'Page created successfully'
                };

                log.info('✅ Page created successfully', result);
                return result;
            }
        } catch (parseError) {
            log.warn('⚠️ Could not parse JSON from response', parseError);
        }

        // Fallback: check for success in text
        const isSuccess = finalText.toLowerCase().includes('success');
        return {
            success: isSuccess,
            message: finalText || 'Page creation completed'
        };

    } catch (error) {
        log.error('❌ Page creation failed:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : String(error)
        };
    }
}

