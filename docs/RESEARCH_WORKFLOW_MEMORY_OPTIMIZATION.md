# Research Workflow Memory Optimization Implementation Plan

**Goal**: Implement context engineering for the research workflow using IndexedDB as a "file system" for content storage, reducing AI context window usage and improving efficiency.

**Core Philosophy**: Context Window is for Reasoning, IndexedDB is for Storage.

---

## Overview of Changes

### Current Flow (Inefficient)
```
User: "Research topic X"
↓
Agent: readPageContent()
↓
Response: "[50KB of page content in context]"
↓
Agent continues with 50KB in memory × 5 sources = 250KB context bloat
```

### New Flow (Optimized)
```
User: "Research topic X"
↓
Workflow starts → SimpleFrontendTransport calls startResearchContext(threadId)
  → Sets module-level state in researchContext.ts
  → Initializes IndexedDB session
↓
Agent: getReportTemplate({ reportType: 'technology', topicName: 'topic X' })
  → Returns template with sections: Overview, Key Features, Technical Architecture, etc.
  → AI now knows EXACTLY what information to gather
↓
Agent: navigateTo() → getSearchResults() → openSearchResult({ ranks: [1,2,3,4,5] })
  → Opens 5 tabs with search results
↓
For EACH source:
  Agent: switchTabs({ tabId: 101 }) → readPageContent()
    → Tool checks isResearchContextActive() (module-level state)
    → Auto-stores to IndexedDB AND returns full content
  Response: { sourceId: 'research_source_1', content: '[50KB]', stored: true }
    (Note: AI sees content so it can write meaningful futureUseGuideline)
  ↓
  Agent: addMemoryMetadata({ 
    sourceId: 'research_source_1', 
    futureUseGuideline: 'Use for Key Features section. Lists core capabilities and performance benchmarks.' 
  })
  Response: "Metadata saved."
  ↓
  [Next step: prepareStep runs before AI continues]
    → Detects addMemoryMetadata was called for source_1
    → Truncates source_1's content in message history
    → AI's context now has: "research_source_1 stored (50KB), guideline: use for Key Features section"
↓
After 5 sources: Only ~2KB metadata in context vs 250KB raw content (99% reduction)
↓
Synthesis phase (auto-triggered when minimum sources met):
  → listResearchSources() shows all sources with futureUseGuideline
  → For each template section, readResearchMemory({ sourceId }) loads relevant content on-demand
  → generatePDF() creates final report structured by template
```

**Key Optimization**: `readPageContent` returns full content initially (so AI can write meaningful futureUseGuideline), but `prepareStep` truncates old content from message history after `addMemoryMetadata` is called!

### Architecture Summary

| Component | Responsibility |
|-----------|----------------|
| `researchContext.ts` | Module-level state for detecting research mode (tools call `isResearchContextActive()`) |
| `SimpleFrontendTransport.ts` | Starts/ends research context when workflow starts/ends |
| `getReportTemplate` tool | Returns template structure based on research type (person/technology/company/etc.) |
| `readPageContent` tool | Auto-stores to IndexedDB when in research mode, returns full content |
| `addMemoryMetadata` tool | AI calls this to tag sources with futureUseGuideline referencing template sections |
| `prepareStep` (workflow-defined) | Truncates old content from messages after metadata is added |
| `WorkflowDefinition.prepareStep` | Each workflow can define its own prepareStep function |
| `templates.ts` | Defines report templates with sections for each research type |

---

## Phase 1: Database Schema & Core Memory Infrastructure

### 1.1 Extend IndexedDB Schema

**File**: `src/db/index.ts`

Add new table to store research session data:

```typescript
// Add to type definitions
export interface ResearchSource {
  sourceId: string;           // Unique ID: 'research_source_1', 'research_source_2', etc.
  sessionId: string;          // Research session identifier
  url: string;                // Source URL
  title: string;              // Page title
  content: string;            // Full page content (can be 50KB+)
  futureUseGuideline: string; // AI's note on when to use this source
  savedAt: number;            // Timestamp
  expiresAt: number;          // Auto-delete after 30 minutes
}

// In AppDB class constructor
export class AppDB extends Dexie {
  settings!: Table<SettingRecord, string>;
  chatMessages!: Table<ChatMessage, string>;
  chatThreads!: Table<ChatThread, string>;
  researchSources!: Table<ResearchSource, string>; // NEW TABLE

  constructor() {
    super('ChatDB');
    
    // ... existing versions ...
    
    // Version 6: Add research sources storage for context optimization
    this.version(6).stores({
      settings: 'key',
      chatMessages: 'id, threadId, timestamp, sequenceNumber',
      chatThreads: 'id, createdAt, updatedAt',
      researchSources: 'sourceId, sessionId, expiresAt' // Index by sourceId, sessionId, expiresAt
    });
  }
}
```

### 1.2 Research Memory CRUD Operations

**File**: `src/db/index.ts` (add at end)

```typescript
// ============================================================================
// Research Sources API (For Research Workflow Memory Optimization)
// ============================================================================

/**
 * Generate unique source ID for current session
 */
let researchSourceCounter = 0;
let currentResearchSessionId: string | null = null;

export function initResearchSession(): string {
  currentResearchSessionId = `research_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  researchSourceCounter = 0;
  return currentResearchSessionId;
}

export function getNextSourceId(): string {
  researchSourceCounter++;
  return `research_source_${researchSourceCounter}`;
}

export function getCurrentResearchSessionId(): string | null {
  return currentResearchSessionId;
}

/**
 * Save page content to research memory
 * Auto-stores content without requiring AI to output full tokens
 */
export async function saveResearchSource(params: {
  sourceId: string;
  sessionId: string;
  url: string;
  title: string;
  content: string;
}): Promise<void> {
  const now = Date.now();
  const expiresAt = now + (30 * 60 * 1000); // 30 minutes from now

  await db.researchSources.put({
    ...params,
    futureUseGuideline: '', // Will be set by addMemoryMetadata
    savedAt: now,
    expiresAt
  });
}

/**
 * Add metadata (futureUseGuideline) to existing research source
 * This is what the AI calls explicitly
 */
export async function addResearchMetadata(params: {
  sourceId: string;
  futureUseGuideline: string;
}): Promise<void> {
  const source = await db.researchSources.get(params.sourceId);
  if (!source) {
    throw new Error(`Research source ${params.sourceId} not found`);
  }

  await db.researchSources.update(params.sourceId, {
    futureUseGuideline: params.futureUseGuideline
  });
}

/**
 * Read full content of a research source
 * Used during synthesis phase when AI needs specific details
 */
export async function readResearchMemory(sourceId: string): Promise<ResearchSource | null> {
  const source = await db.researchSources.get(sourceId);
  return source || null;
}

/**
 * List all sources for current research session
 * Returns metadata only (no full content)
 */
export async function listResearchSources(sessionId: string): Promise<Array<{
  sourceId: string;
  url: string;
  title: string;
  futureUseGuideline: string;
  savedAt: number;
}>> {
  const sources = await db.researchSources
    .where('sessionId')
    .equals(sessionId)
    .toArray();

  return sources.map(s => ({
    sourceId: s.sourceId,
    url: s.url,
    title: s.title,
    futureUseGuideline: s.futureUseGuideline,
    savedAt: s.savedAt
  }));
}

/**
 * Delete expired research sources (auto-cleanup)
 * Called by background alarm every 5 minutes
 */
export async function cleanupExpiredResearchSources(): Promise<number> {
  const now = Date.now();
  const expired = await db.researchSources
    .where('expiresAt')
    .below(now)
    .toArray();

  await db.researchSources
    .where('expiresAt')
    .below(now)
    .delete();

  return expired.length;
}

/**
 * Manually clear all sources for a session
 */
export async function clearResearchSession(sessionId: string): Promise<void> {
  await db.researchSources
    .where('sessionId')
    .equals(sessionId)
    .delete();
}
```

---

## Phase 2: Modified `readPageContent` Tool

### 2.1 Create Enhanced `readPageContent` for Research Workflow

**File**: `src/actions/dom/readPageContent.tsx`

**Critical Changes**:
1. **NO `autoStore` parameter** - Uses module-level research context to detect workflow
2. **Returns full content AND stores to IndexedDB** - AI needs to see content to write meaningful futureUseGuideline
3. Auto-stores to IndexedDB transparently
4. **prepareStep removes old content** - After AI calls addMemoryMetadata, the full content is truncated from context

**Why this is better**:
- AI can read content and write meaningful futureUseGuideline
- Content is automatically stored for later retrieval
- prepareStep handles context cleanup after metadata is added
- No manual parameter passing needed

**Updated Implementation**:

```typescript
import { getNextSourceId, getActiveResearchSessionId, saveResearchSource } from '@/db';
import { isResearchContextActive } from '@/workflows/researchContext';
import { createLogger } from '~logger';

const log = createLogger('readPageContent');

// Inside the execute function of readPageContent tool:

// Check if we're in research workflow via module-level context
const isResearchMode = isResearchContextActive();
const sessionId = getActiveResearchSessionId();

if (isResearchMode && sessionId) {
  // In research mode: store full content to IndexedDB AND return it
  // AI needs to see content to write meaningful futureUseGuideline
  const sourceId = getNextSourceId();

  await saveResearchSource({
    sourceId,
    sessionId,
    url: pageData.url,
    title: pageData.title,
    content: pageData.content, // Store FULL content in IndexedDB
  });

  log.info(`Stored ${pageData.content.length} chars to ${sourceId}`);

  // Return full content + metadata so AI can read it and write futureUseGuideline
  // The content will be truncated/removed from context via prepareStep after AI calls addMemoryMetadata
  return {
    success: true,
    stored: true,
    sourceId,
    sessionId,
    title: pageData.title,
    url: pageData.url,
    content: pageData.content, // AI needs to see this to write futureUseGuideline
    contentLength: pageData.content.length,
    message: `Content stored to ${sourceId}. Call addMemoryMetadata immediately to tag this source.`,
  };
}

// Non-research workflow: return full content (normal behavior)
return { content: pageData.content, ... };
```

**Key Innovation**: AI sees full content initially to write meaningful futureUseGuideline, then prepareStep removes old content from context!

---

## Phase 3: New Memory Tools

### 3.1 `addMemoryMetadata` Tool

**File**: `src/actions/research/addMemoryMetadata.tsx` (NEW)

```typescript
import { useEffect } from 'react';
import { z } from 'zod';
import { registerTool } from '@/ai/tools/registryUtils';
import { addResearchMetadata } from '@/db';
import { createLogger } from '~logger';

const log = createLogger('addMemoryMetadata');

export function useAddMemoryMetadataTool() {
  useEffect(() => {
    registerTool({
      name: 'addMemoryMetadata',
      description: `Add future-use guideline to a stored research source.

      USE: IMMEDIATELY after readPageContent in research workflow.
      REQUIRES: Valid sourceId from previous readPageContent call.
      BEHAVIOR: Stores metadata about when/how to use this source during synthesis.
      RETURNS: Confirmation message.
      
      CRITICAL: This is NOT for storing the full content (already auto-saved).
      This is ONLY for your note on when to read this file during report generation.
      
      EXAMPLE: addMemoryMetadata({ 
        sourceId: 'research_source_1', 
        futureUseGuideline: 'Read this when writing Section 2 (Pricing). Contains detailed pricing table and competitor comparison.' 
      })`,
      
      parameters: z.object({
        sourceId: z.string().describe('Source ID from readPageContent (e.g., research_source_1)'),
        futureUseGuideline: z.string().describe('Short note on when to read this during report generation. Be specific about which section/topic needs this source.')
      }),
      
      execute: async ({ sourceId, futureUseGuideline }) => {
        try {
          await addResearchMetadata({ sourceId, futureUseGuideline });
          
          log.info(`Metadata added to ${sourceId}`);
          
          return {
            success: true,
            message: `Metadata saved for ${sourceId}. Read this when: ${futureUseGuideline}`
          };
        } catch (err) {
          log.error('Failed to add metadata', err);
          throw err;
        }
      }
    });
  }, []);
}
```

### 3.2 `readResearchMemory` Tool

**File**: `src/actions/research/readResearchMemory.tsx` (NEW)

```typescript
import { useEffect } from 'react';
import { z } from 'zod';
import { registerTool } from '@/ai/tools/registryUtils';
import { readResearchMemory } from '@/db';
import { createLogger } from '~logger';

const log = createLogger('readResearchMemory');

export function useReadResearchMemoryTool() {
  useEffect(() => {
    registerTool({
      name: 'readResearchMemory',
      description: `Read full content of a stored research source.

      USE: During report synthesis phase when you need specific details from a source.
      REQUIRES: Valid sourceId from listResearchSources.
      BEHAVIOR: Retrieves full page content from storage.
      RETURNS: Full content + metadata.
      
      WHEN TO USE:
      - You're writing the report and need a specific quote/detail
      - You need to verify information from a source
      - You're extracting data for a specific section
      
      DO NOT USE:
      - During initial research phase (content already in context then)
      - To "check what you have" (use listResearchSources instead)
      
      EXAMPLE: readResearchMemory({ sourceId: 'research_source_1' })`,
      
      parameters: z.object({
        sourceId: z.string().describe('Source ID to read (e.g., research_source_1)')
      }),
      
      execute: async ({ sourceId }) => {
        const source = await readResearchMemory(sourceId);
        
        if (!source) {
          return {
            found: false,
            message: `Source ${sourceId} not found or expired.`
          };
        }

        log.info(`Retrieved ${sourceId} (${source.content.length} chars)`);
        
        return {
          found: true,
          sourceId: source.sourceId,
          url: source.url,
          title: source.title,
          content: source.content,
          futureUseGuideline: source.futureUseGuideline,
          message: `Retrieved ${sourceId}. Use guideline: ${source.futureUseGuideline}`
        };
      }
    });
  }, []);
}
```

### 3.3 `listResearchSources` Tool

**File**: `src/actions/research/listResearchSources.tsx` (NEW)

```typescript
import { useEffect } from 'react';
import { z } from 'zod';
import { registerTool } from '@/ai/tools/registryUtils';
import { listResearchSources, getCurrentResearchSessionId } from '@/db';
import { createLogger } from '~logger';

const log = createLogger('listResearchSources');

export function useListResearchSourcesTool() {
  useEffect(() => {
    registerTool({
      name: 'listResearchSources',
      description: `List all stored research sources for current session.

      USE: During synthesis phase to see what sources you have available.
      REQUIRES: Active research session.
      BEHAVIOR: Returns metadata for all sources (no full content).
      RETURNS: Array of {sourceId, url, title, futureUseGuideline}.
      
      WHEN TO USE:
      - Before starting report writing (to know what you have)
      - To decide which sources to read for specific sections
      - To verify you've gathered enough sources
      
      EXAMPLE: listResearchSources()`,
      
      parameters: z.object({}),
      
      execute: async () => {
        const sessionId = getCurrentResearchSessionId();
        if (!sessionId) {
          return {
            sources: [],
            message: 'No active research session.'
          };
        }

        const sources = await listResearchSources(sessionId);
        
        log.info(`Listed ${sources.length} sources for session ${sessionId}`);
        
        return {
          sources,
          count: sources.length,
          message: `Found ${sources.length} sources in current research session.`
        };
      }
    });
  }, []);
}
```

### 3.4 `initResearchSession` Tool

**File**: `src/actions/research/initResearchSession.tsx` (NEW)

```typescript
import { useEffect } from 'react';
import { z } from 'zod';
import { registerTool } from '@/ai/tools/registryUtils';
import { initResearchSession } from '@/db';
import { createLogger } from '~logger';

const log = createLogger('initResearchSession');

export function useInitResearchSessionTool() {
  useEffect(() => {
    registerTool({
      name: 'initResearchSession',
      description: `Initialize a new research session.

      USE: At the very start of research workflow, before first readPageContent.
      REQUIRES: Nothing.
      BEHAVIOR: Creates unique session ID, resets source counter.
      RETURNS: Session ID.
      
      CRITICAL: Must be called BEFORE any readPageContent with autoStore=true.
      
      EXAMPLE: initResearchSession() → Start research`,
      
      parameters: z.object({}),
      
      execute: async () => {
        const sessionId = initResearchSession();
        
        log.info(`Initialized research session: ${sessionId}`);
        
        return {
          sessionId,
          message: `Research session ${sessionId} initialized. Ready to store sources.`
        };
      }
    });
  }, []);
}
```

### 3.5 Register New Tools

**File**: `src/actions/research/index.tsx` (NEW)

```typescript
import { useAddMemoryMetadataTool } from './addMemoryMetadata';
import { useReadResearchMemoryTool } from './readResearchMemory';
import { useListResearchSourcesTool } from './listResearchSources';
import { useInitResearchSessionTool } from './initResearchSession';

export function registerResearchMemoryTools() {
  useAddMemoryMetadataTool();
  useReadResearchMemoryTool();
  useListResearchSourcesTool();
  useInitResearchSessionTool();
}
```

**File**: `src/actions/registerAll.ts`

```typescript
import { registerResearchMemoryTools } from "./research"; // ADD THIS

export function useRegisterAllActions() {
  // ... existing registrations ...
  registerResearchMemoryTools(); // ADD THIS
}
```

---

## Phase 4: Background Cleanup Alarm

### 4.1 Auto-Delete Expired Sources

**File**: `src/background/alarms/researchCleanup.ts` (NEW)

```typescript
import { createLogger } from '~logger';
import { cleanupExpiredResearchSources } from '@/db';

const log = createLogger('ResearchCleanup');

/**
 * Setup alarm to clean expired research sources every 30 minutes
 */
export function setupResearchCleanupAlarm() {
  // Create alarm that fires every 30 minutes
  chrome.alarms.create('research-cleanup', {
    periodInMinutes: 30
  });

  log.info('Research cleanup alarm created (runs every 30 minutes)');
}

/**
 * Handle research cleanup alarm
 */
export async function handleResearchCleanup() {
  try {
    const deletedCount = await cleanupExpiredResearchSources();
    
    if (deletedCount > 0) {
      log.info(`Cleaned up ${deletedCount} expired research sources`);
    }
  } catch (err) {
    log.error('Failed to cleanup expired sources', err);
  }
}
```

**File**: `src/background/alarms/index.ts`

```typescript
import { setupResearchCleanupAlarm, handleResearchCleanup } from './researchCleanup'; // ADD

// In initialization function
export function initializeAlarms() {
  // ... existing alarms ...
  setupResearchCleanupAlarm(); // ADD
}

// In alarm listener
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'research-cleanup') {
    await handleResearchCleanup(); // ADD
  }
  // ... existing alarm handlers ...
});
```

---

## Phase 5: PrepareStep Logic for Context Cleanup

### 5.0 Architecture Decision: Workflow-Defined PrepareStep

**Key Design Choice**: Each workflow defines its own `prepareStep` function in its workflow definition. This is modular and allows different workflows to have different step preparation logic.

**How it works**:
1. Workflow definition includes optional `prepareStep` function
2. When workflow is active, `aiLogic.ts` passes the workflow's `prepareStep` to `streamText`
3. AI SDK calls `prepareStep` before each step with full context (`steps`, `messages`, `stepNumber`, `model`)
4. Workflow's `prepareStep` can modify system prompt, active tools, and even message history

**Context Passing to Tools**: Instead of `experimental_context` (which requires AI SDK changes), we use the existing `researchContext.ts` module-level state. Tools call `isResearchContextActive()` and `getActiveResearchSessionId()` to detect research mode.

### 5.1 Update Workflow Types

**File**: `src/workflows/types.ts`

Add `prepareStep` to workflow definition type:

```typescript
import type { PrepareStepFunction } from 'ai';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  stepCount: number;
  allowedTools: string[];
  systemPrompt: string;
  
  /**
   * Optional prepareStep function for dynamic step preparation.
   * Called by AI SDK before each step with full context.
   * Can modify system prompt, active tools, and message history.
   * 
   * @remarks
   * This allows workflows to implement custom logic like:
   * - Phase transitions (research → synthesis)
   * - Context cleanup (truncating old tool results)
   * - Dynamic tool availability
   */
  prepareStep?: PrepareStepFunction<Record<string, unknown>>;
}
```

### 5.2 Update StreamExecutor Types

**File**: `src/ai/stream/streamExecutor.ts`

Update the `prepareStep` parameter type from `any` to proper AI SDK type:

```typescript
import type { PrepareStepFunction } from 'ai';

export async function executeStreamText(params: {
    // ... existing params ...
    prepareStep?: PrepareStepFunction<Record<string, unknown>>;
    activeTools?: string[];
}) {
    // ... implementation unchanged ...
}
```

### 5.3 Pass Workflow PrepareStep in aiLogic.ts

**File**: `src/ai/core/aiLogic.ts`

When a workflow is active, use its `prepareStep` instead of the default:

```typescript
// In the section where workflow is detected:
if (workflowConfig) {
  // Use workflow's prepareStep if defined, otherwise use default
  const workflowPrepareStep = workflowConfig.prepareStep;
  
  // ... later in executeStreamText call:
  prepareStep: workflowPrepareStep ?? defaultPrepareStep,
}
```

### 5.4 Implement Research Workflow PrepareStep

**File**: `src/workflows/definitions/researchWorkflow.ts`

```typescript
import type { PrepareStepFunction, StepResult, ModelMessage } from 'ai';
import { createLogger } from '~logger';
import { getResearchWorkflowSettings } from '@/utils/settings';
import { listResearchSources, getActiveResearchSessionId } from '@/db';

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
}

/**
 * PrepareStep function for research workflow
 * 
 * Handles:
 * 1. Counting sources read (from steps array - single source of truth)
 * 2. Truncating old readPageContent results from message history (context cleanup)
 * 3. Removing navigation tools when minimum sources met (phase transition)
 * 4. Updating system prompt for synthesis phase
 * 
 * @remarks
 * AI SDK PrepareStepFunction signature:
 * (options: {
 *   steps: Array<StepResult<TOOLS>>,
 *   stepNumber: number,
 *   model: LanguageModel,
 *   messages: Array<ModelMessage>
 * }) => PrepareStepResult<TOOLS> | undefined
 */
export const researchWorkflowPrepareStep: PrepareStepFunction<Record<string, unknown>> = async ({
  stepNumber,
  steps,
  messages,
}) => {
  log.debug(`Step ${stepNumber}: Preparing research workflow step`);

  // =========================================================================
  // 1. Count sources read from steps array (single source of truth)
  // =========================================================================
  const sourcesReadCount = steps.filter(step =>
    step.toolCalls.some(tc => tc.toolName === 'readPageContent')
  ).length;

  log.debug(`Sources read so far: ${sourcesReadCount}`);

  // =========================================================================
  // 2. Context Cleanup: Truncate old readPageContent results
  // =========================================================================
  // Find readPageContent tool results that have been followed by addMemoryMetadata
  // These can be safely truncated since content is stored in IndexedDB
  
  const modifiedMessages = truncateOldPageContent(messages, steps);
  const messagesChanged = modifiedMessages !== messages;

  // =========================================================================
  // 3. Check if we should transition to synthesis phase
  // =========================================================================
  const settings = await getResearchWorkflowSettings();

  if (sourcesReadCount >= settings.minimumSources) {
    log.info(`Minimum sources (${settings.minimumSources}) met. Switching to synthesis mode.`);

    // Remove navigation/reading tools, keep only synthesis tools
    const synthesisTools = [
      'listResearchSources',    // See all sources with futureUseGuideline
      'readResearchMemory',     // Load content on-demand for each section
      'getReportTemplate',      // Reference template structure during synthesis
      'generatePDF',            // MANDATORY final step
    ];

    // Update system prompt to synthesis-focused instructions
    const synthesisPrompt = generateSynthesisPrompt(sourcesReadCount);

    return {
      system: synthesisPrompt,
      activeTools: synthesisTools,
      ...(messagesChanged && { messages: modifiedMessages }),
    };
  }

  // Not in synthesis mode yet - only return modified messages if changed
  if (messagesChanged) {
    return { messages: modifiedMessages };
  }

  return undefined; // No changes needed
};

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
 * @param steps - All previous step results
 * @returns Modified messages array (or same array if no changes)
 */
function truncateOldPageContent(
  messages: Array<ModelMessage>,
  steps: Array<StepResult<Record<string, unknown>>>
): Array<ModelMessage> {
  // Build set of sourceIds that have metadata added
  const sourceIdsWithMetadata = new Set<string>();
  
  for (const step of steps) {
    for (const toolCall of step.toolCalls) {
      if (toolCall.toolName === 'addMemoryMetadata') {
        const args = toolCall.args as { sourceId?: string };
        if (args.sourceId) {
          sourceIdsWithMetadata.add(args.sourceId);
        }
      }
    }
  }

  // If no metadata added yet, no truncation needed
  if (sourceIdsWithMetadata.size === 0) {
    return messages;
  }

  let hasChanges = false;
  const newMessages = messages.map(msg => {
    // Only process tool result messages
    if (msg.role !== 'tool') {
      return msg;
    }

    // Check if this is a readPageContent result with a sourceId we can truncate
    const content = msg.content;
    if (!Array.isArray(content)) {
      return msg;
    }

    const newContent = content.map(part => {
      if (part.type !== 'tool-result') {
        return part;
      }

      // Check if this is a readPageContent result
      const result = part.result as Record<string, unknown> | undefined;
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

      log.info(`Truncating content for ${sourceId} (metadata added)`);

      return {
        ...part,
        result: {
          sourceId: result.sourceId,
          url: result.url,
          title: result.title,
          stored: true,
          contentLength: result.contentLength,
          // Replace full content with truncation notice
          content: `[Content stored to IndexedDB - ${result.contentLength} chars. Use readResearchMemory("${sourceId}") to retrieve during synthesis.]`,
          message: result.message,
        },
      };
    });

    return { ...msg, content: newContent };
  });

  return hasChanges ? newMessages : messages;
}

/**
 * Generate synthesis phase system prompt
 * Called by prepareStep when minimum sources have been gathered
 */
function generateSynthesisPrompt(sourcesReadCount: number): string {
  return `You have gathered ${sourcesReadCount} sources. Now SYNTHESIZE findings into a comprehensive report.

=== SYNTHESIS PHASE INSTRUCTIONS ===

You are now in SYNTHESIS MODE. Navigation tools have been removed.
Your job is to create a well-structured report using the template you retrieved earlier.

STEP-BY-STEP SYNTHESIS WORKFLOW:

1. LIST YOUR SOURCES
   → listResearchSources()
   → Review each source's futureUseGuideline to understand what information you have
   → Map sources to template sections based on guidelines

2. WRITE REPORT SECTION BY SECTION
   For each template section:
   a) Identify which sources are relevant (check futureUseGuideline)
   b) Load source content on-demand: readResearchMemory({ sourceId: 'research_source_X' })
   c) Extract relevant information for that section
   d) Synthesize across multiple sources when applicable
   e) Move to next section

   IMPORTANT: Only load sources when you need them for a specific section.
   DO NOT load all sources at once - this defeats the memory optimization!

3. GENERATE PDF (MANDATORY)
   → generatePDF({ filename: 'research-[topic]', content: '...' })
   → Include ALL template sections
   → Use plain text only (no emojis or special Unicode)

AVAILABLE TOOLS (SYNTHESIS ONLY):
- listResearchSources - See all sources with their futureUseGuideline tags
- readResearchMemory - Load full content of a specific source when needed for a section
- generatePDF - Generate final report (MANDATORY - workflow cannot complete without this)

CRITICAL RULES:
- DO NOT try to navigate or read new pages (tools removed)
- DO NOT load all sources at once (defeats memory optimization)
- DO use futureUseGuideline to decide which source to read for each section
- DO structure report according to the template sections
- DO cross-reference facts across sources before including
- DO call generatePDF before completing workflow

QUALITY STANDARDS:
- Each template section should have substantive content
- Cite sources where appropriate (URL or title)
- Synthesize information - don't just copy/paste
- Prioritize actionable, practical insights
- Cross-reference facts across sources

WORKFLOW COMPLETION:
- Add [WORKFLOW_COMPLETE] ONLY after generatePDF succeeds
- Never complete without generating the PDF

Begin synthesis by calling listResearchSources().`;
}
```

### 5.5 Add PrepareStep to Workflow Definition

**File**: `src/workflows/definitions/researchWorkflow.ts`

Update the workflow definition to include the prepareStep:

```typescript
import { researchWorkflowPrepareStep } from './researchWorkflowPrepareStep';

export function createResearchWorkflow(settings: ResearchWorkflowSettings): WorkflowDefinition {
  return {
    id: 'research',
    name: 'Research',
    description: 'Deep research with context-optimized memory storage',
    icon: 'search',
    color: '#1e3a8a',
    stepCount: settings.stepCount,
    allowedTools: [
      // Phase 1: Template & Navigation
      'getReportTemplate',      // CALL FIRST to determine research structure
      'navigateTo',
      'switchTabs',
      'getActiveTab',
      'getAllTabs',
      
      // Phase 1: Content Extraction with Memory
      'readPageContent',        // Auto-stores to IndexedDB, returns sourceId
      'extractText',
      'getSearchResults',
      'chromeSearch',
      'openSearchResult',
      'addMemoryMetadata',      // Tag sources with futureUseGuideline

      // Phase 2: Synthesis (navigation tools removed by prepareStep)
      'listResearchSources',    // See all sources with guidelines
      'readResearchMemory',     // Load content on-demand for synthesis
      'generatePDF',            // MANDATORY final step
    ],
    systemPrompt: generateSystemPrompt(settings.minimumSources),
    
    // Workflow-specific prepareStep for context optimization
    // Handles: source counting, content truncation, phase transitions
    prepareStep: researchWorkflowPrepareStep,
  };
}
```

**Note**: `getReportTemplate` is available in BOTH phases:
- Phase 1: Called FIRST to determine what information to gather
- Phase 2: Can be called again if AI needs to reference template structure during synthesis

### 5.6 Context Passing: Using researchContext.ts (NOT experimental_context)

**Important**: Instead of using AI SDK's `experimental_context` (which would require changes to tool execution flow), we use the existing `researchContext.ts` module-level state.

**File**: `src/workflows/researchContext.ts` (already exists)

Tools detect research mode by calling:
```typescript
import { isResearchContextActive, getActiveResearchSessionId } from '@/workflows/researchContext';

// In tool execute function:
const isResearchMode = isResearchContextActive();
const sessionId = getActiveResearchSessionId();

if (isResearchMode && sessionId) {
  // Research workflow behavior
}
```

**Why this approach**:
- No changes needed to AI SDK tool execution
- Already implemented and working
- Module-level state is simple and reliable
- Context is started/ended by `SimpleFrontendTransport.ts` when workflow starts/ends

---

## Phase 6: System Prompt Updates

### 6.1 Update Research Workflow System Prompt

**File**: `src/workflows/definitions/researchWorkflow.ts`

Update `generateSystemPrompt()` to include new memory instructions while preserving the existing template-driven research approach:

**Key Changes**:
- Research mode is auto-detected via `researchContext.ts` module state (no parameters needed)
- AI sees full content initially (to write meaningful futureUseGuideline)
- Content is truncated from context AFTER AI calls addMemoryMetadata (via prepareStep)
- Integrates with existing `getReportTemplate` tool and template types
- Preserves detailed tool usage playbook for navigation/search

```typescript
function generateSystemPrompt(minimumSources: number): string {
  const ranksArray = generateRanksArray(minimumSources);
  const tabIdExamples = generateTabIdExamples(minimumSources);

  return `You are a Research Workflow Agent with CONTEXT-OPTIMIZED memory storage.

CRITICAL: Visit and analyze AT LEAST ${minimumSources} DIFFERENT sources before completing research.

=== CONTEXT OPTIMIZATION (How Memory Works) ===

This workflow uses IndexedDB as a "file system" to store page content outside your context window.
Content is automatically stored when you call readPageContent, then truncated from your context
after you tag it with addMemoryMetadata. This allows you to research 100+ sources without context limits.

MEMORY WORKFLOW (After each readPageContent):
1. readPageContent() → Returns full content + sourceId, auto-stores to IndexedDB
2. You read the content and understand what it contains
3. IMMEDIATELY call addMemoryMetadata({ sourceId, futureUseGuideline: "..." })
4. Content is truncated from context, only metadata remains (~200 bytes vs ~50KB)

=== PHASE 1: TEMPLATE-DRIVEN RESEARCH GATHERING ===

**STEP 1: Get Report Template FIRST**
Before starting research, determine what type of research this is and get the appropriate template:

→ getReportTemplate({ reportType: "person|technology|company|concept|product|generic", topicName: "..." })

Template Types:
- "person" - for researching people, developers, entrepreneurs, professionals
- "technology" - for frameworks, libraries, programming languages, tools
- "company" - for businesses, startups, organizations
- "concept" - for methodologies, best practices, abstract ideas
- "product" - for SaaS platforms, apps, services, specific products
- "generic" - for anything that doesn't fit the above categories

Examples:
- "Who is codewarnab?" → reportType: "person", topicName: "codewarnab"
- "What is React?" → reportType: "technology", topicName: "React"
- "Research OpenAI company" → reportType: "company", topicName: "OpenAI"
- "Explain microservices architecture" → reportType: "concept", topicName: "Microservices"
- "Review Notion app" → reportType: "product", topicName: "Notion"

The template tells you EXACTLY what sections to fill and what information to gather.

**STEP 2: Navigate to Google and Open Sources**

→ navigateTo('https://google.com/search?q=your+topic')
→ getSearchResults({ maxResults: 10 })
→ openSearchResult({ ranks: [${ranksArray}] })  // Opens ${minimumSources} tabs at once

**STEP 3: Read Each Source with Memory Tagging**

For EACH opened tab:
→ switchTabs({ tabId: 101 })
→ readPageContent()
   Returns: { sourceId: 'research_source_1', content: '...full content...', stored: true }
→ Read the content, understand what template sections it covers
→ IMMEDIATELY call: addMemoryMetadata({
     sourceId: 'research_source_1',
     futureUseGuideline: 'Use for [Template Section Name]. Contains [specific info found].'
   })

CRITICAL: Make futureUseGuideline SPECIFIC to template sections!
- Good: "Use for Skills & Expertise section. Lists Python, React, AWS certifications."
- Bad: "General info about the person."

**TOOL USAGE PLAYBOOK:**

Navigation & Search:
- navigateTo - Open NEW URLs or search engines
- getSearchResults - Parse Google/Bing results (ONLY works on search pages!)
- openSearchResult - Open multiple results at once: openSearchResult({ranks: [1, 2, 3]})
  CRITICAL: Only works when ON a Google/Bing search results page
- switchTabs - Switch to ALREADY OPEN tabs (use tabId from openSearchResult)
- getActiveTab - Check which tab you're currently on

Content Extraction:
- readPageContent - Extract text + auto-store to IndexedDB (returns sourceId)
- extractText - Advanced page analysis with structure
- MUST call readPageContent after EVERY switchTabs

Memory Management:
- addMemoryMetadata - Tag source with futureUseGuideline (REQUIRED after each readPageContent)

SEARCH RESULT SELECTION CRITERIA:
- For documentation: Official docs, readthedocs.io, github.com
- For code/libraries: github.com, npmjs.com, pypi.org, stackoverflow.com
- For people: LinkedIn, GitHub profiles, personal blogs, Twitter/X
- For companies: Official website, Crunchbase, news articles
- For research papers: arxiv.org, scholar.google.com, academic sites

CRITICAL RULES FOR PHASE 1:
- DO NOT call openSearchResult unless on google.com/search or bing.com/search
- DO NOT call switchTabs without url or tabId parameter
- DO NOT skip readPageContent after switching tabs
- DO NOT stop before visiting ${minimumSources}+ sources
- ALWAYS call addMemoryMetadata IMMEDIATELY after readPageContent
- ALWAYS make futureUseGuideline reference specific template sections

=== PHASE 2: SYNTHESIS (Auto-triggers after ${minimumSources} sources) ===

When you've read ${minimumSources} sources, the system automatically:
1. Removes navigation tools (navigateTo, switchTabs, readPageContent, etc.)
2. Switches you to synthesis-only tools
3. Updates your prompt to synthesis instructions

SYNTHESIS WORKFLOW:

Step 1: List all sources with their guidelines
→ listResearchSources()
→ Returns: [{sourceId, url, title, futureUseGuideline}, ...]

Step 2: Write report section by section using template structure
→ For each template section, check which sources have relevant futureUseGuideline
→ Call: readResearchMemory({ sourceId: 'research_source_X' }) to load content on-demand
→ Synthesize information from multiple sources for each section

Step 3: Generate PDF (MANDATORY)
→ generatePDF({ filename: 'research-[topic]', content: '...' })

CRITICAL RULES FOR PHASE 2:
- DO NOT try to navigate (tools removed)
- DO use listResearchSources to see what you have
- DO read sources on-demand using readResearchMemory (don't load all at once)
- DO use futureUseGuideline to decide which source for each section
- DO structure report according to template sections
- DO call generatePDF before completing (MANDATORY)

=== REPORT GENERATION RULES ===

- DO NOT use emojis in the PDF/Markdown report content
- DO NOT use special Unicode characters or symbols
- Use plain text only: letters, numbers, basic punctuation (.,!?-:)
- Filename format: "research-[topic]" (e.g., "research-react")
- Include ALL template sections with synthesized findings

=== AVAILABLE TOOLS BY PHASE ===

Phase 1 (Research):
- navigateTo, switchTabs, getActiveTab, getAllTabs
- readPageContent, extractText, getSearchResults
- chromeSearch, openSearchResult
- addMemoryMetadata
- getReportTemplate (call FIRST!)

Phase 2 (Synthesis):
- listResearchSources
- readResearchMemory
- generatePDF

=== WORKFLOW COMPLETION ===

Add [WORKFLOW_COMPLETE] ONLY when:
- generatePDF has been called successfully
- PDF report has been generated

DO NOT add marker when:
- Just finished research / showing brief summary
- PDF has NOT been generated yet

Begin by calling getReportTemplate to determine the research structure.`;
}
```

---

## Phase 7: Tool UI Renderers

### 7.1 Add CompactToolRenderer for New Tools

**File**: `src/components/ui/tools/formatters/formatters/research.ts` (NEW)

```typescript
import type { ActionFormatter } from '../types';
import { humanizeKey } from '../helpers';

export const addMemoryMetadataFormatter: ActionFormatter = ({ state, input }) => {
  const sourceId = input?.sourceId;

  if (state === 'loading') {
    return {
      action: 'Saving metadata',
      description: sourceId ? `For ${sourceId}` : undefined
    };
  }
  if (state === 'success') {
    return {
      action: 'Metadata saved',
      description: sourceId ? `Tagged ${sourceId}` : undefined
    };
  }
  return { action: 'Failed to save metadata' };
};

export const readResearchMemoryFormatter: ActionFormatter = ({ state, input, output }) => {
  const sourceId = input?.sourceId;
  const found = output?.found;

  if (state === 'loading') {
    return {
      action: 'Reading memory',
      description: sourceId ? sourceId : undefined
    };
  }
  if (state === 'success') {
    if (found) {
      return {
        action: 'Memory loaded',
        description: sourceId ? `${sourceId} (${output?.content?.length || 0} chars)` : undefined
      };
    }
    return {
      action: 'Memory not found',
      description: sourceId
    };
  }
  return { action: 'Failed to read memory' };
};

export const listResearchSourcesFormatter: ActionFormatter = ({ state, output }) => {
  if (state === 'loading') {
    return {
      action: 'Listing sources',
      description: 'Current research session'
    };
  }
  if (state === 'success') {
    const count = output?.count || 0;
    return {
      action: 'Sources listed',
      description: `Found ${count} source${count !== 1 ? 's' : ''}`
    };
  }
  return { action: 'Failed to list sources' };
};

export const initResearchSessionFormatter: ActionFormatter = ({ state, output }) => {
  if (state === 'loading') {
    return {
      action: 'Initializing',
      description: 'Research session'
    };
  }
  if (state === 'success') {
    return {
      action: 'Session initialized',
      description: output?.sessionId ? `ID: ${output.sessionId.slice(0, 16)}...` : undefined
    };
  }
  return { action: 'Failed to initialize' };
};
```

**File**: `src/components/ui/tools/formatters/index.ts`

```typescript
import { 
  addMemoryMetadataFormatter, 
  readResearchMemoryFormatter, 
  listResearchSourcesFormatter,
  initResearchSessionFormatter 
} from './formatters/research'; // ADD

// In registry
export const toolFormatters: Record<string, ActionFormatter> = {
  // ... existing formatters ...
  addMemoryMetadata: addMemoryMetadataFormatter,
  readResearchMemory: readResearchMemoryFormatter,
  listResearchSources: listResearchSourcesFormatter,
  initResearchSession: initResearchSessionFormatter,
};
```

---

## Phase 8: Testing & Validation

### 8.1 Manual Testing Checklist

**Test 1: Basic Flow**
```
1. Open sidepanel
2. Select "Research" workflow
3. Say: "Research React framework"
4. Verify:
   ✅ initResearchSession called first
   ✅ readPageContent returns content + "auto-saved to research_source_X"
   ✅ AI calls addMemoryMetadata immediately after
   ✅ After 2 tool calls, readPageContent response is truncated in context
   ✅ After 5 sources, system prompt changes to synthesis mode
   ✅ Navigation tools disappear
   ✅ AI calls listResearchSources
   ✅ AI calls readResearchMemory for specific sections
   ✅ generatePDF is called at the end
```

**Test 2: Context Window Usage**
```
1. Monitor Chrome DevTools → Network → AI API calls
2. Check token counts before/after optimization
3. Expected:
   - Before: 5 sources × 50KB = 250KB in context (~62,500 tokens)
   - After: 5 sources × 200 bytes metadata = 1KB (~250 tokens)
   - Reduction: 99.6%
```

**Test 3: Auto-Cleanup**
```
1. Complete research workflow
2. Wait 30 minutes
3. Check IndexedDB: chrome-extension://[id]/ChatDB/researchSources
4. Verify: Sources auto-deleted after expiration
```

### 8.2 Edge Cases to Handle

**Case 1: AI forgets to call addMemoryMetadata**
- **Detection**: readPageContent called, but addMemoryMetadata not called within 2 steps
- **Solution**: In prepareStep, check if metadata exists before hiding content
- **Fallback**: Show warning in UI "Metadata missing for source_X"

**Case 2: AI tries to read during Phase 1**
- **Detection**: readResearchMemory called before synthesis phase
- **Solution**: Tool returns warning "Content still in context, no need to read from memory yet"

**Case 3: Multiple research sessions overlapping**
- **Detection**: User starts new research before completing previous
- **Solution**: Each session has unique ID, sources are isolated

**Case 4: IndexedDB quota exceeded**
- **Detection**: IndexedDB write fails with QuotaExceededError
- **Solution**: Auto-cleanup old sessions, show warning to user

---

## Phase 9: Performance Monitoring

### 9.1 Add Metrics Tracking

**File**: `src/workflows/definitions/researchWorkflow.ts`

```typescript
// Track efficiency metrics
interface ResearchMetrics {
  sourcesStored: number;
  totalContentSize: number; // bytes
  metadataSize: number; // bytes
  contextSavingsRatio: number; // %
  synthesisReadsCount: number;
}

const metrics: ResearchMetrics = {
  sourcesStored: 0,
  totalContentSize: 0,
  metadataSize: 0,
  contextSavingsRatio: 0,
  synthesisReadsCount: 0
};

// Update metrics in prepareStep
// Log at end of workflow
```

### 9.2 Performance Goals

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Context tokens (5 sources) | ~60,000 | ~500 | 99% reduction |
| API cost (5 sources) | $0.18 | $0.002 | 99% reduction |
| Max sources researchable | 10 (context limit) | 100+ | 10× increase |
| Synthesis accuracy | Baseline | Same or better | No degradation |
| Time to complete | Baseline | -10% faster | Slight improvement |

---

## Implementation Order

### Week 1: Core Infrastructure
- [ ] Phase 1: Database schema + CRUD operations
- [ ] Phase 2: Modified readPageContent
- [ ] Phase 3: New memory tools (4 tools)
- [ ] Phase 4: Background cleanup alarm

### Week 2: Workflow Integration  
- [ ] Phase 5: PrepareStep logic
- [ ] Phase 6: System prompt updates
- [ ] Phase 7: Tool UI renderers

### Week 3: Testing & Refinement
- [ ] Phase 8: Manual testing
- [ ] Phase 8: Edge case handling
- [ ] Phase 9: Performance monitoring
- [ ] Documentation updates

---

## Rollout Strategy

1. **Feature Flag**: Add `enableResearchMemoryOptimization` setting
2. **Gradual Rollout**: Enable for 10% of users, monitor metrics
3. **A/B Testing**: Compare old vs new workflow performance
4. **Full Launch**: Enable for all users after validation

---

## Success Metrics

**Quantitative**:
- 95%+ reduction in context token usage during research
- 10× increase in max researchable sources
- 99%+ cost reduction for research workflows
- 0 memory leaks (auto-cleanup works)

**Qualitative**:
- Reports have same or better quality
- AI follows memory instructions correctly
- No user-reported issues with "content missing"
- Faster research completion (less context processing)

---

## Rollback Plan

If issues arise:
1. Disable `enableResearchMemoryOptimization` flag
2. Revert to original readPageContent (no autoStore)
3. Remove prepareStep from workflow definition
4. Keep memory tools (no harm, just unused)
5. Cleanup IndexedDB table manually if needed

---

## Future Enhancements

1. **AI-Generated Summaries**: Auto-summarize each source (200 chars) during storage
2. **Relevance Scoring**: AI rates each source 1-10, prioritizes high-value sources during synthesis
3. **Cross-Session Memory**: Option to persist sources beyond 30 minutes for long-term research
4. **Memory Compression**: Use LZ-string to compress content before storage (50% size reduction)
5. **Smart Caching**: Detect duplicate URLs, reuse content across sessions
6. **Memory Analytics Dashboard**: Show user "You've saved 500MB of context this month"

---

## Conclusion

This implementation brings Manus-style context engineering to Cognito AI, unlocking:
- **Unlimited research capacity** (no context window limits)
- **99% cost reduction** (only metadata in context)
- **Better synthesis** (on-demand loading of relevant sources)
- **Scalability** (handle 100+ sources per research session)

The key insight: **Treat IndexedDB as the AI's "file system"** - store everything, load only what's needed, keep context window for reasoning, not storage.
