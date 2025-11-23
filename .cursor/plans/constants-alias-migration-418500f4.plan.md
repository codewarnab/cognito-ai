<!-- 418500f4-eddf-44ae-9e03-14e6b6450420 9feb633a-e126-427f-a522-fd6d53fcb273 -->
# Constants Alias Migration Plan

## Overview

This plan outlines the migration of all constant imports to use the `@constants` path alias. The project currently uses relative paths like `../../constants` or `../constants` which will be replaced with `@constants` for better maintainability and consistency.

## Current State Analysis

- Constants are located in `src/constants/` directory
- Main constants file: `src/constants.ts`
- Sub-directory constants: `src/constants/mcpServers.tsx`, `src/constants/toolDescriptions.ts`, `src/constants/audio.ts`
- Found 21 files importing from constants directory
- Current import patterns:
- `from '../../constants'`
- `from '../../../constants'`
- `from '../constants'`
- `from '../../constants/mcpServers'`
- `from '../../constants/toolDescriptions'`

## Phase 1: Configure Path Alias

### 1.1 Update tsconfig.json

- Add `@constants` alias to `compilerOptions.paths` in `tsconfig.json`
- Path mapping: `"@constants/*": ["./src/constants/*"]` and `"@constants": ["./src/constants"]`
- This allows both `@constants` (for index) and `@constants/file` (for specific files)

### Files to modify:

- `tsconfig.json` (lines 18-31)

## Phase 2: Update Constants Directory Imports

### 2.1 Update Main Constants File Imports

Files importing from `src/constants.ts`:

- `src/hooks/useMessageHandlers.ts` (line 8)
- `src/components/features/mcp/McpManager.tsx` (line 10)
- `src/components/features/mcp/ToolCountWarning.tsx` (line 3)
- `src/components/data/troubleshootingData.ts` (line 1)
- `src/background/alarms.ts` (line 13)
- `src/background/mcp/tools.ts` (line 11)
- `src/background/mcp/auth.ts` (line 26)
- `src/background/mcp/manager.ts` (line 14)

**Change pattern:**

- `from '../constants'` → `from '@constants'`
- `from '../../constants'` → `from '@constants'`
- `from '../../../constants'` → `from '@constants'`

### 2.2 Update mcpServers Constants Imports

Files importing from `src/constants/mcpServers.tsx`:

- `src/components/features/mcp/McpManager.tsx` (line 7)
- `src/background/initializer.ts` (line 13)
- `src/background/mcp/tools.ts` (line 12)

**Change pattern:**

- `from '../../../constants/mcpServers'` → `from '@constants/mcpServers'`
- `from '../constants/mcpServers'` → `from '@constants/mcpServers'`

### 2.3 Update toolDescriptions Constants Imports

Files importing from `src/constants/toolDescriptions.ts`:

- `src/components/features/settings/components/EnabledToolsSettings.tsx` (line 7)

**Change pattern:**

- `from '../../../../constants/toolDescriptions'` → `from '@constants/toolDescriptions'`

### 2.4 Verify Other Constants Files

Check for imports from:

- `src/constants/audio.ts` (if any exist)

## Phase 3: Verification and Testing

### 3.1 Type Checking

- Run `npm run type:check` to ensure all imports resolve correctly
- Fix any TypeScript errors related to path resolution

### 3.2 Build Verification

- Run `npm run build` to ensure the build system recognizes the new aliases
- Verify Plasmo/Vite resolves the aliases correctly

### 3.3 Import Consistency Check

- Search for any remaining relative imports to constants directory
- Ensure all imports use the `@constants` alias pattern

## Files Summary

### Configuration Files (1):

- `tsconfig.json`

### Files Requiring Import Updates (21):

1. `src/hooks/useMessageHandlers.ts`
2. `src/components/features/mcp/McpManager.tsx`
3. `src/components/features/mcp/ToolCountWarning.tsx`
4. `src/components/features/mcp/McpToolsManager.tsx`
5. `src/components/data/troubleshootingData.ts`
6. `src/components/features/settings/components/EnabledToolsSettings.tsx`
7. `src/background/initializer.ts`
8. `src/background/alarms.ts`
9. `src/background/mcp/tools.ts`
10. `src/background/mcp/auth.ts`
11. `src/background/mcp/manager.ts`
12. `src/hooks/useChatInputValidation.ts`
13. `src/components/features/chat/components/Composer.tsx`
14. `src/utils/soundNotification.ts`
15. `src/utils/aiNotification.ts`
16. `src/mcp/authHelpers.ts`
17. `src/ai/agents/youtubeToNotion/transcript.ts`
18. `src/ai/agents/youtube/utils/transcript.ts`
19. `src/utils/modelSettings.ts`
20. `src/mcp/state.ts`
21. `src/logger.ts`

## Notes

- Plasmo framework uses Vite under the hood, which should respect tsconfig.json paths
- If build issues occur, may need to check Plasmo-specific configuration
- Maintain import order consistency (Prettier sort-imports plugin will handle this)b