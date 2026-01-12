# CLI Agent Unification Plan

## Overview
We will unify "CLI Agents" (Gemini CLI, Claude Code, etc.) with the standard AI Providers (Google Gemini, Anthropic Claude) into a single "Model Selector".

This means users select their "Brain" from one place. If they select a generic provider (e.g., Google Gemini), they operate in the standard cloud mode. If they select a CLI Agent (e.g., "Gemini CLI"), they operate in **CLI Mode** but get granular control over which model the CLI tool uses.

## Updated Requirements
1.  **Naming**: No "(Local)" suffixes. Use brand names directly: "Gemini CLI", "Claude Code", "Codex CLI".
2.  **Model Lists**: Mirror the **exact same models** available in the corresponding Cloud provider.
    *   *Gemini CLI* shows models from *Google Gemini* provider.
    *   *Codex CLI* shows models from *OpenAI* provider.
    *   *Claude Code* shows models from *Anthropic* provider.
    *   Dynamically fetch these lists from `providersConfig` to ensure they are always up-to-date.
3.  **UI Placement & Interaction**:
    *   **Move** the Unified Model Selector to the area **above the chat input** (currently occupied by `SuggestedActions` or `CliAgentSelector`).
    *   **Hide** the suggestion pills (Suggested Actions) entirely in the UI to make room for the Model Selector.
    *   **Preserve** the Suggestion Actions code/logic (do not delete it), just ensure it doesn't render visible pills for now.

## Architecture

### 1. Dynamic Provider Injection (`useModelSelector.ts`)

```typescript
// Algorithm
function getDisplayProviders(cloudProviders, cliAgents) {
    const displayProviders = [...cloudProviders]; // Start with cloud

    // Inject CLI Agents as separate providers
    cliAgents.forEach(agent => {
        // 1. Determine "Source Cloud Provider" mapping
        const sourceProviderId = mapAgentToCloudProvider(agent.name);
        
        // 2. Clone models from that source
        const sourceModels = cloudProviders.find(p => p.id === sourceProviderId)?.models || [];
        
        // 3. Create new "CLI Provider"
        displayProviders.push({
            id: `cli-${agent.name}`, // Unique ID
            name: agent.name,        // "Gemini CLI"
            icon: agent.icon,
            models: sourceModels     // Same models!
        });
    });

    return displayProviders;
}
```

### 2. Component Restructuring (`ComposerHeader.tsx`)

We will rename `SuggestedActions.tsx` to `ComposerHeader.tsx` (to reflect its new primary purpose).

**Role**:
*   Always render the **Unified Model Selector Button/Popover** on the left.
*   Retain the internal logic for `useSuggestions` (hooks, state), but **visually hide** the rendered suggestion pills.
*   This ensures we can easily re-enable suggestions later if needed, side-by-side with the model selector.

**Structure**:
```tsx
export const ComposerHeader = (props) => {
    // ... keep existing suggestion hooks ...
    const { suggestions } = useSuggestions(...);

    return (
        <div className="absolute bottom-full ...">
             {/* Unified Model Selector (Always Visible) */}
             <ModelSelectorPopover {...props} />

             {/* Suggestions (Hidden for now, but code preserved) */}
             {/* 
             <div className="hidden">
                 {suggestions.map(...)}
             </div>
             */}
        </div>
    );
}
```

### 3. Legacy Cleanups
*   **Remove `CliAgentSelector.tsx`**: Its functionality is fully absorbed into the Unified Model Selector.
*   **Update `Composer.tsx`**: Import `ComposerHeader` instead of `SuggestedActions`.
*   **Update `ComposerToolbar.tsx`**: Remove the bottom-left `ModelSelectorPopover` instance (since it moved to the header).

### 4. Implementation Plan

#### Phase 1: Shared Constants
*   Move `AGENT_ICONS` from `CliAgentSelector` to a shared icons file so `ModelSelector` can use them.

#### Phase 2: Update `useModelSelector` Hook
*   Implement the model cloning logic.
*   Integrate `useCliModeStore` to get available agents.
*   Handle `cli-` prefixed provider IDs to switch `ToolsMode` to `'cli'`.

#### Phase 3: Create `ComposerHeader`
*   Rename `SuggestedActions.tsx` -> `ComposerHeader.tsx`.
*   Add `ModelSelectorPopover`.
*   Comment out / hide the rendering of suggestion pills.

#### Phase 4: Composer Integration
*   Switch `ChatInput.tsx` to use `<ComposerHeader />`.
*   Remove legacy specific selectors.

## Technical Details

**`mapAgentToCloudProvider` Helper**:
```typescript
const MAPPING = {
    'Gemini CLI': 'google',
    'Claude Code': 'anthropic',
    'Codex CLI': 'openai'
};
```

## Summary
The UI moves "Brain Selection" to the top of the composer. The legacy "Suggested Actions" (pills) logic is preserved but hidden from view, leaving the header clean for the new Unified Model Selector.
