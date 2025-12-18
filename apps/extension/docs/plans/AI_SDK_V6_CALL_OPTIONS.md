# AI SDK v6 Call Options Integration Plan

> ⚠️ **PREREQUISITE**: This implementation plan is only applicable **AFTER upgrading to AI SDK v6**.
> The `callOptionsSchema` and `prepareCall` features are part of the new `ToolLoopAgent` class in AI SDK v6.
> 
> **Current Status**: Using AI SDK v5 with `streamText`/`generateText`
> 
> **Upgrade Tracking**: Monitor [AI SDK v6 Release](https://github.com/vercel/ai) for stable release.

---

## Overview

This plan outlines how to leverage AI SDK v6's **Call Options** pattern to:
- Pass type-safe runtime inputs to dynamically configure agent behavior
- Replace scattered configuration logic with centralized `prepareCall` hooks
- Improve code maintainability and testability

### Key Concepts

```typescript
const cognitoAgent = new ToolLoopAgent({
  model: 'gemini-2.5-flash',
  callOptionsSchema: z.object({
    // Type-safe options defined here
  }),
  prepareCall: async ({ options, ...settings }) => ({
    // Dynamic configuration based on options
    ...settings,
  }),
});

// Usage
await cognitoAgent.stream({
  prompt: 'User message',
  options: {
    // Type-checked options passed at runtime
  },
});
```

---

## Phase 1: Core Agent Configuration

**Goal**: Implement mode-based behavior and tool filtering using Call Options.

**Estimated Effort**: 2-3 days

### 1.1 Mode-Based System Prompt Selection

**Current Implementation** (`apps/extension/src/ai/core/aiLogic.ts`):
```typescript
// Lines 214-229 - Switch-based prompt selection
if (toolsMode === 'chat' && !workflowConfig) {
  usePrompt = chatModeSystemPrompt;
} else if (toolsMode === 'adaptive' && !workflowConfig) {
  usePrompt = await buildAdaptiveSystemPrompt();
} else {
  usePrompt = remoteSystemPrompt;
}
```

**New Implementation**:

1. **Create Call Options Schema** (`apps/extension/src/ai/agents/callOptionsSchema.ts`):

```typescript
import { z } from 'zod';
import type { ToolMode } from '@/stores/tools/types';

/**
 * Core call options schema for Cognito agent
 * Defines all runtime configuration options
 */
export const CognitoCallOptionsSchema = z.object({
  /**
   * AI operating mode
   * - chat: Simple Q&A, minimal tools
   * - agent: Full autonomous capabilities
   * - adaptive: Dynamic tool discovery
   * - custom: User-defined tool selection
   */
  mode: z.enum(['chat', 'agent', 'adaptive', 'custom']).default('agent'),
  
  /**
   * Optional workflow ID for workflow-specific behavior
   */
  workflowId: z.string().optional(),
});

export type CognitoCallOptions = z.infer<typeof CognitoCallOptionsSchema>;
```

2. **Create prepareCall Hook** (`apps/extension/src/ai/agents/prepareCallHooks.ts`):

```typescript
import { chatModeSystemPrompt, remoteSystemPrompt } from '../prompts/templates/remote';
import { buildAdaptiveSystemPrompt, adaptiveSystemPromptStatic } from '../prompts/templates/adaptivePrompt';
import { getWorkflow } from '@/workflows/registry';
import type { CognitoCallOptions } from './callOptionsSchema';

/**
 * Get system prompt based on mode and workflow
 */
export async function getSystemPromptForOptions(
  options: CognitoCallOptions
): Promise<string> {
  // Workflow takes precedence
  if (options.workflowId) {
    const workflow = getWorkflow(options.workflowId);
    if (workflow) {
      return workflow.systemPrompt;
    }
  }

  // Mode-based prompt selection
  switch (options.mode) {
    case 'chat':
      return chatModeSystemPrompt;
    
    case 'adaptive':
      try {
        return await buildAdaptiveSystemPrompt();
      } catch (error) {
        console.warn('Failed to build adaptive prompt, using static version');
        return adaptiveSystemPromptStatic;
      }
    
    case 'agent':
    case 'custom':
    default:
      return remoteSystemPrompt;
  }
}
```

3. **Create Cognito Agent** (`apps/extension/src/ai/agents/cognitoAgent.ts`):

```typescript
import { ToolLoopAgent } from 'ai';
import { CognitoCallOptionsSchema } from './callOptionsSchema';
import { getSystemPromptForOptions } from './prepareCallHooks';

export const cognitoAgent = new ToolLoopAgent({
  model: 'gemini-2.5-flash', // Default model
  
  callOptionsSchema: CognitoCallOptionsSchema,
  
  instructions: '', // Set dynamically in prepareCall
  
  prepareCall: async ({ options, ...settings }) => {
    const systemPrompt = await getSystemPromptForOptions(options);
    
    return {
      ...settings,
      instructions: systemPrompt,
    };
  },
});
```

### 1.2 Tool Filtering by Mode

**Current Implementation** (`apps/extension/src/ai/core/aiLogic.ts`):
```typescript
// Lines 261-284 - Complex conditional logic
if (toolsMode === 'adaptive' && !workflowConfig) {
  initialActiveTools = Object.keys(tools).filter(t => !SEARCH_TOOL_NAMES.includes(t));
} else if (isSearchModeActive) {
  initialActiveTools = Object.keys(tools);
} else {
  initialActiveTools = Object.keys(tools).filter(t => !SEARCH_TOOL_NAMES.includes(t));
}
```

**New Implementation**:

1. **Extend Call Options Schema**:

```typescript
// Add to CognitoCallOptionsSchema
export const CognitoCallOptionsSchema = z.object({
  mode: z.enum(['chat', 'agent', 'adaptive', 'custom']).default('agent'),
  workflowId: z.string().optional(),
  
  /**
   * Explicitly enabled tools (for 'custom' mode)
   * If not provided, uses mode-based defaults
   */
  enabledTools: z.array(z.string()).optional(),
});
```

2. **Create Tool Filter Utility** (`apps/extension/src/ai/agents/toolFilter.ts`):

```typescript
import { getToolsForMode, AGENT_TOOLS, BASIC_TOOLS } from '../tools/registry';
import { SEARCH_TOOL_NAMES } from '../tools/searchToolFilter';
import { getWorkflow } from '@/workflows/registry';
import type { CognitoCallOptions } from './callOptionsSchema';

/**
 * Get active tools based on call options
 */
export function getActiveToolsForOptions(
  allTools: Record<string, any>,
  options: CognitoCallOptions
): string[] {
  // Workflow-specific tools take precedence
  if (options.workflowId) {
    const workflow = getWorkflow(options.workflowId);
    if (workflow) {
      return workflow.allowedTools.filter(name => allTools[name]);
    }
  }

  // Custom mode uses explicitly enabled tools
  if (options.mode === 'custom' && options.enabledTools) {
    return options.enabledTools.filter(name => allTools[name]);
  }

  // Mode-based tool selection
  const allToolNames = Object.keys(allTools);
  
  switch (options.mode) {
    case 'chat':
      // Minimal tools: just reading capabilities
      return ['readPageContent', 'getActiveTab', 'takeScreenshot'];
    
    case 'adaptive':
      // Adaptive: All tools except search (discoverable via discoverTools)
      return allToolNames.filter(t => !SEARCH_TOOL_NAMES.includes(t as any));
    
    case 'agent':
    default:
      // Agent: All tools except search (added separately when search mode enabled)
      return allToolNames.filter(t => !SEARCH_TOOL_NAMES.includes(t as any));
  }
}
```

3. **Update prepareCall**:

```typescript
prepareCall: async ({ options, ...settings }) => {
  const systemPrompt = await getSystemPromptForOptions(options);
  const activeTools = getActiveToolsForOptions(allTools, options);
  
  return {
    ...settings,
    instructions: systemPrompt,
    activeTools,
  };
},
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/ai/agents/callOptionsSchema.ts` | **NEW** - Define call options schema |
| `src/ai/agents/prepareCallHooks.ts` | **NEW** - prepareCall utility functions |
| `src/ai/agents/toolFilter.ts` | **NEW** - Tool filtering logic |
| `src/ai/agents/cognitoAgent.ts` | **NEW** - Main agent definition |
| `src/ai/core/aiLogic.ts` | Refactor to use cognitoAgent |
| `src/ai/backend/backendChatWithTools.ts` | Refactor to use shared options |

---

## Phase 2: Workflow & Search Integration

**Goal**: Integrate workflow configuration and search mode as Call Options.

**Estimated Effort**: 2 days

### 2.1 Workflow Configuration

**Current Implementation** (`apps/extension/src/ai/core/aiLogic.ts`):
```typescript
// Lines 164-172
let workflowConfig = null;
if (workflowId) {
  workflowConfig = getWorkflow(workflowId);
}
```

**New Implementation**:

1. **Extend Call Options Schema**:

```typescript
export const CognitoCallOptionsSchema = z.object({
  mode: z.enum(['chat', 'agent', 'adaptive', 'custom']).default('agent'),
  
  /**
   * Workflow configuration
   */
  workflowId: z.string().optional(),
  threadId: z.string().optional(), // Session management for workflows
  
  enabledTools: z.array(z.string()).optional(),
});
```

2. **Update prepareCall for Workflows**:

```typescript
prepareCall: async ({ options, ...settings }) => {
  // Check for workflow first
  if (options.workflowId) {
    const workflow = getWorkflow(options.workflowId);
    if (workflow) {
      return {
        ...settings,
        instructions: workflow.systemPrompt,
        activeTools: workflow.allowedTools,
        maxSteps: workflow.stepCount || 10,
      };
    }
  }
  
  // Standard mode handling
  const systemPrompt = await getSystemPromptForOptions(options);
  const activeTools = getActiveToolsForOptions(allTools, options);
  
  return {
    ...settings,
    instructions: systemPrompt,
    activeTools,
  };
},
```

### 2.2 Search Mode Integration

**Current Implementation** (`apps/extension/src/ai/core/aiLogic.ts`):
```typescript
// Lines 197-210 - Search mode detection
const searchSettings = await getSearchSettings();
isSearchModeActive = searchSettings.enabled && hasSearchKey && !workflowConfig;

// Lines 231-236 - Prompt augmentation
if (isSearchModeActive && toolsMode !== 'adaptive') {
  usePrompt += '\n\n' + getSearchPromptAddition(true);
}
```

**New Implementation**:

1. **Extend Call Options Schema**:

```typescript
export const CognitoCallOptionsSchema = z.object({
  mode: z.enum(['chat', 'agent', 'adaptive', 'custom']).default('agent'),
  workflowId: z.string().optional(),
  threadId: z.string().optional(),
  enabledTools: z.array(z.string()).optional(),
  
  /**
   * Search mode configuration
   */
  searchEnabled: z.boolean().default(false),
  searchDepth: z.enum(['quick', 'deep']).default('quick'),
});
```

2. **Create Search Mode Utility** (`apps/extension/src/ai/agents/searchIntegration.ts`):

```typescript
import { getSearchPromptAddition } from '../prompts/searchPrompt';
import { SEARCH_TOOL_NAMES } from '../tools/searchToolFilter';
import type { CognitoCallOptions } from './callOptionsSchema';

/**
 * Augment prompt with search instructions
 */
export function augmentPromptWithSearch(
  basePrompt: string,
  options: CognitoCallOptions
): string {
  if (!options.searchEnabled) return basePrompt;
  
  // Adaptive mode: search tools are discoverable, no prompt needed
  if (options.mode === 'adaptive') return basePrompt;
  
  const isDeep = options.searchDepth === 'deep';
  return basePrompt + '\n\n' + getSearchPromptAddition(isDeep);
}

/**
 * Add search tools when enabled
 */
export function addSearchToolsIfEnabled(
  activeTools: string[],
  options: CognitoCallOptions
): string[] {
  if (!options.searchEnabled) return activeTools;
  
  // Add search tools (additive model)
  return [...new Set([...activeTools, ...SEARCH_TOOL_NAMES])];
}
```

3. **Update prepareCall**:

```typescript
prepareCall: async ({ options, ...settings }) => {
  // Workflow handling...
  
  let systemPrompt = await getSystemPromptForOptions(options);
  let activeTools = getActiveToolsForOptions(allTools, options);
  
  // Apply search mode enhancements
  systemPrompt = augmentPromptWithSearch(systemPrompt, options);
  activeTools = addSearchToolsIfEnabled(activeTools, options);
  
  return {
    ...settings,
    instructions: systemPrompt,
    activeTools,
  };
},
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/ai/agents/callOptionsSchema.ts` | Add workflow & search options |
| `src/ai/agents/searchIntegration.ts` | **NEW** - Search mode utilities |
| `src/ai/agents/prepareCallHooks.ts` | Update for workflows |
| `src/ai/agents/cognitoAgent.ts` | Integrate search & workflow |

---

## Phase 3: Context & Preferences

**Goal**: Implement page context injection and user preferences.

**Estimated Effort**: 2-3 days

### 3.1 Initial Page Context Injection (RAG-like)

**Current Implementation** (`apps/extension/src/ai/core/aiLogic.ts`):
```typescript
// Lines 326-333
if (initialPageContext && effectiveMode === 'remote') {
  enhancedPrompt = `${enhancedPrompt}\n\n[INITIAL PAGE CONTEXT]...\n${initialPageContext}`;
}
```

**New Implementation**:

1. **Extend Call Options Schema**:

```typescript
/**
 * Page context schema for structured context injection
 */
export const PageContextSchema = z.object({
  url: z.string(),
  title: z.string(),
  domain: z.string().optional(),
  textContent: z.string().optional(),
  selectedText: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export const CognitoCallOptionsSchema = z.object({
  mode: z.enum(['chat', 'agent', 'adaptive', 'custom']).default('agent'),
  workflowId: z.string().optional(),
  threadId: z.string().optional(),
  enabledTools: z.array(z.string()).optional(),
  searchEnabled: z.boolean().default(false),
  searchDepth: z.enum(['quick', 'deep']).default('quick'),
  
  /**
   * Initial page context captured at thread start
   */
  pageContext: PageContextSchema.optional(),
});
```

2. **Create Context Injection Utility** (`apps/extension/src/ai/agents/contextInjection.ts`):

```typescript
import type { z } from 'zod';
import type { PageContextSchema } from './callOptionsSchema';

type PageContext = z.infer<typeof PageContextSchema>;

/**
 * Build page context section for system prompt
 */
export function buildPageContextSection(context: PageContext): string {
  const sections: string[] = [
    `[INITIAL PAGE CONTEXT - Captured at thread start]`,
    `URL: ${context.url}`,
    `Title: ${context.title}`,
  ];
  
  if (context.domain) {
    sections.push(`Domain: ${context.domain}`);
  }
  
  if (context.selectedText) {
    sections.push(`\nSelected Text:\n${context.selectedText}`);
  }
  
  if (context.textContent) {
    // Truncate to avoid token limits
    const maxLength = 2000;
    const truncated = context.textContent.length > maxLength
      ? context.textContent.slice(0, maxLength) + '...[truncated]'
      : context.textContent;
    sections.push(`\nPage Content Preview:\n${truncated}`);
  }
  
  if (context.metadata && Object.keys(context.metadata).length > 0) {
    sections.push(`\nMetadata: ${JSON.stringify(context.metadata)}`);
  }
  
  sections.push(
    `\nNote: This is the page context from when this conversation started. ` +
    `If you navigate to different pages or need updated context, use the readPageContent or getActiveTab tools.`
  );
  
  return sections.join('\n');
}

/**
 * Augment prompt with page context
 */
export function augmentPromptWithPageContext(
  basePrompt: string,
  context: PageContext | undefined
): string {
  if (!context) return basePrompt;
  
  return basePrompt + '\n\n' + buildPageContextSection(context);
}
```

3. **Update prepareCall**:

```typescript
prepareCall: async ({ options, ...settings }) => {
  // Previous handling...
  
  // Apply page context
  systemPrompt = augmentPromptWithPageContext(systemPrompt, options.pageContext);
  
  return {
    ...settings,
    instructions: systemPrompt,
    activeTools,
  };
},
```

### 3.2 User Preferences Integration

**Current Implementation**: User settings are fetched from stores throughout the code.

**New Implementation**:

1. **Extend Call Options Schema**:

```typescript
/**
 * User preferences schema
 */
export const UserPreferencesSchema = z.object({
  /**
   * Maximum tool execution steps
   * Respected by both frontend and backend
   */
  maxSteps: z.number().min(1).max(50).default(20),
  
  /**
   * Enable notification sound on completion
   */
  notificationSound: z.boolean().default(true),
  
  /**
   * UI compact mode (affects response style)
   */
  compactMode: z.boolean().default(false),
});

export const CognitoCallOptionsSchema = z.object({
  mode: z.enum(['chat', 'agent', 'adaptive', 'custom']).default('agent'),
  workflowId: z.string().optional(),
  threadId: z.string().optional(),
  enabledTools: z.array(z.string()).optional(),
  searchEnabled: z.boolean().default(false),
  searchDepth: z.enum(['quick', 'deep']).default('quick'),
  pageContext: PageContextSchema.optional(),
  
  /**
   * User preferences
   */
  preferences: UserPreferencesSchema.optional(),
});
```

2. **Create Preferences Utility** (`apps/extension/src/ai/agents/preferencesIntegration.ts`):

```typescript
import type { z } from 'zod';
import type { UserPreferencesSchema } from './callOptionsSchema';

type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// Default preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  maxSteps: 20,
  notificationSound: true,
  compactMode: false,
};

/**
 * Get effective preferences with defaults
 */
export function getEffectivePreferences(
  preferences: Partial<UserPreferences> | undefined
): UserPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...preferences,
  };
}

/**
 * Get max steps based on mode and preferences
 * Workflows may override user preferences
 */
export function getMaxSteps(
  preferences: UserPreferences,
  workflowStepCount?: number
): number {
  // Workflow step count takes precedence
  if (workflowStepCount !== undefined) {
    return workflowStepCount;
  }
  
  return preferences.maxSteps;
}

/**
 * Augment prompt for compact mode
 */
export function applyCompactModeToPrompt(
  basePrompt: string,
  compactMode: boolean
): string {
  if (!compactMode) return basePrompt;
  
  return basePrompt + '\n\nNOTE: User prefers concise responses. Keep answers brief and to the point.';
}
```

3. **Update prepareCall**:

```typescript
prepareCall: async ({ options, ...settings }) => {
  const prefs = getEffectivePreferences(options.preferences);
  
  // Get workflow for step count override
  let workflowStepCount: number | undefined;
  if (options.workflowId) {
    const workflow = getWorkflow(options.workflowId);
    workflowStepCount = workflow?.stepCount;
  }
  
  let systemPrompt = await getSystemPromptForOptions(options);
  let activeTools = getActiveToolsForOptions(allTools, options);
  
  // Apply all enhancements
  systemPrompt = augmentPromptWithSearch(systemPrompt, options);
  systemPrompt = augmentPromptWithPageContext(systemPrompt, options.pageContext);
  systemPrompt = applyCompactModeToPrompt(systemPrompt, prefs.compactMode);
  activeTools = addSearchToolsIfEnabled(activeTools, options);
  
  return {
    ...settings,
    instructions: systemPrompt,
    activeTools,
    maxSteps: getMaxSteps(prefs, workflowStepCount),
  };
},
```

4. **Backend Sync** (`packages/backend-vercel/src/routes/ai.ts`):

```typescript
// Update chat-with-tools endpoint to respect maxSteps from request
router.post('/chat-with-tools', async (req: Request, res: Response) => {
  const {
    messages,
    system,
    tools: toolSchemas = {},
    model: modelName = 'gemini-2.0-flash',
    mode,
    maxSteps = 10, // Receive from frontend, with default
    preferences, // New: user preferences
  } = req.body;

  // Use maxSteps from preferences if provided
  const effectiveMaxSteps = preferences?.maxSteps ?? maxSteps;
  
  const result = streamText({
    model,
    messages,
    system: effectiveSystemPrompt,
    tools: frontendTools,
    maxSteps: effectiveMaxSteps, // Use effective max steps
    maxTokens: 4096,
    // ...
  });
});
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/ai/agents/callOptionsSchema.ts` | Add page context & preferences |
| `src/ai/agents/contextInjection.ts` | **NEW** - Context injection utilities |
| `src/ai/agents/preferencesIntegration.ts` | **NEW** - Preferences utilities |
| `src/ai/agents/cognitoAgent.ts` | Integrate all options |
| `packages/backend-vercel/src/routes/ai.ts` | Accept preferences, respect maxSteps |
| `src/ai/backend/backendChatWithTools.ts` | Pass preferences to backend |

---

## Phase 4: Backend Endpoint Refinement

**Goal**: Apply Call Options pattern to writer, rewriter, summarizer, and suggestions endpoints.

**Estimated Effort**: 2-3 days

### 4.1 Backend Writer/Rewriter/Summarizer Configuration

**Current Implementation** (`packages/backend-vercel/src/routes/ai.ts`):
```typescript
// Lines 337-389 - Hardcoded configurations
const TONE_INSTRUCTIONS: Record<string, string> = {...};
const PRESET_PROMPTS: Record<string, string> = {...};
const SUMMARY_TYPE_INSTRUCTIONS: Record<string, string> = {...};
```

**New Implementation**:

1. **Create Backend Agent Schemas** (`packages/backend-vercel/src/agents/schemas.ts`):

```typescript
import { z } from 'zod';

/**
 * Writer endpoint call options
 */
export const WriterCallOptionsSchema = z.object({
  tone: z.enum(['professional', 'casual', 'formal', 'friendly']).default('professional'),
  platform: z.enum(['Gmail', 'LinkedIn', 'Twitter', 'GitHub', 'Slack', 'Discord', 'Web']).default('Web'),
  pageContext: z.object({
    title: z.string(),
    url: z.string(),
    domain: z.string(),
  }).optional(),
  enableUrlContext: z.boolean().default(false),
  enableGoogleSearch: z.boolean().default(false),
});

/**
 * Rewriter endpoint call options
 */
export const RewriterCallOptionsSchema = z.object({
  preset: z.enum([
    'shorter', 'longer', 'professional', 'casual',
    'improve', 'simplify', 'enthusiastic', 'conversational'
  ]).optional(),
  customInstruction: z.string().optional(),
  enableUrlContext: z.boolean().default(false),
  enableGoogleSearch: z.boolean().default(false),
});

/**
 * Summarizer endpoint call options
 */
export const SummarizerCallOptionsSchema = z.object({
  summaryType: z.enum(['key-points', 'tl-dr', 'headline', 'teaser']).default('tl-dr'),
  summaryLength: z.enum(['short', 'medium', 'long']).default('medium'),
  pageContext: z.object({
    title: z.string(),
    url: z.string(),
    domain: z.string(),
  }).optional(),
  enableUrlContext: z.boolean().default(false),
  enableGoogleSearch: z.boolean().default(false),
});

export type WriterCallOptions = z.infer<typeof WriterCallOptionsSchema>;
export type RewriterCallOptions = z.infer<typeof RewriterCallOptionsSchema>;
export type SummarizerCallOptions = z.infer<typeof SummarizerCallOptionsSchema>;
```

2. **Create Agent Factories** (`packages/backend-vercel/src/agents/contentAgents.ts`):

```typescript
import { ToolLoopAgent } from 'ai';
import { 
  WriterCallOptionsSchema, 
  RewriterCallOptionsSchema, 
  SummarizerCallOptionsSchema,
  type WriterCallOptions,
  type RewriterCallOptions,
  type SummarizerCallOptions,
} from './schemas';
import { TONE_INSTRUCTIONS, PLATFORM_INSTRUCTIONS, PRESET_PROMPTS, SUMMARY_TYPE_INSTRUCTIONS } from './constants';
import { buildGeminiTools } from '../services/geminiTools';

/**
 * Writer agent factory
 */
export function createWriterAgent(apiKey: string) {
  return new ToolLoopAgent({
    model: 'gemini-2.0-flash',
    callOptionsSchema: WriterCallOptionsSchema,
    
    prepareCall: ({ options, ...settings }) => {
      let systemPrompt = `You are a helpful writing assistant. Generate text based on the user's prompt.`;
      
      // Apply tone
      if (TONE_INSTRUCTIONS[options.tone]) {
        systemPrompt += ` ${TONE_INSTRUCTIONS[options.tone]}`;
      }
      
      // Apply platform context
      if (PLATFORM_INSTRUCTIONS[options.platform]) {
        systemPrompt += ` ${PLATFORM_INSTRUCTIONS[options.platform]}`;
      }
      
      // Apply page context
      if (options.pageContext) {
        systemPrompt += ` Context: Writing for ${options.pageContext.title} (${options.pageContext.domain}).`;
      }
      
      systemPrompt += ' Output ONLY the generated text, no explanations or preamble.';
      
      // Apply tool-specific instructions
      if (options.enableUrlContext) {
        systemPrompt += ' When URLs are mentioned, fetch and analyze their content.';
      }
      if (options.enableGoogleSearch) {
        systemPrompt += ' Use Google Search to find current, accurate information when needed.';
      }
      
      // Build tools
      const tools = buildGeminiTools({
        enableUrlContext: options.enableUrlContext,
        enableGoogleSearch: options.enableGoogleSearch,
      });
      
      return {
        ...settings,
        instructions: systemPrompt,
        tools: tools.length > 0 ? tools : undefined,
      };
    },
  });
}

/**
 * Rewriter agent factory
 */
export function createRewriterAgent(apiKey: string) {
  return new ToolLoopAgent({
    model: 'gemini-2.0-flash',
    callOptionsSchema: RewriterCallOptionsSchema,
    
    prepareCall: ({ options, ...settings }) => {
      const instruction = options.customInstruction 
        || (options.preset && PRESET_PROMPTS[options.preset]) 
        || PRESET_PROMPTS.improve;
      
      let systemPrompt = `You are a text rewriting assistant. ${instruction}
If the text is a question or prompt, transform the question/prompt itself - do NOT answer it.
Output ONLY the rewritten text, no explanations.`;
      
      if (options.enableUrlContext) {
        systemPrompt += ' If the text contains URLs, use their content to inform the rewrite.';
      }
      if (options.enableGoogleSearch) {
        systemPrompt += ' Use search to verify facts when appropriate.';
      }
      
      const tools = buildGeminiTools({
        enableUrlContext: options.enableUrlContext,
        enableGoogleSearch: options.enableGoogleSearch,
      });
      
      return {
        ...settings,
        instructions: systemPrompt,
        tools: tools.length > 0 ? tools : undefined,
      };
    },
  });
}

/**
 * Summarizer agent factory
 */
export function createSummarizerAgent(apiKey: string) {
  return new ToolLoopAgent({
    model: 'gemini-2.0-flash',
    callOptionsSchema: SummarizerCallOptionsSchema,
    
    prepareCall: ({ options, ...settings }) => {
      const typeInstruction = SUMMARY_TYPE_INSTRUCTIONS[options.summaryType] 
        || SUMMARY_TYPE_INSTRUCTIONS['tl-dr'];
      
      let systemPrompt = `You are a summarization assistant. ${typeInstruction}`;
      
      if (options.pageContext) {
        systemPrompt += ` This text is from: ${options.pageContext.title} (${options.pageContext.domain}).`;
      }
      
      systemPrompt += ' Output ONLY the summary, no preamble or explanations.';
      
      if (options.enableUrlContext) {
        systemPrompt += ' If URLs are mentioned, fetch their content for accurate summaries.';
      }
      if (options.enableGoogleSearch) {
        systemPrompt += ' Use search to verify facts and add relevant context.';
      }
      
      const tools = buildGeminiTools({
        enableUrlContext: options.enableUrlContext,
        enableGoogleSearch: options.enableGoogleSearch,
      });
      
      return {
        ...settings,
        instructions: systemPrompt,
        tools: tools.length > 0 ? tools : undefined,
        maxTokens: SUMMARY_LENGTH_TOKENS[options.summaryLength] || 250,
      };
    },
  });
}
```

3. **Update Endpoints**:

```typescript
// In ai.ts - Updated /write endpoint
router.post('/write', async (req: Request, res: Response) => {
  // ... rate limiting ...
  
  const parsed = WriterCallOptionsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid options', details: parsed.error });
  }
  
  const writerAgent = createWriterAgent(config.googleAiApiKey);
  
  return createAgentUIStreamResponse({
    agent: writerAgent,
    messages: [{ role: 'user', content: req.body.prompt }],
    options: parsed.data,
  });
});
```

### 4.2 Suggestions Generation Context

**Current Implementation** (`packages/backend-vercel/src/routes/ai.ts`):
```typescript
// Lines 916-976 - buildSuggestionPrompt function
function buildSuggestionPrompt(pageContext: PageContext): string {
  // Complex string building...
}
```

**New Implementation**:

1. **Create Suggestions Schema** (`packages/backend-vercel/src/agents/schemas.ts`):

```typescript
/**
 * Suggestions endpoint call options
 */
export const SuggestionsCallOptionsSchema = z.object({
  pageContext: z.object({
    url: z.string(),
    title: z.string(),
    description: z.string().optional(),
    headings: z.array(z.object({
      level: z.number(),
      text: z.string(),
    })).optional(),
    buttons: z.array(z.object({
      text: z.string(),
    })).optional(),
    links: z.array(z.object({
      text: z.string(),
    })).optional(),
    textPreview: z.string().optional(),
  }).nullable(),
  
  /**
   * Number of suggestions to generate
   */
  count: z.number().min(1).max(5).default(3),
  
  /**
   * AI capabilities to consider
   */
  capabilities: z.array(z.string()).optional(),
});
```

2. **Create Suggestions Agent** (`packages/backend-vercel/src/agents/suggestionsAgent.ts`):

```typescript
import { ToolLoopAgent } from 'ai';
import { SuggestionsCallOptionsSchema } from './schemas';

const DEFAULT_CAPABILITIES = [
  'navigate to websites and search the web',
  'manage and organize browser tabs into groups',
  'search browser history and find previously visited pages',
  'set reminders for tasks and deadlines',
  'save and retrieve information to/from memory',
  'interact with pages (click buttons, fill forms, read content)',
  'send emails using web-based email services',
  'analyze YouTube videos and provide insights',
];

export function createSuggestionsAgent(apiKey: string) {
  return new ToolLoopAgent({
    model: 'gemini-2.0-flash',
    callOptionsSchema: SuggestionsCallOptionsSchema,
    
    prepareCall: ({ options, ...settings }) => {
      const capabilities = options.capabilities || DEFAULT_CAPABILITIES;
      
      let prompt = `You are a browser AI assistant. Generate ${options.count} contextual action suggestions.

Your capabilities include:
${capabilities.map(c => `- ${c}`).join('\n')}

`;
      
      if (options.pageContext) {
        prompt += `Current Page Context:
- URL: ${options.pageContext.url}
- Title: ${options.pageContext.title}
`;
        
        if (options.pageContext.description) {
          prompt += `- Description: ${options.pageContext.description}\n`;
        }
        
        if (options.pageContext.headings?.length) {
          prompt += `\nKey Headings:\n`;
          options.pageContext.headings.slice(0, 5).forEach(h => {
            prompt += `  ${'#'.repeat(h.level)} ${h.text}\n`;
          });
        }
        
        // ... (buttons, links, textPreview)
      } else {
        prompt += `Current Page: No specific page context available.\n`;
      }
      
      prompt += `\nGenerate exactly ${options.count} diverse, actionable suggestions.

CRITICAL - Title lengths must be progressively longer:
1. First: SHORTEST (2-3 words)
2. Second: MEDIUM (3-4 words)
3. Third: LONGEST (4-6 words)`;
      
      return {
        ...settings,
        instructions: prompt,
        temperature: 0.8, // More creative suggestions
      };
    },
  });
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `backend-vercel/src/agents/schemas.ts` | **NEW** - All agent schemas |
| `backend-vercel/src/agents/contentAgents.ts` | **NEW** - Writer/Rewriter/Summarizer agents |
| `backend-vercel/src/agents/suggestionsAgent.ts` | **NEW** - Suggestions agent |
| `backend-vercel/src/routes/ai.ts` | Refactor endpoints to use agents |

---

## Final Architecture

```
apps/extension/src/ai/
├── agents/
│   ├── callOptionsSchema.ts      # Unified call options schema
│   ├── cognitoAgent.ts           # Main Cognito agent
│   ├── prepareCallHooks.ts       # Shared prepareCall utilities
│   ├── toolFilter.ts             # Tool filtering logic
│   ├── searchIntegration.ts      # Search mode utilities
│   ├── contextInjection.ts       # Page context injection
│   ├── preferencesIntegration.ts # User preferences handling
│   └── index.ts                  # Public exports

packages/backend-vercel/src/
├── agents/
│   ├── schemas.ts                # Backend agent schemas
│   ├── contentAgents.ts          # Writer/Rewriter/Summarizer
│   ├── suggestionsAgent.ts       # Suggestions agent
│   ├── chatAgent.ts              # Main chat agent (if needed)
│   └── index.ts                  # Public exports
```

---

## Migration Checklist

### Pre-Migration (Before v6 Upgrade)
- [ ] Review AI SDK v6 changelog and breaking changes
- [ ] Create feature branch for migration
- [ ] Document current behavior for regression testing

### Phase 1 Checklist
- [ ] Create `callOptionsSchema.ts`
- [ ] Create `prepareCallHooks.ts`
- [ ] Create `toolFilter.ts`
- [ ] Create `cognitoAgent.ts`
- [ ] Update `aiLogic.ts` to use new agent
- [ ] Test mode switching (chat → agent → adaptive)
- [ ] Test tool filtering per mode

### Phase 2 Checklist
- [ ] Add workflow options to schema
- [ ] Create `searchIntegration.ts`
- [ ] Test workflow configurations
- [ ] Test search mode (additive tools)
- [ ] Verify backend receives mode/search settings

### Phase 3 Checklist
- [ ] Add page context to schema
- [ ] Create `contextInjection.ts`
- [ ] Add preferences to schema
- [ ] Create `preferencesIntegration.ts`
- [ ] **Verify maxSteps is respected in both frontend AND backend**
- [ ] Test page context injection
- [ ] Test compact mode preference

### Phase 4 Checklist
- [ ] Create backend agent schemas
- [ ] Create `contentAgents.ts`
- [ ] Create `suggestionsAgent.ts`
- [ ] Refactor `/write` endpoint
- [ ] Refactor `/rewrite` endpoint
- [ ] Refactor `/summarize` endpoint
- [ ] Refactor `/suggestions` endpoint
- [ ] Integration test all content endpoints

### Post-Migration
- [ ] Remove deprecated code paths
- [ ] Update documentation
- [ ] Performance testing
- [ ] User acceptance testing

---

## References

- [AI SDK v6 Call Options Documentation](https://v6.ai-sdk.dev/docs/agents/configuring-call-options)
- [AI SDK v6 ToolLoopAgent](https://v6.ai-sdk.dev/docs/agents/tool-loop-agent)
- [Zod Schema Validation](https://zod.dev/)

---

*Last Updated: December 18, 2024*
