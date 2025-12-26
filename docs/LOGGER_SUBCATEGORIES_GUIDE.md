# Adding Sub-Categories to Logger Sections

This guide explains how to add sub-categories to other logger sections (Tools, AI, Voice, etc.) following the pattern established for MCP.

## Overview 

Sub-categories provide granular logging control within a main category. For example:
- `MCP_CLIENT` has sub-categories: `CONNECTION`, `STATE`, `UI`
- `VOICE` could have sub-categories: `RECORDING`, `PLAYBACK`, `PROCESSING`

## Implementation Steps

### 1. Update Shared Package Types

**File:** `packages/shared/src/types/logger.ts`

#### a) Add Sub-Category Keys to `LogCategory`

```typescript
export type LogCategory =
    // ... existing categories ...
    // YOUR_CATEGORY Sub-categories
    | 'YOUR_CATEGORY_SUBCATEGORY1'
    | 'YOUR_CATEGORY_SUBCATEGORY2'
    | 'YOUR_CATEGORY_SUBCATEGORY3'
    // ... rest of categories
```

#### b) Add Sub-Category Type Definition

```typescript
export type YourCategorySubCategory = 'SUBCATEGORY1' | 'SUBCATEGORY2' | 'SUBCATEGORY3';
```

#### c) Update `LOGGER_SUBCATEGORY_GROUPS`

```typescript
export const LOGGER_SUBCATEGORY_GROUPS = {
    // ... existing groups ...
    YOUR_CATEGORY: ['YOUR_CATEGORY_SUBCATEGORY1', 'YOUR_CATEGORY_SUBCATEGORY2', 'YOUR_CATEGORY_SUBCATEGORY3'] as const,
} as const;
```

---

### 2. Update Shared Package Exports

**File:** `packages/shared/src/types/index.ts`

Export the new sub-category type:
```typescript
export type {
    // ... existing types ...
    YourCategorySubCategory,
} from './logger.js';
```

---

### 3. Update All Presets

**File:** `packages/shared/src/constants/logger.ts`

Add sub-category defaults to **all 9 presets** (DEVELOPMENT, DEBUG_MCP, DEBUG_VOICE, DEBUG_TOOLS, DEBUG_SANDBOX, DEBUG_WORKFLOW, PRODUCTION, QUIET, VERBOSE):

```typescript
DEVELOPMENT: {
    // Parent category
    YOUR_CATEGORY: true,
    // Sub-categories (match parent's logical intent)
    YOUR_CATEGORY_SUBCATEGORY1: true,
    YOUR_CATEGORY_SUBCATEGORY2: true,
    YOUR_CATEGORY_SUBCATEGORY3: false, // Maybe verbose, so off by default
    // ...
},
```

> **Tip:** Use the parent category's state as a guide. If parent is `true`, sub-categories likely default to `true`. If parent is `false`, sub-categories should be `false`.

---

### 4. Update Extension Logger Calls

**Files:** Various extension files using `createLogger`

Find all occurrences:
```bash
grep -r "createLogger.*'YOUR_CATEGORY'" apps/extension/src
```

Update each to use the appropriate sub-category:
```typescript
// Before
const log = createLogger('FeatureName', 'YOUR_CATEGORY');

// After - choose the appropriate sub-category
const log = createLogger('FeatureName', 'YOUR_CATEGORY_SUBCATEGORY1');
```

**Sub-category naming guidelines:**
- `*_UI` - UI components, hooks, React code
- `*_CONNECTION` - Network, connections, clients
- `*_STATE` - State management, stores
- `*_PROCESSING` - Data processing, transformations
- `*_REGISTRY` - Registration, indexing

---

### 5. Build and Verify

```bash
# Build shared package first
pnpm --filter @cognito/shared build

# Build extension
pnpm --filter @cognito/extension build

# Build webapp (if using logger panel)
pnpm --filter @cognito/webapp build
```

---

## UI Behavior

The `CategoryGroup.tsx` component automatically:
1. Detects categories with sub-categories via `hasSubCategories()`
2. Shows expand arrow for those categories
3. Displays nested toggle switches for each sub-category
4. Shows count badge (e.g., "2/3 enabled")

**No UI changes needed** when adding new sub-categories.

---

## Quick Reference: MCP Implementation

| Parent | Sub-Categories |
|--------|----------------|
| `MCP_CLIENT` | `CONNECTION`, `STATE`, `UI` |
| `MCP_TOOLS` | `METADATA`, `REGISTRY` |
| `MCP_EXECUTION` | `PROXY`, `INVOKE` |
| `MCP_AUTH` | `OAUTH`, `DISCOVERY`, `SCOPE` |
| `MCP_SSE` | `TRANSPORT`, `STREAM`, `MESSAGE` |
| `WEBMCP` | `MANAGER`, `TOOLS`, `BACKEND` |
| `AI_CHAT` | `STREAM`, `BACKEND`, `SETUP` |
| `AI_PROMPTS` | `SUGGESTIONS`, `SUMMARIZER` |
| `VOICE_RECORDING` | `CAPTURE`, `PERMISSIONS`, `BUFFER` |
| `VOICE_CLIENT` | `CONNECTION`, `EVENTS`, `STATE` |
| `VOICE_UI` | `PANEL`, `CONTROLS`, `FEEDBACK` |
| `VOICE_AUDIO` | `PLAYBACK`, `PROCESSING`, `LEVELS` |

---

## Files Changed Summary

| Package | Files |
|---------|-------|
| `@cognito/shared` | `types/logger.ts`, `types/index.ts`, `constants/logger.ts` |
| `@cognito/webapp` | `CategoryGroup.tsx` (auto-handles sub-categories) |
| `@cognito/extension` | All files using `createLogger` with the category |
