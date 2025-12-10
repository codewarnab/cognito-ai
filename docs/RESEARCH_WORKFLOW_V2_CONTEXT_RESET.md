# Research Workflow V2: Context Reset Architecture

**Goal**: Implement a cleaner context management strategy for the research workflow by completely resetting the message array when transitioning to synthesis phase, and building the report incrementally.

**Key Insight**: Instead of surgically truncating content from messages (complex, error-prone), we completely reset the context and embed all source metadata directly in the synthesis system prompt.

---

## Architecture Overview

### Current Flow (V1 - Problematic)

```
Research Phase:
  User: "Research topic X"
  ↓
  AI navigates, reads 5 pages (each adds 50KB to context)
  ↓
  prepareStep tries to truncate content from messages
  ↓
  Messages array still contains: tool calls, navigation history, truncated placeholders
  ↓
Synthesis Phase:
  Same bloated messages array sent to AI
  ↓
  AI calls listResearchSources() → more tokens used
  ↓
  AI tries to generate PDF in one shot (often without reading sources)
```

### New Flow (V2 - Context Reset)

```
Research Phase:
  User: "Research topic X"
  ↓
  AI navigates, reads pages, tags with futureUseGuideline
  ↓
  Content stored in IndexedDB (messages can grow, it's temporary)
  ↓
  When minimum sources met → CONTEXT RESET
  ↓
Synthesis Phase:
  FRESH message array with only:
    - System prompt containing ALL source metadata
    - Single user message: "Generate the research report"
  ↓
  AI knows exactly what sources exist (from system prompt)
  ↓
  For each section: readResearchMemory() → appendToReport()
  ↓
  generatePDF() compiles all sections
```

---

## Key Changes Summary

| Component | V1 (Current) | V2 (New) |
|-----------|--------------|----------|
| Context transition | Truncate content, keep history | Complete message reset |
| Source discovery | AI calls `listResearchSources` | Metadata embedded in system prompt |
| Report building | Single `generatePDF` with all content | Incremental `appendToReport` → final compile |
| Context size (synthesis) | 50KB+ (truncated history) | ~5KB (clean prompt + 1 source at a time) |
| AI behavior | Often skips reading sources | Forced to read each source |

---

## Phase 1: Add Report Buffer Infrastructure ✅ DONE

### 1.1 Extend Database Schema ✅

**File**: `src/db/index.ts`

Add a new table for storing report sections incrementally:

```typescript
// Add to type definitions
export interface ReportSection {
    id: string;              // Unique ID: 'section_1', 'section_2', etc.
    sessionId: string;       // Research session identifier
    sectionName: string;     // e.g., "Overview", "Key Features", "Pricing"
    content: string;         // Section content (markdown)
    order: number;           // Section order for final compilation
    createdAt: number;       // Timestamp
}

// Add to AppDB class
export class AppDB extends Dexie {
    settings!: Table<SettingRecord, string>;
    chatMessages!: Table<ChatMessage, string>;
    chatThreads!: Table<ChatThread, string>;
    researchSources!: Table<ResearchSource, string>;
    reportSections!: Table<ReportSection, string>;  // NEW TABLE

    constructor() {
        super('ChatDB');
        
        // Version 7: Add report sections for incremental building
        this.version(7).stores({
            settings: 'key',
            chatMessages: 'id, threadId, timestamp, sequenceNumber',
            chatThreads: 'id, createdAt, updatedAt',
            researchSources: 'sourceId, sessionId, expiresAt',
            reportSections: 'id, sessionId, order'  // NEW
        });
    }
}
```

### 1.2 Report Buffer CRUD Operations ✅

**File**: `src/db/index.ts` (add at end)

```typescript
// ============================================================================
// Report Sections API (For Incremental Report Building)
// ============================================================================

let reportSectionCounter = 0;

/**
 * Reset section counter (call when new session starts)
 */
export function resetReportSectionCounter(): void {
    reportSectionCounter = 0;
}

/**
 * Append a section to the report buffer
 */
export async function appendReportSection(params: {
    sessionId: string;
    sectionName: string;
    content: string;
}): Promise<{ sectionId: string; order: number }> {
    reportSectionCounter++;
    const sectionId = `section_${reportSectionCounter}`;
    
    await db.reportSections.put({
        id: sectionId,
        sessionId: params.sessionId,
        sectionName: params.sectionName,
        content: params.content,
        order: reportSectionCounter,
        createdAt: Date.now(),
    });
    
    return { sectionId, order: reportSectionCounter };
}

/**
 * Get all report sections for a session (ordered)
 */
export async function getReportSections(sessionId: string): Promise<ReportSection[]> {
    const sections = await db.reportSections
        .where('sessionId')
        .equals(sessionId)
        .toArray();
    
    return sections.sort((a, b) => a.order - b.order);
}

/**
 * Clear report sections for a session
 */
export async function clearReportSections(sessionId: string): Promise<void> {
    await db.reportSections
        .where('sessionId')
        .equals(sessionId)
        .delete();
    reportSectionCounter = 0;
}

/**
 * Compile all sections into final report content
 */
export async function compileReportContent(sessionId: string): Promise<string> {
    const sections = await getReportSections(sessionId);
    
    if (sections.length === 0) {
        return '';
    }
    
    return sections
        .map(s => `## ${s.sectionName}\n\n${s.content}`)
        .join('\n\n---\n\n');
}
```

---

## Phase 2: Create `appendToReport` Tool ✅ DONE

### 2.1 Tool Implementation ✅

**File**: `src/actions/research/appendToReport.tsx` (NEW)

```typescript
/**
 * Append To Report Tool
 * Incrementally builds report by adding sections to IndexedDB buffer
 */

import { useEffect } from 'react';
import { z } from 'zod';
import { registerTool } from '@/ai/tools';
import { appendReportSection, getCurrentResearchSessionId, getReportSections } from '@/db';
import { createLogger } from '~logger';

const log = createLogger('Tool-AppendToReport');

export function useAppendToReportTool() {
    useEffect(() => {
        registerTool({
            name: 'appendToReport',
            description: `Add a section to the report being built.

USE: During synthesis phase to build report incrementally, section by section.
REQUIRES: Active research session.
BEHAVIOR: Stores the section content in IndexedDB buffer for later compilation.
RETURNS: Confirmation with section ID and current section count.

WORKFLOW:
1. Read a source with readResearchMemory()
2. Extract/synthesize relevant information
3. Call appendToReport() with the section content
4. The source content can now be "forgotten" - it's captured in the report
5. Repeat for each section
6. Call generatePDF() to compile all sections

PARAMETERS:
- sectionName: Name of the template section (e.g., "Overview", "Key Features")
- content: The section content in markdown format
- sourceIds: Array of sourceIds used for this section (for citation tracking)

EXAMPLE:
appendToReport({
    sectionName: "Key Features",
    content: "## Key Features\\n\\nThe technology offers several compelling features:\\n\\n1. **Performance** - Up to 10x faster...\\n\\n2. **Scalability** - Handles millions of requests...",
    sourceIds: ["research_source_1", "research_source_3"]
})`,

            parameters: z.object({
                sectionName: z.string().describe('Name of the report section (should match template sections)'),
                content: z.string().describe('Section content in markdown format'),
                sourceIds: z.array(z.string()).optional().describe('Source IDs used for this section'),
            }),

            execute: async ({ sectionName, content, sourceIds }) => {
                try {
                    const sessionId = getCurrentResearchSessionId();
                    
                    if (!sessionId) {
                        log.warn('No active research session');
                        return {
                            success: false,
                            error: 'No active research session. Cannot append to report.'
                        };
                    }

                    const result = await appendReportSection({
                        sessionId,
                        sectionName,
                        content,
                    });

                    // Get current section count
                    const allSections = await getReportSections(sessionId);

                    log.info('Appended report section', { 
                        sessionId, 
                        sectionName,
                        sectionId: result.sectionId,
                        order: result.order,
                        contentLength: content.length,
                        sourceIds,
                        totalSections: allSections.length,
                    });

                    return {
                        success: true,
                        sectionId: result.sectionId,
                        sectionName,
                        order: result.order,
                        contentLength: content.length,
                        totalSectionsInReport: allSections.length,
                        sectionsAdded: allSections.map(s => s.sectionName),
                        message: `Added "${sectionName}" as section ${result.order}. Total sections: ${allSections.length}. Continue adding sections or call generatePDF() when ready.`
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    log.error('Failed to append report section', { sectionName, error: message });
                    return {
                        success: false,
                        error: message
                    };
                }
            }
        });

        return () => {
            log.debug('Cleanup: appendToReport tool');
        };
    }, []);
}
```

### 2.2 Update `generatePDF` Tool ✅

**File**: `src/actions/reports/generatePDF.tsx` (MODIFIED)

Updated to support compiling from buffer:

```typescript
// Add new parameter option for compilation mode
parameters: z.object({
    content: z.string().optional().describe('Direct content for PDF (optional if using compileFromBuffer)'),
    filename: z.string().optional().describe('Output filename without extension'),
    compileFromBuffer: z.boolean().optional().describe('If true, compile content from report sections buffer'),
}),

execute: async ({ content, filename, compileFromBuffer }) => {
    try {
        let finalContent = content;
        
        // If compileFromBuffer is true, get content from IndexedDB sections
        if (compileFromBuffer) {
            const sessionId = getCurrentResearchSessionId();
            if (!sessionId) {
                return {
                    success: false,
                    error: 'No active research session for compilation'
                };
            }
            
            finalContent = await compileReportContent(sessionId);
            
            if (!finalContent || finalContent.trim().length === 0) {
                return {
                    success: false,
                    error: 'No report sections found. Call appendToReport() to add sections first.'
                };
            }
            
            log.info('Compiled report from buffer', {
                sessionId,
                contentLength: finalContent.length
            });
        }
        
        if (!finalContent) {
            return {
                success: false,
                error: 'No content provided. Either pass content directly or use compileFromBuffer: true'
            };
        }
        
        // Rest of existing PDF generation logic...
        const actualFilename = filename ?? 'research-report';
        // ... (keep existing code)
    } catch (error) {
        // ... (keep existing error handling)
    }
}
```

### 2.3 Register New Tool ✅

**File**: `src/actions/research/index.tsx` (MODIFIED)

```typescript
import { useAddMemoryMetadataTool } from './addMemoryMetadata';
import { useReadResearchMemoryTool } from './readResearchMemory';
import { useListResearchSourcesTool } from './listResearchSources';
import { useInitResearchSessionTool } from './initResearchSession';
import { useAppendToReportTool } from './appendToReport';  // NEW

export function registerResearchMemoryTools() {
    useAddMemoryMetadataTool();
    useReadResearchMemoryTool();
    useListResearchSourcesTool();
    useInitResearchSessionTool();
    useAppendToReportTool();  // NEW
}
```

---

## Phase 3: Implement Context Reset in PrepareStep ✅ DONE

### 3.1 Store Original User Request ✅

**File**: `src/workflows/researchContext.ts` (MODIFY)

Add storage for the original user request:

```typescript
// Module-level state for research context
let researchContextActive = false;
let activeResearchSessionId: string | null = null;
let activeResearchThreadId: string | null = null;
let originalUserRequest: string | null = null;  // NEW
let researchTopic: string | null = null;        // NEW (extracted topic name)
let reportType: string | null = null;           // NEW (template type used)

/**
 * Start research context with user request preservation
 */
export function startResearchContext(params: {
    sessionId: string;
    threadId: string;
    userRequest?: string;
}): void {
    researchContextActive = true;
    activeResearchSessionId = params.sessionId;
    activeResearchThreadId = params.threadId;
    originalUserRequest = params.userRequest || null;
    
    // Reset counters
    resetTruncatedSources();
    resetReportSectionCounter();
    
    log.info('Research context started', {
        sessionId: params.sessionId,
        threadId: params.threadId,
        hasUserRequest: !!params.userRequest,
    });
}

/**
 * Set research metadata (called after getReportTemplate)
 */
export function setResearchMetadata(params: {
    topic: string;
    reportType: string;
}): void {
    researchTopic = params.topic;
    reportType = params.reportType;
    log.debug('Research metadata set', params);
}

/**
 * Get original user request
 */
export function getOriginalUserRequest(): string | null {
    return originalUserRequest;
}

/**
 * Get research metadata
 */
export function getResearchMetadata(): { topic: string | null; reportType: string | null } {
    return { topic: researchTopic, reportType };
}

/**
 * End research context
 */
export function endResearchContext(): void {
    researchContextActive = false;
    activeResearchSessionId = null;
    activeResearchThreadId = null;
    originalUserRequest = null;
    researchTopic = null;
    reportType = null;
    
    log.info('Research context ended');
}
```

### 3.2 Capture User Request in Workflow Start ✅

**File**: `src/ai/transport/SimpleFrontendTransport.ts` (MODIFY)

When workflow starts, capture the original user request:

```typescript
// In the workflow start handling section:
if (workflowId === 'research') {
    // Import required functions
    const { startResearchContext } = await import('@/workflows/researchContext');
    const { initResearchSession } = await import('@/db');
    
    // Initialize research session
    const sessionId = initResearchSession();
    
    // Extract original user request from messages
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    let userRequest = '';
    
    if (lastUserMessage?.parts) {
        const textPart = lastUserMessage.parts.find(p => p.type === 'text');
        if (textPart && 'text' in textPart) {
            userRequest = textPart.text;
        }
    }
    
    // Start research context with user request preserved
    startResearchContext({
        sessionId,
        threadId: currentThreadId,
        userRequest,
    });
    
    log.info('Research workflow started', { sessionId, userRequest });
}
```

### 3.3 Complete Context Reset in PrepareStep ✅

**File**: `src/workflows/definitions/researchWorkflowPrepareStep.ts` (MAJOR REWRITE)

```typescript
/**
 * Research Workflow PrepareStep V2
 * 
 * Key Change: Complete context reset when transitioning to synthesis phase
 * instead of trying to truncate individual message content.
 */

import type { ModelMessage, ToolResultPart } from 'ai';
import { createLogger } from '~logger';
import { getResearchWorkflowSettings } from '@/utils/settings/researchWorkflowSettings';
import { listResearchSources, getCurrentResearchSessionId } from '@/db';
import { getOriginalUserRequest, getResearchMetadata } from '../researchContext';
import type { WorkflowStepResult, PrepareStepContext, PrepareStepResult } from '../types';

const log = createLogger('ResearchPrepareStep', 'WORKFLOW');

/**
 * Track if we've already transitioned to synthesis
 * Prevents re-triggering context reset on subsequent steps
 */
let synthesisPhaseStarted = false;

export function resetSynthesisPhaseFlag(): void {
    synthesisPhaseStarted = false;
}

/**
 * Tools available during research/gathering phase
 */
const RESEARCH_PHASE_TOOLS = [
    'navigateTo',
    'switchTabs',
    'getActiveTab',
    'getAllTabs',
    'readPageContent',
    'extractText',
    'getSearchResults',
    'chromeSearch',
    'openSearchResult',
    'addMemoryMetadata',
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
 * Count sources read from steps
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
   generatePDF({ compileFromBuffer: true, filename: "research-${metadata.topic?.toLowerCase().replace(/\s+/g, '-') || 'report'}" })
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
 * PrepareStep function for research workflow (V2 - Context Reset)
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

    // Count sources read
    const sourcesReadCount = countSourcesRead(steps);
    log.debug(`Sources read so far: ${sourcesReadCount}`);

    // Check if we should transition to synthesis phase
    let settings;
    try {
        settings = await getResearchWorkflowSettings();
    } catch (error) {
        log.error('Failed to get research workflow settings', { error });
        settings = { minimumSources: 5 };
    }

    // Still in research phase
    if (sourcesReadCount < settings.minimumSources) {
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
                content: [
                    {
                        type: 'text',
                        text: generateSynthesisUserMessage(originalRequest),
                    }
                ],
            },
        ];

        log.info('Context reset complete', {
            previousMessageCount: messages.length,
            newMessageCount: synthesisMessages.length,
            synthesisPromptLength: synthesisPrompt.length,
        });

        return {
            system: synthesisPrompt,
            messages: synthesisMessages,
            activeTools: SYNTHESIS_PHASE_TOOLS,
        };
    } catch (error) {
        log.error('Failed to generate synthesis context', { error });
        
        // Fallback: continue with existing messages but switch tools
        return {
            activeTools: SYNTHESIS_PHASE_TOOLS,
        };
    }
}
```

### 3.4 Reset Flags on Session Start ✅

**File**: `src/workflows/researchContext.ts` (MODIFY)

Update `startResearchContext` to reset all flags:

```typescript
import { resetSynthesisPhaseFlag } from './definitions/researchWorkflowPrepareStep';
import { resetReportSectionCounter } from '@/db';

export function startResearchContext(params: {
    sessionId: string;
    threadId: string;
    userRequest?: string;
}): void {
    researchContextActive = true;
    activeResearchSessionId = params.sessionId;
    activeResearchThreadId = params.threadId;
    originalUserRequest = params.userRequest || null;
    researchTopic = null;
    reportType = null;
    
    // Reset all counters and flags
    resetTruncatedSources();
    resetReportSectionCounter();
    resetSynthesisPhaseFlag();  // NEW
    
    log.info('Research context started', {
        sessionId: params.sessionId,
        threadId: params.threadId,
    });
}
```

---

## Phase 4: Update getReportTemplate to Store Metadata ✅ DONE

### 4.1 Capture Topic and Report Type ✅

**File**: `src/actions/reports/getReportTemplate.tsx` (MODIFY)

```typescript
import { setResearchMetadata, isResearchContextActive } from '@/workflows/researchContext';

// In the execute function, after getting the template:
execute: async ({ reportType, topicName }) => {
    try {
        log.info('TOOL CALL: getReportTemplate', { reportType, topicName });

        const template = getTemplateByType(reportType as TemplateType);
        const topic = topicName || 'Research Topic';
        const templateMarkdown = formatTemplateAsMarkdown(template, topic);

        // Store metadata for synthesis phase
        if (isResearchContextActive()) {
            setResearchMetadata({
                topic,
                reportType: reportType as string,
            });
            log.debug('Research metadata captured', { topic, reportType });
        }

        log.info('✅ Template selected', {
            reportType,
            sectionCount: template.sections.length,
        });

        return {
            success: true,
            reportType,
            templateName: template.name,
            sections: template.sections,
            sectionCount: template.sections.length,
            markdownStructure: templateMarkdown,
            message: `Template "${template.name}" ready with ${template.sections.length} sections.`
        };
    } catch (error) {
        // ... error handling
    }
}
```

---

## Phase 5: Update Workflow Definition ✅ DONE

### 5.1 Update Allowed Tools ✅

**File**: `src/workflows/definitions/researchWorkflow.ts` (MODIFY)

```typescript
export function createResearchWorkflow(settings: ResearchWorkflowSettings): WorkflowDefinition {
    return {
        id: 'research',
        name: 'Research',
        description: 'Deep research with incremental report building',
        icon: 'search',
        color: '#1e3a8a',
        stepCount: settings.stepCount,
        allowedTools: [
            // Phase 1: Navigation & Content
            'navigateTo',
            'switchTabs',
            'getActiveTab',
            'getAllTabs',
            'readPageContent',
            'extractText',
            'getSearchResults',
            'chromeSearch',
            'openSearchResult',
            'addMemoryMetadata',
            'getReportTemplate',
            
            // Phase 2: Synthesis (prepareStep controls availability)
            'readResearchMemory',
            'appendToReport',      // NEW
            'generatePDF',
            
            // Note: listResearchSources removed - metadata embedded in prompt
        ],
        systemPrompt: generateSystemPrompt(settings.minimumSources),
        prepareStep: researchWorkflowPrepareStep,
    };
}
```

---

## Phase 6: Optional Optimization - Truncate After appendToReport

### 6.1 Advanced: Clear Source Content After Use

For maximum context efficiency, we can truncate `readResearchMemory` results after `appendToReport` is called for that source:

**File**: `src/workflows/definitions/researchWorkflowPrepareStep.ts` (OPTIONAL ENHANCEMENT)

```typescript
/**
 * Track which sources have been consumed (appended to report)
 */
const consumedSources = new Set<string>();

export function resetConsumedSources(): void {
    consumedSources.clear();
}

/**
 * Check if appendToReport was called with a source
 */
function getConsumedSourceIds(steps: WorkflowStepResult[]): Set<string> {
    const consumed = new Set<string>();
    
    for (const step of steps) {
        for (const toolCall of step.toolCalls) {
            if (toolCall.toolName === 'appendToReport') {
                const args = toolCall.args as { sourceIds?: string[] };
                if (args.sourceIds) {
                    args.sourceIds.forEach(id => consumed.add(id));
                }
            }
        }
    }
    
    return consumed;
}

/**
 * In synthesis phase, truncate readResearchMemory results for consumed sources
 */
function truncateConsumedSourceContent(
    messages: ModelMessage[],
    consumedSourceIds: Set<string>
): { messages: ModelMessage[]; hasChanges: boolean } {
    if (consumedSourceIds.size === 0) {
        return { messages, hasChanges: false };
    }

    let hasChanges = false;
    
    const newMessages = messages.map(msg => {
        if (msg.role !== 'tool') return msg;
        
        const content = msg.content;
        if (!Array.isArray(content)) return msg;
        
        const newContent = content.map(part => {
            if (typeof part !== 'object' || !part || !('type' in part)) return part;
            if (part.type !== 'tool-result') return part;
            
            const result = ('result' in part ? part.result : undefined) as any;
            if (!result?.sourceId) return part;
            
            // Check if this is a readResearchMemory result for a consumed source
            if (result.found && consumedSourceIds.has(result.sourceId) && !consumedSources.has(result.sourceId)) {
                consumedSources.add(result.sourceId);
                hasChanges = true;
                
                log.info(`Truncating consumed source content: ${result.sourceId}`);
                
                return {
                    ...part,
                    result: {
                        sourceId: result.sourceId,
                        found: true,
                        consumed: true,
                        message: `[Content for ${result.sourceId} has been added to report and cleared from context]`
                    }
                };
            }
            
            return part;
        });
        
        return { ...msg, content: newContent };
    });
    
    return { messages: hasChanges ? newMessages : messages, hasChanges };
}

// In the synthesis phase section of researchWorkflowPrepareStep:
if (synthesisPhaseStarted) {
    // Check for sources that have been consumed
    const consumedSourceIds = getConsumedSourceIds(steps);
    const { messages: truncatedMessages, hasChanges } = truncateConsumedSourceContent(messages, consumedSourceIds);
    
    return {
        activeTools: SYNTHESIS_PHASE_TOOLS,
        ...(hasChanges && { messages: truncatedMessages }),
    };
}
```

---

## Phase 7: Testing Checklist

### 7.1 Unit Tests

```typescript
// src/__tests__/researchWorkflowV2.test.ts

describe('Research Workflow V2 - Context Reset', () => {
    describe('Phase Transition', () => {
        it('should reset messages when minimum sources reached', async () => {
            // Setup: Create steps with 5 readPageContent calls
            const steps = Array(5).fill(null).map((_, i) => ({
                toolCalls: [{ toolName: 'readPageContent', args: {} }]
            }));
            
            const result = await researchWorkflowPrepareStep({
                stepNumber: 6,
                steps,
                messages: [/* many research messages */],
            });
            
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0].role).toBe('user');
            expect(result.activeTools).toEqual(SYNTHESIS_PHASE_TOOLS);
        });
        
        it('should embed source metadata in system prompt', async () => {
            // Setup with sources in DB
            const result = await researchWorkflowPrepareStep({...});
            
            expect(result.system).toContain('research_source_1');
            expect(result.system).toContain('Your Available Research Sources');
        });
    });
    
    describe('Incremental Report Building', () => {
        it('should accumulate sections in buffer', async () => {
            await appendReportSection({ sessionId: 'test', sectionName: 'Overview', content: '...' });
            await appendReportSection({ sessionId: 'test', sectionName: 'Features', content: '...' });
            
            const sections = await getReportSections('test');
            expect(sections).toHaveLength(2);
            expect(sections[0].sectionName).toBe('Overview');
            expect(sections[1].sectionName).toBe('Features');
        });
        
        it('should compile sections in order', async () => {
            const compiled = await compileReportContent('test');
            expect(compiled).toContain('## Overview');
            expect(compiled).toContain('## Features');
        });
    });
});
```

### 7.2 Integration Test Scenarios

1. **Happy Path**:
   - Start research workflow with "Research React"
   - Navigate and read 5 sources
   - Verify context reset at step 6
   - Verify synthesis prompt contains source metadata
   - Build report section by section
   - Generate PDF

2. **Source Tracking**:
   - Verify sourceIds are properly tracked in appendToReport
   - Verify consumed sources can be truncated

3. **Error Recovery**:
   - Test workflow recovery if browser crashes mid-synthesis
   - Verify report sections persist in IndexedDB

---

## Migration Notes

### Breaking Changes

1. `listResearchSources` tool is no longer needed in synthesis phase (metadata embedded in prompt)
2. `generatePDF` now supports `compileFromBuffer` mode
3. New `appendToReport` tool is required for incremental building

### Rollback Plan

If issues arise, the V1 truncation approach can be restored by:
1. Reverting `researchWorkflowPrepareStep.ts` to previous version
2. Removing `appendToReport` tool
3. Re-enabling `listResearchSources` in synthesis tools

---

## Summary

This V2 implementation provides:

✅ **Clean Context Reset**: Complete message history reset instead of surgical truncation
✅ **Embedded Metadata**: Source info in system prompt, no extra tool call needed
✅ **Incremental Building**: Section-by-section report construction
✅ **Memory Efficiency**: Sources can be consumed and cleared after use
✅ **Better AI Guidance**: Detailed synthesis prompt forces proper workflow

Expected improvements:
- 80%+ reduction in synthesis phase context size
- More reliable source reading (AI must call readResearchMemory)
- Better report quality (structured section-by-section approach)
- Easier debugging (clear phase separation)
