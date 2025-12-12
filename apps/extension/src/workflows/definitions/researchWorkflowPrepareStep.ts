/**
 * Research Workflow PrepareStep V2
 * 
 * Key Change: Complete context reset when transitioning to synthesis phase
 * instead of trying to truncate individual message content.
 * 
 * Features:
 * - Phase 1: Research/gathering with navigation tools
 * - Phase 2: Synthesis with complete context reset
 * - All source metadata embedded in synthesis system prompt
 * - Incremental report building via appendToReport tool
 */

import type { ModelMessage } from 'ai';
import { createLogger } from '~logger';
import { getResearchWorkflowSettings } from '@/utils/settings/researchWorkflowSettings';
import { listResearchSources, getCurrentResearchSessionId } from '@/db';
import { getOriginalUserRequest, getResearchMetadata } from '../researchContext';
import type { WorkflowStepResult, PrepareStepContext, PrepareStepResult } from '../types';

const log = createLogger('ResearchPrepareStep', 'WORKFLOW');

/**
 * Track which sourceIds have had their content truncated
 * Prevents re-truncating on subsequent steps
 * 
 * IMPORTANT: This must be cleared when a new research session starts!
 * Call resetTruncatedSources() from startResearchContext() in researchContext.ts
 */
const truncatedSources = new Set<string>();

/**
 * Reset truncated sources tracking (call when new session starts)
 */
export function resetTruncatedSources(): void {
    truncatedSources.clear();
    log.debug('Truncated sources tracking reset');
}

/**
 * Track if we've already transitioned to synthesis
 * Prevents re-triggering context reset on subsequent steps
 */
let synthesisPhaseStarted = false;

/**
 * Reset synthesis phase flag (call when new research session starts)
 */
export function resetSynthesisPhaseFlag(): void {
    synthesisPhaseStarted = false;
    log.debug('Synthesis phase flag reset');
}

/**
 * Tools available during research/gathering phase
 */
const RESEARCH_PHASE_TOOLS = [
    // Navigation
    'navigateTo',
    'switchTabs',
    'getActiveTab',
    'getAllTabs',
    // Content extraction
    'readPageContent',
    'extractText',
    'getSearchResults',
    // Search
    'chromeSearch',
    'openSearchResult',
    // Memory management
    'addMemoryMetadata',
    // Report template (can be called early)
    'getReportTemplate',
];

/**
 * Tools available during synthesis phase
 */
const SYNTHESIS_PHASE_TOOLS = [
    'readResearchMemory',
    'appendToReport',
    'generatePDF',
];

/**
 * Count how many sources have been read from the steps array
 */
function countSourcesRead(steps: WorkflowStepResult[]): number {
    let count = 0;
    for (const step of steps) {
        for (const toolCall of step.toolCalls) {
            if (toolCall.toolName === 'readPageContent') {
                count++;
            }
        }
    }
    return count;
}

/**
 * Generate the synthesis system prompt with embedded source metadata
 * 
 * CRITICAL: All source metadata is embedded directly in this prompt
 * so the AI doesn't need to call listResearchSources
 */
async function generateSynthesisSystemPrompt(): Promise<string> {
    const sessionId = getCurrentResearchSessionId();
    const metadata = getResearchMetadata();
    const originalRequest = getOriginalUserRequest();

    if (!sessionId) {
        throw new Error('No active research session for synthesis');
    }

    // Get all source metadata
    const sources = await listResearchSources(sessionId);

    // Format sources for the prompt
    const sourcesSection = sources.length > 0
        ? sources.map((s, i) =>
            `${i + 1}. **${s.title}** (${s.sourceId})
   - URL: ${s.url}
   - Content Size: ${s.contentLength} characters
   - Future Use: ${s.futureUseGuideline || 'General reference'}`
        ).join('\n\n')
        : 'No sources found.';

    // Generate safe filename from topic
    const safeFilename = metadata.topic?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'report';

    return `# SYNTHESIS PHASE - Report Generation

## Context
You have completed the RESEARCH PHASE for the following request:
> "${originalRequest || 'Research request'}"

${metadata.topic ? `**Topic**: ${metadata.topic}` : ''}
${metadata.reportType ? `**Report Type**: ${metadata.reportType}` : ''}

---

## Your Available Research Sources

You have gathered **${sources.length} sources** during research. Here is the metadata for each:

${sourcesSection}

---

## Your Task

Build a comprehensive report by processing each source and adding sections to the report buffer.

### Step-by-Step Workflow

**For EACH relevant source:**

1. **Read the source content**:
   \`\`\`
   readResearchMemory({ sourceId: "research_source_X" })
   \`\`\`
   This loads the full content into your context.

2. **Extract and synthesize** the relevant information for the appropriate report section(s).

3. **Add to report buffer**:
   \`\`\`
   appendToReport({
       sectionName: "Section Name",
       content: "Your synthesized content in markdown...",
       sourceIds: ["research_source_X"]
   })
   \`\`\`
   This saves the section - you can now "forget" the source content.

4. **Repeat** for remaining sources and sections.

**After all sections are added:**

5. **Generate the final PDF**:
   \`\`\`
   generatePDF({ compileFromBuffer: true, filename: "${safeFilename}" })
   \`\`\`
   This compiles all sections into the final PDF.

---

## Available Tools (Synthesis Phase Only)

| Tool | Purpose |
|------|---------|
| \`readResearchMemory\` | Load full content of a source by sourceId |
| \`appendToReport\` | Add a section to the report buffer |
| \`generatePDF\` | Compile all sections and generate final PDF |

---

## Report Structure Guidelines

Based on the futureUseGuideline for each source, create the following sections:

${sources.length > 0
            ? `- Use source guidelines to determine which sources feed into which sections
- Each section should synthesize information from relevant sources
- Cross-reference facts across sources when possible
- Cite sources where appropriate (source title or URL)`
            : 'No sources available - this may indicate an issue with the research phase.'}

---

## Quality Standards

✅ **DO:**
- Read each source before using its content
- Synthesize information, don't just copy/paste
- Create substantive content for each section
- Call appendToReport after synthesizing each section
- Call generatePDF at the end to create the final report

❌ **DO NOT:**
- Skip reading sources (you MUST call readResearchMemory)
- Try to generate the entire report in one generatePDF call
- Ignore the futureUseGuideline hints
- Leave sections empty or with placeholder content

---

## IMPORTANT: Memory Efficiency

After you call \`appendToReport\` for content from a source, that content is safely stored.
You do NOT need to keep it in your working memory. The final \`generatePDF\` will compile
everything from the buffer.

This allows you to process sources one at a time without context overflow.

---

## Begin Synthesis

Start by reading your first source. Use the futureUseGuideline to determine which 
source is most relevant for the first section of your report.

Ready? Call \`readResearchMemory\` for your first source.`;
}

/**
 * Generate the user message for synthesis context
 */
function generateSynthesisUserMessage(originalRequest: string | null): string {
    return originalRequest
        ? `Based on the research I requested ("${originalRequest}"), please generate a comprehensive report. Process each source, build the report section by section, and generate the final PDF.`
        : 'Please generate the research report based on the gathered sources. Process each source, build the report section by section, and generate the final PDF.';
}

/**
 * Build set of sourceIds that have had metadata added
 */
function getSourceIdsWithMetadata(steps: WorkflowStepResult[]): Set<string> {
    const sourceIds = new Set<string>();

    for (const step of steps) {
        for (const toolCall of step.toolCalls) {
            if (toolCall.toolName === 'addMemoryMetadata') {
                const args = toolCall.args as { sourceId?: string };
                if (args.sourceId) {
                    sourceIds.add(args.sourceId);
                }
            }
        }
    }

    return sourceIds;
}

/**
 * Truncate old readPageContent results from message history
 * 
 * Strategy:
 * - Find tool result messages from readPageContent
 * - Check if addMemoryMetadata was called for that sourceId (in subsequent steps)
 * - If yes, truncate the content field to save context space
 * - Keep metadata (sourceId, url, title) for reference
 * 
 * @param messages - Current message history
 * @param sourceIdsWithMetadata - Set of sourceIds that have metadata added
 * @returns Object with modified messages and whether changes were made
 */
function truncateOldPageContent(
    messages: ModelMessage[],
    sourceIdsWithMetadata: Set<string>
): { messages: ModelMessage[]; hasChanges: boolean } {
    // If no metadata added yet, no truncation needed
    if (sourceIdsWithMetadata.size === 0) {
        return { messages, hasChanges: false };
    }

    let hasChanges = false;

    const newMessages = messages.map(msg => {
        // Only process tool result messages
        if (msg.role !== 'tool') {
            return msg;
        }

        // Check if this message has content array
        const content = msg.content;
        if (!Array.isArray(content)) {
            return msg;
        }

        const newContent = content.map(part => {
            // Only process tool-result parts
            if (typeof part !== 'object' || part === null) {
                return part;
            }

            if (!('type' in part) || part.type !== 'tool-result') {
                return part;
            }

            // Check if this is a readPageContent result
            const result = ('result' in part ? part.result : undefined) as Record<string, unknown> | undefined;
            if (!result || typeof result !== 'object') {
                return part;
            }

            const sourceId = result.sourceId as string | undefined;
            if (!sourceId || !sourceIdsWithMetadata.has(sourceId)) {
                return part;
            }

            // Skip if already truncated
            if (truncatedSources.has(sourceId)) {
                return part;
            }

            // Truncate the content field
            truncatedSources.add(sourceId);
            hasChanges = true;

            const contentLength = result.contentLength || (result.content as string)?.length || 0;

            log.info(`Truncating content for ${sourceId} (metadata added)`, {
                originalLength: contentLength,
            });

            return {
                ...part,
                result: {
                    sourceId: result.sourceId,
                    url: result.url,
                    title: result.title,
                    stored: true,
                    contentLength,
                    // Replace full content with truncation notice
                    content: `[Content stored to IndexedDB - ${contentLength} chars. Use readResearchMemory("${sourceId}") to retrieve during synthesis.]`,
                    message: result.message,
                },
            };
        });

        return { ...msg, content: newContent };
    });

    return { messages: hasChanges ? newMessages : messages, hasChanges };
}

/**
 * PrepareStep function for research workflow (V2 - Context Reset)
 * 
 * Handles:
 * 1. Counting sources read (from steps array - single source of truth)
 * 2. Truncating old readPageContent results during research phase
 * 3. Complete context reset when transitioning to synthesis phase
 * 4. Embedding all source metadata in synthesis system prompt
 */
export async function researchWorkflowPrepareStep(
    context: PrepareStepContext
): Promise<PrepareStepResult | undefined> {
    const { stepNumber, steps, messages } = context;

    log.debug(`Step ${stepNumber}: Preparing research workflow step`);

    // If we've already transitioned to synthesis, don't reset again
    if (synthesisPhaseStarted) {
        log.debug('Already in synthesis phase, continuing');
        return {
            activeTools: SYNTHESIS_PHASE_TOOLS,
        };
    }

    // =========================================================================
    // 1. Count sources read from steps array (single source of truth)
    // =========================================================================
    const sourcesReadCount = countSourcesRead(steps);
    log.debug(`Sources read so far: ${sourcesReadCount}`);

    // =========================================================================
    // 2. Check if we should transition to synthesis phase
    // =========================================================================
    let settings;
    try {
        settings = await getResearchWorkflowSettings();
    } catch (error) {
        log.error('Failed to get research workflow settings', {
            error: error instanceof Error ? error.message : String(error),
        });
        // Use default minimum sources
        settings = { minimumSources: 5 };
    }

    // Still in research phase
    if (sourcesReadCount < settings.minimumSources) {
        // Context Cleanup: Truncate old readPageContent results
        const sourceIdsWithMetadata = getSourceIdsWithMetadata(steps);
        const { messages: modifiedMessages, hasChanges: messagesChanged } = truncateOldPageContent(
            messages,
            sourceIdsWithMetadata
        );

        if (messagesChanged) {
            log.info(`Truncated ${sourceIdsWithMetadata.size} source(s) from context`);
            return {
                messages: modifiedMessages,
                activeTools: RESEARCH_PHASE_TOOLS,
            };
        }

        return {
            activeTools: RESEARCH_PHASE_TOOLS,
        };
    }

    // =========================================================================
    // TRANSITION TO SYNTHESIS PHASE - COMPLETE CONTEXT RESET
    // =========================================================================

    log.info(`Minimum sources (${settings.minimumSources}) met. Initiating CONTEXT RESET for synthesis.`, {
        sourcesRead: sourcesReadCount,
        minimumRequired: settings.minimumSources,
    });

    synthesisPhaseStarted = true;

    try {
        // Generate synthesis prompt with embedded source metadata
        const synthesisPrompt = await generateSynthesisSystemPrompt();

        // Get original user request
        const originalRequest = getOriginalUserRequest();

        // Create the NEW message array (complete reset)
        const synthesisMessages: ModelMessage[] = [
            {
                role: 'user',
                content: generateSynthesisUserMessage(originalRequest),
            },
        ];

        log.info('Context reset complete', {
            previousMessageCount: messages.length,
            newMessageCount: synthesisMessages.length,
            synthesisPromptLength: synthesisPrompt.length,
            synthesisPromptPreview: synthesisPrompt.substring(0, 150),
        });

        const result = {
            system: synthesisPrompt,
            messages: synthesisMessages,
            activeTools: SYNTHESIS_PHASE_TOOLS,
        };

        log.info('🔄 Returning synthesis phase prepareStep result', {
            hasSystem: !!result.system,
            systemLength: result.system?.length,
            activeTools: result.activeTools,
            messagesCount: result.messages?.length,
        });

        return result;
    } catch (error) {
        log.error('Failed to generate synthesis context', { error });

        // Fallback: continue with existing messages but switch tools
        return {
            activeTools: SYNTHESIS_PHASE_TOOLS,
        };
    }
}
