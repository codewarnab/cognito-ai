# Phase 2: Backend Mode Infrastructure

**Goal**: Rename "local"/"remote" to "backend"/"byok" throughout the extension codebase while maintaining backward compatibility.

**Duration**: 2-3 hours

**Prerequisites**: 
- Phase 1 completed successfully
- Extension currently working in "remote" mode

---

## 📋 Tasks Overview

1. Update type definitions (`AIMode` type)
2. Update model settings utilities
3. Update UI components (headers, dialogs)
4. Add backward compatibility layer
5. Update constants and configuration
6. Test both modes work correctly

---

## 🛠️ Step-by-Step Implementation

### Step 1: Update Core Type Definitions

**File**: `src/ai/types/types.ts`

**Current code**:
```typescript
export type AIMode = 'local' | 'remote';
```

**New code**:
```typescript
/**
 * AI Mode types
 * @deprecated 'local' and 'remote' - use 'backend' and 'byok' instead
 */
export type LegacyAIMode = 'local' | 'remote';

/**
 * AI Mode types
 * - backend: Uses NestJS backend with server-side API keys (default)
 * - byok: Bring Your Own Key - user provides their own API key
 */
export type AIMode = 'backend' | 'byok';

/**
 * Union of old and new modes for backward compatibility during migration
 */
export type AnyAIMode = AIMode | LegacyAIMode;
```

### Step 2: Add Mode Migration Utility

**Create file**: `src/utils/modeMigration.ts`

```typescript
/**
 * Utility functions for migrating between old and new AI mode names
 */

import { createLogger } from '../logger';

const log = createLogger('ModeMigration');

/**
 * Map old mode names to new mode names
 */
const MODE_MIGRATION_MAP = {
  'local': 'backend',  // Local mode is removed, map to backend
  'remote': 'byok',    // Remote mode becomes BYOK
} as const;

/**
 * Migrate old mode name to new mode name
 */
export function migrateModeName(oldMode: string): 'backend' | 'byok' {
  if (oldMode === 'backend' || oldMode === 'byok') {
    return oldMode as 'backend' | 'byok';
  }

  if (oldMode === 'local' || oldMode === 'remote') {
    const newMode = MODE_MIGRATION_MAP[oldMode as 'local' | 'remote'];
    log.info(`Migrating mode: ${oldMode} → ${newMode}`);
    return newMode;
  }

  // Default to backend if unknown mode
  log.warn(`Unknown mode "${oldMode}", defaulting to backend`);
  return 'backend';
}

/**
 * Check if mode name is legacy (old)
 */
export function isLegacyMode(mode: string): boolean {
  return mode === 'local' || mode === 'remote';
}

/**
 * Get user-friendly mode display name
 */
export function getModeName(mode: 'backend' | 'byok'): string {
  return mode === 'backend' ? 'Backend' : 'BYOK';
}

/**
 * Get mode description for UI
 */
export function getModeDescription(mode: 'backend' | 'byok'): string {
  if (mode === 'backend') {
    return 'Uses server-side AI with managed API keys';
  }
  return 'Bring Your Own API Key - use your own Google AI Studio key';
}
```

### Step 3: Update Model Settings Utility

**File**: `src/utils/modelSettings.ts`

Find and update the `getModelConfig` function:

**Current code**:
```typescript
export async function getModelConfig(): Promise<{
  mode: AIMode;
  remoteModel: RemoteModelType;
  conversationStartMode?: AIMode;
}> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    
    return {
      mode: stored?.mode || 'local', // Default to local
      remoteModel: stored?.remoteModel || 'gemini-2.5-flash',
      conversationStartMode: stored?.conversationStartMode,
    };
  } catch (error) {
    console.error('Failed to get model config', error);
    return {
      mode: 'local',
      remoteModel: 'gemini-2.5-flash',
    };
  }
}
```

**New code**:
```typescript
import { migrateModeName } from './modeMigration';

export async function getModelConfig(): Promise<{
  mode: AIMode;
  remoteModel: RemoteModelType;
  conversationStartMode?: AIMode;
}> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    
    // Migrate old mode names to new ones
    const rawMode = stored?.mode || 'backend'; // Default to backend
    const mode = migrateModeName(rawMode);
    
    // Migrate conversation start mode if it exists
    let conversationStartMode: AIMode | undefined;
    if (stored?.conversationStartMode) {
      conversationStartMode = migrateModeName(stored.conversationStartMode);
    }
    
    const config = {
      mode,
      remoteModel: stored?.remoteModel || 'gemini-2.5-flash',
      conversationStartMode,
    };
    
    // If we migrated the mode, save the new mode back to storage
    if (rawMode !== mode) {
      await setModelConfig({ mode, remoteModel: config.remoteModel });
    }
    
    return config;
  } catch (error) {
    console.error('Failed to get model config', error);
    return {
      mode: 'backend',
      remoteModel: 'gemini-2.5-flash',
    };
  }
}
```

### Step 4: Update AI Logic to Support Backend Mode

**File**: `src/ai/core/aiLogic.ts`

Find the section where mode is determined (around line 82):

**Current code**:
```typescript
  if (effectiveMode === 'remote') {
    const hasKey = await hasGeminiApiKey();
    if (!hasKey) {
      log.warn('⚠️ Remote mode requested but no API key found');
      missingApiKey = true;
    }
  }
```

**New code**:
```typescript
  // Check API key requirements based on mode
  if (effectiveMode === 'byok') {
    const hasKey = await hasGeminiApiKey();
    if (!hasKey) {
      log.warn('⚠️ BYOK mode requested but no API key found');
      missingApiKey = true;
    }
  } else if (effectiveMode === 'backend') {
    // Backend mode doesn't need user API key
    log.info('✓ Backend mode - using server-side API keys');
  }
```

### Step 5: Update Chat Header Component

**File**: `src/components/features/chat/components/ChatHeader.tsx`

Update the menu item text:

**Find**:
```typescript
<button
  className="copilot-header-menu-item"
  onClick={() => {
    setShowHeaderMenu(false);
    setShowGeminiDialog(true);
  }}
>
  Gemini API Key Setup
</button>
```

**Replace with**:
```typescript
<button
  className="copilot-header-menu-item"
  onClick={() => {
    setShowHeaderMenu(false);
    setShowGeminiDialog(true);
  }}
>
  BYOK Setup (Bring Your Own Key)
</button>
```

### Step 6: Update API Key Dialog

**File**: `src/components/shared/dialogs/GeminiApiKeyDialog.tsx`

Update the dialog title and description:

**Find**:
```typescript
<DialogTitle>Gemini API Key Setup</DialogTitle>
<DialogDescription>
  Enter your Google AI Studio API key to enable Gemini AI features.
</DialogDescription>
```

**Replace with**:
```typescript
<DialogTitle>BYOK Setup (Bring Your Own Key)</DialogTitle>
<DialogDescription>
  Enter your Google AI Studio API key to use BYOK mode with your own API quota.
</DialogDescription>
```

Add a mode info section after the description:

```typescript
<DialogDescription>
  Enter your Google AI Studio API key to use BYOK mode with your own API quota.
</DialogDescription>

{/* Mode Info */}
<div
  style={{
    padding: '0.75rem',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '8px',
    fontSize: '0.875rem',
    border: '1px solid var(--border-color)',
    marginTop: '0.5rem',
  }}
>
  <p style={{ margin: 0, marginBottom: '0.5rem', fontWeight: 500 }}>
    💡 About BYOK Mode
  </p>
  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
    BYOK (Bring Your Own Key) mode lets you use your own Google AI Studio API key.
    This gives you full control over your API usage and quota.
  </p>
  <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
    Alternatively, you can use <strong>Backend Mode</strong> (default) which uses
    managed API keys without any setup required.
  </p>
</div>
```

### Step 7: Create Mode Selector Component (Optional)

**Create file**: `src/components/shared/mode-selector/ModeSelector.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { getModelConfig, setModelConfig } from '../../../utils/modelSettings';
import { getModeName, getModeDescription } from '../../../utils/modeMigration';
import type { AIMode } from '../../../ai/types/types';

interface ModeSelectorProps {
  onModeChange?: (mode: AIMode) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ onModeChange }) => {
  const [currentMode, setCurrentMode] = useState<AIMode>('backend');
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    loadCurrentMode();
  }, []);

  const loadCurrentMode = async () => {
    const config = await getModelConfig();
    setCurrentMode(config.mode);
  };

  const handleModeChange = async (newMode: AIMode) => {
    setIsChanging(true);
    try {
      await setModelConfig({ mode: newMode });
      setCurrentMode(newMode);
      onModeChange?.(newMode);
    } catch (error) {
      console.error('Failed to change mode:', error);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600 }}>
        AI Mode
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Backend Mode */}
        <button
          onClick={() => handleModeChange('backend')}
          disabled={isChanging}
          style={{
            padding: '1rem',
            borderRadius: '8px',
            border: currentMode === 'backend' 
              ? '2px solid #4a6fa5' 
              : '1px solid var(--border-color)',
            background: currentMode === 'backend' 
              ? 'rgba(74, 111, 165, 0.1)' 
              : 'var(--bg-tertiary)',
            cursor: isChanging ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
            🚀 Backend Mode {currentMode === 'backend' && '(Active)'}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {getModeDescription('backend')}
          </div>
        </button>

        {/* BYOK Mode */}
        <button
          onClick={() => handleModeChange('byok')}
          disabled={isChanging}
          style={{
            padding: '1rem',
            borderRadius: '8px',
            border: currentMode === 'byok' 
              ? '2px solid #4a6fa5' 
              : '1px solid var(--border-color)',
            background: currentMode === 'byok' 
              ? 'rgba(74, 111, 165, 0.1)' 
              : 'var(--bg-tertiary)',
            cursor: isChanging ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
            🔑 BYOK Mode {currentMode === 'byok' && '(Active)'}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {getModeDescription('byok')}
          </div>
        </button>
      </div>
    </div>
  );
};
```

### Step 8: Update Tool Manager

**File**: `src/ai/tools/manager.ts`

Update function comments and parameter names:

**Find**:
```typescript
/**
 * Setup tools for local mode
 */
export function setupLocalTools(
  workflowConfig: WorkflowDefinition | null,
  localSystemPrompt: string
): { tools: Record<string, any>; systemPrompt: string } {
```

**Replace with**:
```typescript
/**
 * Setup tools for backend mode
 * Note: In Phase 5, this will return tool schemas only (no execute functions)
 */
export function setupBackendTools(
  workflowConfig: WorkflowDefinition | null,
  backendSystemPrompt: string
): { tools: Record<string, any>; systemPrompt: string } {
```

Keep the `setupRemoteMode` function but rename it to `setupBYOKMode`:

**Find**:
```typescript
export async function setupRemoteMode(
```

**Replace with**:
```typescript
/**
 * Setup BYOK mode (Bring Your Own Key)
 * Uses user's API key, works exactly like old "remote" mode
 */
export async function setupBYOKMode(
```

### Step 9: Update Prompts

**File**: `src/ai/prompts/templates/local.ts`

Rename file to `backend.ts`:
```bash
# In your terminal
cd src/ai/prompts/templates
mv local.ts backend.ts
```

Update the prompt content to mention "backend mode":

**File**: `src/ai/prompts/templates/backend.ts`

**Find**:
```typescript
export const localSystemPrompt = `...`;
```

**Replace with**:
```typescript
export const backendSystemPrompt = `...`;
```

Update references in the prompt text from "local mode" to "backend mode".

**File**: `src/ai/prompts/templates/remote.ts`

Rename to `byok.ts`:
```bash
mv remote.ts byok.ts
```

**Find**:
```typescript
export const remoteSystemPrompt = `...`;
```

**Replace with**:
```typescript
export const byokSystemPrompt = `...`;
```

### Step 10: Update Imports Throughout Codebase

Search for all files importing the old prompt names and update them:

**Search pattern**: `import.*localSystemPrompt|remoteSystemPrompt`

Files to update:
- `src/ai/core/aiLogic.ts`
- `src/ai/tools/manager.ts`
- Any other files importing these prompts

**Old imports**:
```typescript
import { localSystemPrompt } from '../prompts/templates/local';
import { remoteSystemPrompt } from '../prompts/templates/remote';
```

**New imports**:
```typescript
import { backendSystemPrompt } from '../prompts/templates/backend';
import { byokSystemPrompt } from '../prompts/templates/byok';
```

### Step 11: Update Usage in AI Logic

**File**: `src/ai/core/aiLogic.ts`

Find where modes are handled and update variable names:

**Find**:
```typescript
log.info('🤖 AI Mode:', effectiveMode, effectiveMode === 'remote' ? modelConfig.remoteModel : 'gemini-nano');
```

**Replace with**:
```typescript
log.info('🤖 AI Mode:', effectiveMode, effectiveMode === 'byok' ? modelConfig.remoteModel : 'backend');
```

Update the mode setup calls:

**Find**:
```typescript
if (effectiveMode === 'local') {
  const setup = setupLocalTools(workflow, localSystemPrompt);
  // ...
} else {
  const setup = await setupRemoteMode(/* ... */);
  // ...
}
```

**Replace with**:
```typescript
if (effectiveMode === 'backend') {
  const setup = setupBackendTools(workflow, backendSystemPrompt);
  // ...
} else if (effectiveMode === 'byok') {
  const setup = await setupBYOKMode(/* ... */);
  // ...
}
```

---

## ✅ Testing Phase 2

### Test 1: Mode Migration

1. Open Chrome DevTools → Application → Storage → Local Storage
2. Find the `modelSettings` key
3. Manually set mode to `"remote"` or `"local"`
4. Reload the extension
5. Check that mode is automatically migrated to `"byok"` or `"backend"`

### Test 2: BYOK Mode Still Works

1. Open the extension
2. Go to "BYOK Setup"
3. Enter your API key
4. Send a message
5. Verify response works correctly

### Test 3: Backend Mode (Will fail - expected)

1. Switch to backend mode
2. Try sending a message
3. Should show error (backend not implemented yet)
4. This is expected - we'll fix in Phase 3

### Test 4: UI Updates

1. Check that all UI text shows "BYOK" instead of "Remote"
2. Check that "Local" option is no longer visible
3. Check that mode selector shows both options

---

## 🎯 Phase 2 Completion Checklist

- [ ] Type definitions updated with new `AIMode` type
- [ ] Mode migration utility created
- [ ] Model settings utility updated with migration logic
- [ ] UI components updated (dialogs, headers)
- [ ] Tool manager functions renamed
- [ ] Prompt files renamed (local.ts → backend.ts, remote.ts → byok.ts)
- [ ] All imports updated throughout codebase
- [ ] BYOK mode still works correctly
- [ ] Mode migration tested successfully
- [ ] No TypeScript errors

---

## 🚀 Next Steps

Once Phase 2 is complete:

**→ Proceed to Phase 3: Basic Backend API**

This phase will:
- Implement `/api/chat` endpoint in NestJS
- Add extension ID authentication
- Setup basic streaming response
- Connect extension to backend
