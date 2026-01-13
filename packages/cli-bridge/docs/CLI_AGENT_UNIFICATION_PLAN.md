# CLI Agent Unification Plan

## Overview

We will unify "CLI Agents" (Gemini CLI, Claude Code, etc.) with the standard AI Providers (Google Gemini, Anthropic Claude) into a single "Model Selector".

This means users select their "Brain" from one place. If they select a generic provider (e.g., Google Gemini), they operate in the standard cloud mode. If they select a CLI Agent (e.g., "Gemini CLI"), they operate via the **CLI Bridge** but get granular control over which model the CLI tool uses.

**Key Insight**: CLI Agents are **providers** (WHERE the AI runs), not **tools modes** (WHICH tools are available). This decoupling allows users to use chat/agent/adaptive modes with any provider.

---

## Updated Requirements

1. **Naming**: No "(Local)" suffixes. Use brand names directly: "Gemini CLI", "Claude Code", "Codex CLI".
2. **Model Lists**: Mirror the **exact same models** available in the corresponding Cloud provider.
   - *Gemini CLI* shows models from *Google Gemini* provider.
   - *Codex CLI* shows models from *OpenAI* provider.
   - *Claude Code* shows models from *Anthropic* provider.
   - Dynamically fetch these lists from `providersConfig` to ensure they are always up-to-date.
3. **Mode Support**: **All modes (chat/agent/adaptive)** work with CLI providers.
   - CLI providers execute browser tools just like cloud providers
   - `enabledTools` list is filtered based on the selected `ToolsMode`
   - Same user experience regardless of provider type
4. **UI Placement & Interaction**:
   - **Move** the Unified Model Selector to the area **above the chat input**.
   - **Hide** the suggestion pills (Suggested Actions) entirely in the UI.
   - **Preserve** the Suggestion Actions code/logic (do not delete it).

---

## Mode Architecture (Critical Change)

### Current Architecture (Problematic)

```
ToolsMode = 'chat' | 'agent' | 'adaptive' | 'custom' | 'cli'
                                                        ^^^
                                            CLI is mixed with tool modes!
```

When user selects a CLI agent, `ToolsMode` switches to `'cli'`, **losing** the chat/agent/adaptive distinction.

### New Architecture (Decoupled)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Provider Selection                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Google Gemini   │  │   Gemini CLI     │  │  Claude Code  │  │
│  │  (Cloud API)     │  │  (Local Bridge)  │  │ (Local Bridge)│  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Tools Mode                               │
│  ┌────────┐  ┌─────────┐  ┌────────────┐  ┌──────────┐          │
│  │  Chat  │  │  Agent  │  │  Adaptive  │  │  Custom  │          │
│  └────────┘  └─────────┘  └────────────┘  └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Enabled Tools List                          │
│  (Determined by ToolsMode, passed to provider via enabledTools)  │
└─────────────────────────────────────────────────────────────────┘
```

### Type Changes

```typescript
// BEFORE (in @/types/settings.ts)
export type ToolsMode = 'chat' | 'agent' | 'adaptive' | 'custom' | 'cli';

// AFTER - Remove 'cli' from ToolsMode
export type ToolsMode = 'chat' | 'agent' | 'adaptive' | 'custom';

// NEW - Track provider type separately
export interface ProviderState {
  providerId: string;           // 'google', 'anthropic', 'cli-gemini-cli', etc.
  isCliProvider: boolean;       // true if providerId starts with 'cli-'
  cliAgentName?: string;        // 'Gemini CLI', 'Claude Code', etc.
}
```

---

## Shared System Prompts

### Current Problem

CLI Bridge defines its own simple prompt in `packages/cli-bridge/src/handlers/chatUtils.ts`:

```typescript
export const CODING_AGENT_SYSTEM_PROMPT =
    'You are a coding agent connected to the user\'s Chrome extension. ' +
    'When you need to take actions in the browser (navigate, click, read content), call the available tools. ' +
    'Tool results are returned as structured data; use them to proceed. ' +
    'Be direct and pragmatic.';
```

This is **completely different** from the rich prompts used by cloud/BYOK mode in:
- `apps/extension/src/ai/prompts/templates/remote.ts` (agent mode)
- `apps/extension/src/ai/prompts/templates/remote.ts` → `chatModeSystemPrompt` (chat mode)
- `apps/extension/src/ai/prompts/templates/adaptivePrompt.ts` (adaptive mode)

### Solution: Move Prompts to `@cognito/shared`

Just like cloud mode and BYOK mode share the same prompts, CLI Bridge should use the **exact same prompts**.

#### Phase 1: Export Prompts from Shared Package

Add to `packages/shared/src/constants/prompts.ts`:

```typescript
/**
 * System prompts for different tools modes
 * Used by extension (cloud/BYOK) and CLI Bridge alike
 */

// Agent mode - full browser automation
export const AGENT_MODE_SYSTEM_PROMPT = `You are an autonomous Chrome extension agent...`;

// Chat mode - minimal tools, Q&A focused  
export const CHAT_MODE_SYSTEM_PROMPT = `You are a helpful AI assistant...`;

// Adaptive mode - on-demand tool discovery
export const ADAPTIVE_MODE_SYSTEM_PROMPT = `You are an autonomous Chrome extension agent with adaptive tool discovery...`;

// Builder functions for dynamic prompts (date/time injection)
export function buildAgentModePrompt(): string { ... }
export function buildChatModePrompt(): string { ... }
export function buildAdaptiveModePrompt(): string { ... }
```

#### Phase 2: Update Extension to Import from Shared

In `apps/extension/src/ai/prompts/templates/remote.ts`:

```typescript
// BEFORE
function buildRemoteSystemPrompt(): string { ... }
export const remoteSystemPrompt = buildRemoteSystemPrompt();

// AFTER
import { buildAgentModePrompt } from '@cognito/shared';
export const remoteSystemPrompt = buildAgentModePrompt();
```

#### Phase 3: Update CLI Bridge to Use Shared Prompts

In `packages/cli-bridge/src/handlers/geminiHandler.ts`:

```typescript
// BEFORE
import { CODING_AGENT_SYSTEM_PROMPT } from './chatUtils';

// AFTER
import { buildAgentModePrompt, buildChatModePrompt, buildAdaptiveModePrompt } from '@cognito/shared';

export async function handleGeminiCliChat(params: AgentHandlerParamsWithCwd) {
    const { toolsMode = 'agent' } = params;
    
    // Select prompt based on mode
    let systemPrompt: string;
    switch (toolsMode) {
        case 'chat':
            systemPrompt = buildChatModePrompt();
            break;
        case 'adaptive':
            systemPrompt = buildAdaptiveModePrompt();
            break;
        default:
            systemPrompt = buildAgentModePrompt();
    }
    
    // ... rest of handler
}
```

---

## Architecture Details

### 1. Provider Selection Flow

```typescript
// In useModelSelector.ts
function handleProviderSelect(providerId: string, modelId: string) {
    const isCliProvider = providerId.startsWith('cli-');
    
    if (isCliProvider) {
        // Extract CLI agent name: 'cli-gemini-cli' → 'Gemini CLI'
        const agentName = extractAgentName(providerId);
        
        // Set provider state (NOT tools mode!)
        setProviderState({
            providerId,
            isCliProvider: true,
            cliAgentName: agentName
        });
        
        // ToolsMode stays as-is (chat/agent/adaptive)
        // User can still toggle between modes
    } else {
        setProviderState({
            providerId,
            isCliProvider: false
        });
    }
}
```

### 2. Chat Request with Tools Mode

The extension sends `toolsMode` and `enabledTools` to CLI Bridge:

```typescript
// In extension: services/codeBridge/codeBridgeClient.ts
interface CliBridgeChatParams {
    messages: Message[];
    agent: { name: string; command: string; args: string[] };
    enabledTools?: string[];      // Filtered by ToolsMode
    toolsMode?: 'chat' | 'agent' | 'adaptive' | 'custom';  // NEW
    sessionId?: string;
}

// Usage
const enabledTools = getEnabledToolsForMode(currentToolsMode);
const params: CliBridgeChatParams = {
    messages,
    agent: selectedCliAgent,
    enabledTools,           // e.g., ['readPageContent', 'takeScreenshot'] for chat mode
    toolsMode: currentToolsMode,  // e.g., 'chat'
};
```

### 3. CLI Bridge Handler Updates

```typescript
// In packages/cli-bridge/src/handlers/chat.ts
const ChatRequestSchema = z.object({
    messages: z.array(MessageSchema),
    agent: AgentSchema,
    sessionId: z.string().optional(),
    enabledTools: z.array(z.string()).optional(),
    toolsMode: z.enum(['chat', 'agent', 'adaptive', 'custom']).optional().default('agent'),
});

export async function handleChat(req, res) {
    const { messages, agent, enabledTools, toolsMode } = parsed.data;
    
    // Pass toolsMode to agent handler for prompt selection
    await handleGeminiCliChat({
        ...params,
        enabledTools,
        toolsMode,
    });
}
```

---

## Implementation Plan

### Phase 1: Shared Prompts (Foundation)

1. **Create prompt builders in `@cognito/shared`**
   - Move `buildAgentModePrompt`, `buildChatModePrompt`, `buildAdaptiveModePrompt`
   - Export from `packages/shared/src/constants/prompts.ts`
   
2. **Update extension to import from shared**
   - Refactor `apps/extension/src/ai/prompts/templates/remote.ts`
   - Ensure no breaking changes

3. **Update CLI Bridge to use shared prompts**
   - Replace `CODING_AGENT_SYSTEM_PROMPT` with mode-aware prompt selection
   - Add `toolsMode` parameter to handlers

### Phase 2: Type System Cleanup

1. **Remove `'cli'` from `ToolsMode`**
   - Update `apps/extension/src/types/settings.ts`
   - Find and fix all `toolsMode === 'cli'` checks

2. **Add `isCliProvider` state**
   - Create separate state for tracking CLI provider selection
   - Update stores accordingly

3. **Update all CLI mode checks**
   - Replace `toolsMode === 'cli'` with `isCliProvider === true`
   - This affects: `ComposerToolbar.tsx`, `SuggestedActions.tsx`, `toolBridgeClient.ts`, etc.

### Phase 3: UI Unification

1. **Dynamic Provider Injection**
   - Implement `getDisplayProviders()` in `useModelSelector.ts`
   - Integrate `useCliModeStore` for available agents

2. **Component Restructuring**
   - Create `ComposerHeader.tsx` from `SuggestedActions.tsx`
   - Add `ModelSelectorPopover`
   - Preserve suggestion logic (hidden)

3. **Legacy Cleanups**
   - Remove `CliAgentSelector.tsx`
   - Update `Composer.tsx` and `ComposerToolbar.tsx`

### Phase 4: CLI Bridge Protocol Updates

1. **Extend chat request schema**
   - Add `toolsMode` field
   - Validate against allowed modes

2. **Update all agent handlers**
   - `geminiHandler.ts` - mode-aware prompt selection
   - `claudeCodeHandler.ts` - mode-aware prompt selection  
   - `codexHandler.ts` - mode-aware prompt selection

---

## Technical Details

### `mapAgentToCloudProvider` Helper

```typescript
const MAPPING: Record<string, string> = {
    'Gemini CLI': 'google',
    'Claude Code': 'anthropic',
    'Codex CLI': 'openai'
};

export function mapAgentToCloudProvider(agentName: string): string {
    return MAPPING[agentName] ?? 'google';
}
```

### Mode-Based Tool Filtering

```typescript
// In extension: getEnabledToolsForMode()
const CHAT_MODE_TOOLS = ['readPageContent', 'takeScreenshot', 'getActiveTab', ...];
const AGENT_MODE_TOOLS = [...CHAT_MODE_TOOLS, 'navigateTo', 'clickByText', 'typeInField', ...];
const ADAPTIVE_MODE_TOOLS = ['discoverTools', 'executeTools', 'readPageContent', ...];

function getEnabledToolsForMode(mode: ToolsMode): string[] {
    switch (mode) {
        case 'chat': return CHAT_MODE_TOOLS;
        case 'agent': return AGENT_MODE_TOOLS;
        case 'adaptive': return ADAPTIVE_MODE_TOOLS;
        case 'custom': return getUserCustomTools();
    }
}
```

---

## Summary

| Before | After |
|--------|-------|
| `'cli'` is a `ToolsMode` | `'cli'` removed; CLI is a provider type |
| CLI agents have simple prompt | CLI agents use same prompts as cloud/BYOK |
| No chat/agent/adaptive in CLI mode | Full mode support with CLI providers |
| Prompts defined separately in extension and CLI bridge | Prompts shared via `@cognito/shared` |

The result: **Consistent AI behavior** regardless of whether the user picks "Google Gemini" (cloud) or "Gemini CLI" (local). Both use the same prompts, same mode system, and same tool filtering logic.
