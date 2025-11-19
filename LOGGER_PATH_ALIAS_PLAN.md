# Logger Path Alias Migration Plan

## Executive Summary
This plan adds a TypeScript path alias `~logger` for the logger module and updates all 150+ import statements across the project to use the new alias, eliminating relative path imports.

*Note: Initially planned as `@logger`, but switched to `~logger` to align with Plasmo's native alias conventions and fix bundling issues.*

---

## Current State Analysis

### Current Logger Location
- **File**: `src/logger.ts`
- **Exports**: 
  - `createLogger` function (main export)
  - `logger` instance (default app logger)

### Current Import Patterns
**150+ files** import from logger using relative paths:
- `'../logger'` (78 instances) - One level up
- `'../../logger'` (55 instances) - Two levels up
- `'../../../logger'` (17 instances) - Three levels up
- `'../../../../logger'` (2 instances) - Four levels up
- `'./logger'` (3 instances) - Same directory

---

## Proposed Solution

### New tsconfig.json Path Alias
```json
{
  "baseUrl": ".",
  "paths": {
    "@/*": ["./src/*"],
    "@assets/*": ["./assets/*"],
    "~logger": ["./src/logger"]
  }
}
```

### Target Import Pattern
**Before:**
```typescript
import { createLogger } from '../../../logger';
import { createLogger } from "../../logger";
```

**After:**
```typescript
import { createLogger } from '~logger';
```

---

## Migration Phases

### Phase 1: TypeScript Configuration Update 🔧 (COMPLETED)
**Goal**: Add logger path alias to tsconfig

#### Tasks:
1. [x] Update `tsconfig.json` to add `~logger` path mapping
2. [x] Verify TypeScript compilation with `pnpm type:check`

#### Files Modified:
- `tsconfig.json`

**Validation**: 
- TypeScript compilation succeeds
- No new type errors

---

### Phase 2: Update Import Statements 🔄 (COMPLETED)
**Goal**: Replace all relative logger imports with `~logger` alias

#### Files by Category (150+ total):

(See original plan for full list)

**Validation**:
- All files updated to use `~logger`

---

### Phase 3: Validation & Testing ✅ (COMPLETED)
**Goal**: Ensure all imports work correctly

#### Tasks:
1. [x] Run TypeScript type check: `pnpm type:check`
2. [x] Run development/production build: `pnpm build`
3. [x] Verify no console errors related to imports (via build success)

#### Test Scenarios:
- [x] Build succeeds (confirms bundler resolution)
- [x] Type check passes (confirms TS resolution)

**Validation Checklist:**
- [x] TypeScript compilation passes (ignoring unrelated legacy errors)
- [x] Build artifacts generated successfully (`build/chrome-mv3-prod`)

---

### Phase 4: Cleanup & Commit 🧹
**Goal**: Finalize migration

#### Tasks:
1. Search for any remaining relative logger imports
2. Verify build output is identical
3. Create comprehensive git commit
4. Update documentation if needed

**Git Commit Message:**
```
refactor: Add ~logger path alias and update all imports

- Added "~logger": ["./src/logger"] path alias to tsconfig.json
- Updated 150+ import statements from relative paths to ~logger
- Consistent import pattern across entire codebase
- Improved maintainability and refactor safety
- Aligned with Plasmo's '~' alias convention

Files changed: ~153 files
Pattern: '../logger' | '../../logger' | etc. → '~logger'
```

---

## Post-Migration Guidelines

### For Future Development:
1. **Always use**: `import { createLogger } from '~logger'`
2. **Never use**: Relative paths to logger
3. **Pattern**: Create logger in module: `const log = createLogger('ModuleName')`

### Example Usage:
```typescript
// ✅ Correct - New pattern
import { createLogger } from '~logger';

const log = createLogger('MyComponent');

log.info('Component initialized');
log.error('Failed to load', error);
```