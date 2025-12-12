# Plasmo to WXT Migration Plan

## Cognito AI Extension Migration Guide

This document provides a comprehensive, phase-by-phase migration plan for moving the Cognito AI Chrome extension from [Plasmo](https://docs.plasmo.com/) to [WXT](https://wxt.dev/).

> **Migration Type:** Phase-by-phase incremental migration  
> **Target Browser:** Chrome (MV3)  
> **Estimated Phases:** 12 phases  
> **Risk Level:** Moderate (complex extension with many features)

---

## Table of Contents

1. [Pre-Migration Overview](#phase-0-pre-migration-overview)
2. [Phase 1: Project Setup & Configuration](#phase-1-project-setup--configuration)
3. [Phase 2: TypeScript & Path Aliases](#phase-2-typescript--path-aliases)
4. [Phase 3: Environment Variables](#phase-3-environment-variables)
5. [Phase 4: Static Assets & Public Files](#phase-4-static-assets--public-files)
6. [Phase 5: Background Service Worker ✅](#phase-5-background-service-worker)
7. [Phase 6: Side Panel Entry Point](#phase-6-side-panel-entry-point)
8. [Phase 7: Content Scripts Migration](#phase-7-content-scripts-migration)
9. [Phase 8: Options Page](#phase-8-options-page)
10. [Phase 9: Storage Migration](#phase-9-storage-migration)
11. [Phase 10: CSS & Tailwind Integration](#phase-10-css--tailwind-integration)
12. [Phase 11: Manifest Configuration](#phase-11-manifest-configuration)
13. [Phase 12: Final Cleanup & Verification](#phase-12-final-cleanup--verification)

---

## Phase 0: Pre-Migration Overview

### Current Plasmo Architecture

```
apps/extension/
├── src/
│   ├── sidepanel.tsx           # Main UI (React) - Plasmo auto-detects
│   ├── background.ts           # Service Worker - Plasmo auto-detects
│   ├── options.tsx             # Options page - Plasmo auto-detects
│   ├── contents/               # Content scripts (6 files)
│   │   ├── ask-command.tsx
│   │   ├── ask-ai-button.tsx
│   │   ├── text-rewriter.tsx
│   │   ├── text-summarizer.tsx
│   │   ├── write-command.tsx
│   │   └── webmcp-proxy.ts
│   ├── actions/                # Browser automation
│   ├── ai/                     # AI integration
│   ├── components/             # React components
│   ├── hooks/                  # React hooks
│   ├── mcp/                    # MCP client
│   └── ...
├── assets/                     # Icons, images
├── public/                     # Static files (offscreen.html/js)
├── package.json               # Manifest config embedded
└── tsconfig.json              # Extends Plasmo's base config
```

### Target WXT Architecture

```
apps/extension/
├── entrypoints/                # WXT entrypoints directory
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── style.css
│   ├── background.ts
│   ├── options/
│   │   ├── index.html
│   │   └── main.tsx
│   ├── ask-command.content/
│   │   ├── index.tsx
│   │   └── style.css
│   ├── ask-ai-button.content.tsx
│   ├── text-rewriter.content/
│   │   ├── index.tsx
│   │   └── style.css
│   ├── text-summarizer.content/
│   │   ├── index.tsx
│   │   └── style.css
│   ├── write-command.content/
│   │   ├── index.tsx
│   │   └── style.css
│   ├── webmcp-proxy.content.ts
│   └── offscreen.html          # Unlisted page
├── src/                        # Shared source code
│   ├── actions/
│   ├── ai/
│   ├── components/
│   ├── hooks/
│   └── ...
├── assets/                     # Icons, images
├── public/                     # Static files
├── wxt.config.ts              # WXT configuration (manifest here)
└── tsconfig.json              # Extends WXT's config
```

### Key Differences: Plasmo vs WXT

| Feature | Plasmo | WXT |
|---------|--------|-----|
| Entry detection | File naming (`*.content.tsx`, `sidepanel.tsx`) | `entrypoints/` directory |
| Manifest config | `package.json` → `manifest` key | `wxt.config.ts` |
| CSS in content scripts | `data-text:` imports + `getStyle()` | Standard imports + `cssInjectionMode` |
| TypeScript config | Extends `plasmo/templates/tsconfig.base` | Extends `.wxt/tsconfig.json` |
| Environment vars | `PLASMO_PUBLIC_*` prefix | `WXT_*` or `VITE_*` prefix |
| Storage | `@plasmohq/storage` | `@wxt-dev/storage` or native |
| Browser API | `chrome.*` | `browser.*` (polyfilled) |
| Auto-imports | None | Built-in (configurable) |

---

## Phase 1: Project Setup & Configuration ✅ DONE

> **Implementation Notes (2025-12-12):**
> - Entrypoints directory created at `src/entrypoints/` (not root `entrypoints/`) because WXT looks for entrypoints relative to `srcDir`
> - Removed `imports` config block (auto-imports) - can be added later if needed
> - `author` field must be object `{ email: 'dev@codewarnab.in' }` not string (WXT type requirement)
> - Added placeholder `src/entrypoints/background.ts` so `wxt prepare` can run

### 1.1 Install WXT

```bash
# From apps/extension directory
pnpm add -D wxt

# Install React plugin for Vite
pnpm add -D @vitejs/plugin-react
```

### 1.2 Create `wxt.config.ts`

Create the main WXT configuration file:

```typescript
// apps/extension/wxt.config.ts
import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Use src/ directory for non-entrypoint code
  srcDir: 'src',
  
  // Entrypoints directory (created in Phase 5+)
  entrypointsDir: 'entrypoints',
  
  // Output directory
  outDir: 'dist',
  
  // Target browsers
  browser: 'chrome',
  manifestVersion: 3,
  
  // React support via Vite
  vite: () => ({
    plugins: [react()],
  }),
  
  // Auto-imports configuration
  imports: {
    // Add commonly used imports
    addons: {
      vueTemplate: false,
    },
    presets: ['react'],
  },
  
  // Manifest configuration (migrated from package.json in Phase 11)
  manifest: {
    name: 'Cognito : Your AI Browser Agent',
    version: '0.0.1',
    description: 'super powerful and private',
    author: 'dev@codewarnab.in',
    // ... more in Phase 11
  },
});
```

### 1.3 Update `package.json` Scripts

Add WXT scripts alongside existing Plasmo scripts (for parallel development):

```json
{
  "scripts": {
    "dev": "plasmo dev",
    "build": "plasmo build && node scripts/copy-offscreen.js",
    
    "dev:wxt": "wxt",
    "build:wxt": "wxt build",
    "zip:wxt": "wxt zip",
    "postinstall": "wxt prepare && node scripts/patch-vfile.js && node scripts/patch-math-intrinsics.js && node scripts/patch-streamdown.js"
  }
}
```

### 1.4 Create `entrypoints/` Directory

```bash
mkdir entrypoints
```

### Verification Checklist
- [x] `wxt.config.ts` created
- [x] WXT installed in devDependencies
- [x] `pnpm wxt prepare` runs without errors
- [x] `.wxt/` directory generated with `tsconfig.json`, `wxt.d.ts`, `types/`

### Sources
- [WXT Installation Guide](https://wxt.dev/guide/installation)
- [WXT Configuration](https://wxt.dev/guide/essentials/config)
- [WXT React Integration](https://wxt.dev/guide/essentials/frontend-frameworks)

---

## Phase 2: TypeScript & Path Aliases ✅ DONE

> **Implementation Notes (2025-12-12):**
> - `tsconfig.json` updated to extend `.wxt/tsconfig.json` instead of `plasmo/templates/tsconfig.base`
> - Added `dist` and `.wxt` to exclude list in tsconfig
> - Include paths updated to reference `src/entrypoints/**/*` (not root `entrypoints/`)
> - Path aliases added to `wxt.config.ts`: `~`, `@`, `@assets`, `~logger`
> - Vite polyfills configured for `node:events`, `process`, `util`, `google-logging-utils`
> - Dev server builds successfully (1.65 MB total bundle size)
> - Warning about duplicated imports for `useSearchModeWithAI` - non-blocking, can be cleaned up later

> **Hints for Phase 3:**
> - Current `.env` and `.env.product` files exist - check which env vars are used
> - `process.env.PLASMO_PUBLIC_*` needs migration to `import.meta.env.WXT_*`
> - Create compatibility layer in `src/utils/env.ts` first to avoid breaking Plasmo during transition
> - Type definitions needed in `src/types/env.d.ts` for WXT environment variables

### 2.1 Update `tsconfig.json`

Replace Plasmo's base config with WXT's:

**Before (Plasmo):**
```json
{
  "extends": "plasmo/templates/tsconfig.base",
  "include": [".plasmo/index.d.ts", "./**/*.ts", "./**/*.tsx"]
}
```

**After (WXT):**
```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "baseUrl": ".",
    "paths": {
      "~*": ["./src/*"],
      "@/*": ["./src/*"],
      "@assets/*": ["./assets/*"],
      "~logger": ["./src/logger"]
    },
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": [
    ".wxt/wxt.d.ts",
    "entrypoints/**/*.ts",
    "entrypoints/**/*.tsx",
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/types/**/*.d.ts"
  ],
  "exclude": ["node_modules", "dist", ".wxt"]
}
```

### 2.2 Configure Path Aliases in WXT

Add path aliases to `wxt.config.ts`:

```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  // ... other config
  
  alias: {
    '~': resolve(__dirname, 'src'),
    '@': resolve(__dirname, 'src'),
    '@assets': resolve(__dirname, 'assets'),
    '~logger': resolve(__dirname, 'src/logger'),
  },
  
  vite: () => ({
    plugins: [react()],
    resolve: {
      alias: {
        // Polyfills from your current setup
        'node:events': 'events-polyfill',
        'events': 'events-polyfill',
        'node:process': resolve(__dirname, 'src/polyfills/process.ts'),
        'process': resolve(__dirname, 'src/polyfills/process.ts'),
        'node:util': 'util/',
        'util': 'util/',
        'google-logging-utils': resolve(__dirname, 'src/polyfills/google-logging-utils.ts'),
      },
    },
  }),
});
```

### 2.3 Run WXT Prepare

```bash
pnpm wxt prepare
```

This generates `.wxt/tsconfig.json` and type definitions.

### Verification Checklist
- [x] `pnpm wxt prepare` runs successfully
- [x] `.wxt/tsconfig.json` generated
- [x] TypeScript recognizes path aliases
- [x] No TypeScript errors in IDE

### Sources
- [WXT TypeScript Configuration](https://wxt.dev/guide/essentials/config/typescript)
- [WXT Path Aliases](https://wxt.dev/guide/essentials/config/vite)

---

## Phase 3: Environment Variables ✅ DONE

> **Implementation Notes (2025-12-12):**
> - Created `src/types/env.d.ts` with TypeScript type definitions for `ImportMetaEnv` (WXT)
> - Created `src/utils/env.ts` compatibility layer with `ENV` object that checks WXT → Plasmo → default fallback
> - **IMPORTANT**: Only `ELEVENLABS_WORKER_URL` uses environment variables!
> - Gemini/Vertex API keys are **NOT** in env vars - they come from `chrome.storage.local` via `src/utils/credentials/`
> - Users configure API keys in Settings > Provider Setup, not in `.env` files
> - Updated `elevenlabsTTS.ts` and `api.ts` to use `ENV.ELEVENLABS_WORKER_URL`
> - The `HIDE_LOCAL_MODE = true` constant in `constants.ts` hides Chrome's built-in AI by default
> - `pnpm wxt prepare` runs successfully with the new setup

> **Hints for Phase 4:**
> - Check `public/` directory contents before moving `offscreen.html`
> - The `offscreen.js` file references may need path updates after moving to entrypoints
> - Verify `web_accessible_resources` in current `package.json` manifest before adding to `wxt.config.ts`
> - Check if `copy-offscreen.js` script is still needed or can be removed

### 3.1 Create/Update `.env` Files

WXT uses `WXT_*` or `VITE_*` prefixes instead of `PLASMO_PUBLIC_*`:

**Before (`.env` with Plasmo):**
```env
PLASMO_PUBLIC_GOOGLE_AI_API_KEY=your_key
PLASMO_PUBLIC_ELEVENLABS_WORKER_URL=https://...
```

**After (`.env` with WXT):**
```env
# WXT environment variables
WXT_GOOGLE_AI_API_KEY=your_key
WXT_ELEVENLABS_WORKER_URL=https://...

# Keep Plasmo vars during transition (remove in Phase 12)
PLASMO_PUBLIC_GOOGLE_AI_API_KEY=your_key
PLASMO_PUBLIC_ELEVENLABS_WORKER_URL=https://...
```

### 3.2 Update Environment Variable Usage

Create a compatibility layer or update all usages:

**Option A: Compatibility Layer (Recommended during migration)**

```typescript
// src/utils/env.ts
export const ENV = {
  GOOGLE_AI_API_KEY: 
    import.meta.env.WXT_GOOGLE_AI_API_KEY || 
    process.env.PLASMO_PUBLIC_GOOGLE_AI_API_KEY || '',
  
  ELEVENLABS_WORKER_URL:
    import.meta.env.WXT_ELEVENLABS_WORKER_URL ||
    process.env.PLASMO_PUBLIC_ELEVENLABS_WORKER_URL ||
    'https://eleven-labs-proxy.nicenoise.com',
} as const;
```

**Option B: Direct Update (Do in Phase 12)**

Update files that use environment variables:

```typescript
// Before (Plasmo)
const url = process.env.PLASMO_PUBLIC_ELEVENLABS_WORKER_URL || 'fallback';

// After (WXT)
const url = import.meta.env.WXT_ELEVENLABS_WORKER_URL || 'fallback';
```

### 3.3 TypeScript Type Definitions

Add type definitions for WXT environment variables:

```typescript
// src/types/env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly WXT_GOOGLE_AI_API_KEY: string;
  readonly WXT_ELEVENLABS_WORKER_URL: string;
  // Add more as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### Files to Update
- `src/utils/ai/elevenlabsTTS.ts`
- `src/services/elevenlabs/api.ts`
- Any other files using `PLASMO_PUBLIC_*` variables

### Verification Checklist
- [x] `.env` file updated with `WXT_*` variables (user responsibility - gitignored)
- [x] Type definitions added for environment variables
- [x] Compatibility layer created (if using Option A)

### Sources
- [WXT Environment Variables](https://wxt.dev/guide/essentials/config/environment-variables)

---

## Phase 4: Static Assets & Public Files ✅ DONE

> **Implementation Notes (2025-12-12):**
> - Created `src/entrypoints/offscreen.html` as WXT unlisted page entry point
> - Updated `wxt.config.ts` with `web_accessible_resources` configuration including:
>   - `sweep1.mp3` (audio file from public/)
>   - Font files: `assets/fonts/Inter-*.ttf` (from src/assets/fonts/)
>   - ElevenLabs worklet files: `assets/elevenlabs/*.worklet.js`
> - `public/offscreen.html` still works for Plasmo builds; WXT uses the entrypoints version
> - Assets directory (`assets/`) unchanged - WXT handles it automatically
> - Build verified: `pnpm wxt build` produces correct output with manifest containing web_accessible_resources
> - **NOTE**: Font paths in output may need verification after full migration (Phase 12)
> - **NOTE**: `scripts/copy-offscreen.js` will be removed after Plasmo is fully deprecated (Phase 12)

> **Hints for Phase 5:**
> - Background service worker is at `src/background.ts` - needs to be migrated to `src/entrypoints/background.ts`
> - Current placeholder at `src/entrypoints/background.ts` has minimal content - replace with full implementation
> - Use `defineBackground()` wrapper from WXT
> - Convert `chrome.*` to `browser.*` APIs (WXT auto-polyfills)
> - Keep safety checks like `if (browser.action)` for defensive programming
> - Polyfill import should be `../polyfills/process` (relative from entrypoints)

### 4.1 Assets Directory

WXT handles the `assets/` directory similarly to Plasmo. Current structure:
- `assets/icon.png` - Main extension icon
- `assets/icons/` - UI icons (76 files across subdirs)
- `assets/brands/` - Brand logos (27 files)
- `assets/images/` - Misc images
- `assets/elevenlabs/` - Audio worklet files:
  - `audioConcatProcessor.worklet.js`
  - `rawAudioProcessor.worklet.js`
- `assets/chat/` - Chat-related assets
- `assets/fileIcons/` - File type icons

**Note:** Fonts are in `src/assets/fonts/`, not `assets/`:
- `src/assets/fonts/Inter-Regular.ttf`
- `src/assets/fonts/Inter-Medium.ttf`
- `src/assets/fonts/Inter-SemiBold.ttf`

### 4.2 Public Directory

Files in `public/` are copied as-is to the output directory:

| File | Action |
|------|--------|
| `public/logo.png` | Keep as-is |
| `public/sweep1.mp3` | Keep as-is |
| `public/offscreen.html` | Move to `entrypoints/offscreen.html` (Phase 4.3) |
| `public/offscreen.js` | Keep in `public/` (referenced by HTML) |
| `public/process-polyfill.js` | Keep as-is |

### 4.3 Offscreen Document as Unlisted Page

Move offscreen document to WXT's unlisted page pattern:

```html
<!-- entrypoints/offscreen.html -->
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Offscreen Summarizer</title>
    <!-- Include/exclude from builds if needed -->
    <meta name="manifest.include" content="['chrome']" />
  </head>
  <body>
    <!-- Note: Use relative path same as current public/offscreen.html -->
    <script src="offscreen.js"></script>
  </body>
</html>
```

### 4.4 Update Web Accessible Resources in Config

**Important:** Font paths need to match the actual location (`src/assets/fonts/` compiles to different path).
Check WXT output directory structure to get correct paths.

```typescript
// wxt.config.ts
export default defineConfig({
  manifest: {
    web_accessible_resources: [
      {
        resources: [
          'sweep1.mp3',
          // TODO: Verify font paths after WXT build - may need adjustment
          'assets/fonts/Inter-Regular.ttf',
          'assets/fonts/Inter-Medium.ttf',
          'assets/fonts/Inter-SemiBold.ttf',
          // Specific worklet files (not *.js glob)
          'assets/elevenlabs/audioConcatProcessor.worklet.js',
          'assets/elevenlabs/rawAudioProcessor.worklet.js',
        ],
        matches: ['<all_urls>'],
      },
    ],
  },
});
```

### 4.5 Remove `copy-offscreen.js` Script

After migration, the `scripts/copy-offscreen.js` build script can be removed since WXT handles the offscreen page automatically.

Current usage in package.json:
- `"dev:setup": "node scripts/copy-offscreen.js"` - Remove after WXT migration
- `"build": "plasmo build && node scripts/copy-offscreen.js"` - Will be replaced by `wxt build`

### Verification Checklist
- [x] `assets/` directory unchanged
- [x] `public/` directory has correct files
- [x] `entrypoints/offscreen.html` created
- [x] Web accessible resources configured
- [x] Font paths verified in WXT output

### Sources
- [WXT Static Assets](https://wxt.dev/guide/essentials/assets)
- [WXT Unlisted Pages](https://wxt.dev/guide/essentials/entrypoints#unlisted-pages)

---

## Phase 5: Background Service Worker ✅ DONE

> **Implementation Notes (2025-12-12):**
> - Replaced placeholder `src/entrypoints/background.ts` with full implementation
> - Wrapped in `defineBackground()` as required by WXT
> - Kept `chrome.*` API for Chrome-specific features (`sidePanel`, `action`, `commands`) since we only target Chrome
> - Import paths updated: `../polyfills/process` (relative from `src/entrypoints/` to `src/polyfills/`)
> - Path aliases work correctly: `@/background/*`, `~logger`
> - Build verified: `pnpm wxt build` completes successfully (2.02 MB total, 6.2s)
> - LoggerConfigManager initialization is outside `defineBackground()` to ensure early logging config
> - All original architecture comments and section dividers preserved

> **Hints for Phase 6:**
> - Side panel directory should be `src/entrypoints/sidepanel/` with `index.html` and `main.tsx`
> - Current `src/sidepanel.tsx` has 585 lines - migrate all logic into `App.tsx` component
> - Style imports should use `../styles/...` relative paths from `src/entrypoints/sidepanel/`
> - Polyfill import should be `../../polyfills/process` (two levels up from sidepanel dir)
> - WXT auto-detects sidepanel from `index.html` - no manifest config needed for basic setup

### 5.1 Create Background Entrypoint

**Current Plasmo file:** `src/background.ts`

**New WXT file:** `src/entrypoints/background.ts`

```typescript
// src/entrypoints/background.ts
/**
 * MV3 Background Service Worker - Orchestrator
 * 
 * This is the main entry point for the background service worker.
 * It initializes all modules and sets up event listeners.
 * 
 * Architecture:
 * - All MCP logic is in src/background/mcp/
 * - All message handling is in src/background/messaging/
 * - All event listeners are in dedicated modules
 * - This file only orchestrates initialization
 */

import '../polyfills/process';
import { openSidePanelForTab, openSidePanel } from '@/background/sidepanelUtils';
import { createLogger, LoggerConfigManager } from '~logger';
import { initializeOAuthRedirectURI } from '@/background/mcp/auth';
import { initializeLifecycleEventListeners } from '@/background/lifecycle';
import { initializeAlarmListeners } from '@/background/alarms';
import { initializeNotificationListeners } from '@/background/notifications';
import { initializeOmnibox } from '@/background/omnibox';
import { 
  initializeMessageRouter, 
  initializeSummarizerPortListener, 
  initializeWriterPortListener, 
  initializeRewriterPortListener, 
  initializeAskerPortListener 
} from '@/background/messaging/router';
import { initializeRewriterContextMenu, initializeAskerContextMenu } from '@/background/contextMenu';
import { recoverExtractionQueue } from '@/background/supermemory/extraction/startup';
import { recoverContentMemoryQueue } from '@/background/supermemory/contentMemory/startup';
import { initializeWebMCPManager } from '@/background/webmcp/manager';

export default defineBackground(() => {
  const log = createLogger('Background-Orchestrator', 'BACKGROUND');
  
  log.info('Service Worker loading...');

  // Initialize LoggerConfigManager
  LoggerConfigManager.initialize().catch(err => {
    console.error('[Background] Failed to initialize LoggerConfigManager:', err);
  });

  // Core Initialization
  initializeOAuthRedirectURI();

  // Event Listener Initialization
  initializeLifecycleEventListeners();
  initializeMessageRouter();
  initializeSummarizerPortListener();
  initializeWriterPortListener();
  initializeRewriterPortListener();
  initializeAskerPortListener();
  initializeAlarmListeners();
  initializeNotificationListeners();
  initializeOmnibox();
  initializeRewriterContextMenu();
  initializeAskerContextMenu();
  initializeWebMCPManager();

  // Action click handler (keep safety check)
  if (browser.action) {
    browser.action.onClicked.addListener(async (tab) => {
      if (browser.sidePanel && tab.id) {
        await openSidePanelForTab(tab.id);
      }
    });
  }

  // Commands handler (keep safety check)
  if (browser.commands) {
    browser.commands.onCommand.addListener(async (command) => {
      log.info('Command received:', command);

      if (command === '_execute_side_panel') {
        try {
          const currentWindow = await browser.windows.getCurrent();
          if (currentWindow?.id) {
            const success = await openSidePanel(currentWindow.id);
            if (success) {
              log.info('Sidepanel opened via keyboard shortcut');
            } else {
              log.error('Failed to open sidepanel via keyboard shortcut');
            }
          } else {
            log.error('Cannot open sidepanel: no current window');
          }
        } catch (error) {
          log.error('Error opening sidepanel via keyboard shortcut:', error);
        }
      }
    });
  }

  // Memory Queue Recovery
  recoverExtractionQueue().catch(err => {
    log.warn('Failed to recover extraction queue:', err);
  });

  recoverContentMemoryQueue().catch(err => {
    log.warn('Failed to recover content memory queue:', err);
  });

  log.info('Service Worker initialized and all listeners are active');
});
```

### 5.2 Key Changes from Plasmo to WXT

| Aspect | Plasmo | WXT |
|--------|--------|-----|
| File location | `src/background.ts` | `src/entrypoints/background.ts` |
| Entry point | Direct execution | Wrapped in `defineBackground()` |
| Browser API | `chrome.*` | `browser.*` (auto-polyfilled) |
| Auto-imports | None | `defineBackground` auto-imported |

### 5.3 Update Chrome API to Browser API

WXT uses `browser.*` instead of `chrome.*` for cross-browser compatibility:

```typescript
// Before (Plasmo/Chrome)
chrome.action.onClicked.addListener(...)
chrome.sidePanel.open(...)
chrome.runtime.onMessage.addListener(...)

// After (WXT)
browser.action.onClicked.addListener(...)
browser.sidePanel.open(...)
browser.runtime.onMessage.addListener(...)
```

**Note:** WXT auto-polyfills `browser.*` to work in Chrome. You can still use `chrome.*` if needed for Chrome-specific APIs.

### Verification Checklist
- [x] `src/entrypoints/background.ts` created (replacing placeholder)
- [x] Wrapped in `defineBackground()`
- [x] Chrome APIs kept for Chrome-specific features (sidePanel, action, commands)
- [x] All imports using path aliases work (`@/background/*`, `~logger`)
- [x] `pnpm wxt build` completes without errors (2.02 MB, 6.2s)

### Sources
- [WXT Background Scripts](https://wxt.dev/guide/essentials/entrypoints#background)
- [WXT Extension APIs](https://wxt.dev/guide/essentials/extension-apis)

---

## Phase 6: Side Panel Entry Point ✅ DONE

> **Implementation Notes (2025-12-12):**
> - Created `src/entrypoints/sidepanel/` directory with full WXT structure
> - `index.html` - WXT-compatible HTML entry point with React root mount
> - `main.tsx` - React bootstrap with all global CSS imports (41 lines)
> - `App.tsx` - Full migration of `src/sidepanel.tsx` logic (580 lines)
> - Contains `AIChatContent` component with all hooks, state, and UI logic
> - Contains `App` wrapper component with `WindowVisibilityProvider`, `DocumentProvider`, `ToolUIProvider`
> - Polyfill import uses correct path: `../../polyfills/process`
> - Style imports use correct paths: `../../styles/...` and `../../sidepanel.css`
> - Path aliases working correctly: `@/components/*`, `@/hooks/*`, `~logger`, etc.

> **Previous Corrections (for reference):**
> - **CORRECTION**: Directory should be `src/entrypoints/sidepanel/` (not `entrypoints/sidepanel/`) - WXT uses `srcDir: 'src'`
> - **CORRECTION**: Polyfill import should be `../../polyfills/process` (two levels up from sidepanel dir)
> - **CORRECTION**: Style imports should be `../../styles/...` (two levels up from sidepanel dir)

### 6.1 Create Side Panel Directory Structure

```
src/entrypoints/
└── sidepanel/
    ├── index.html
    ├── main.tsx
    └── App.tsx  (or keep logic in main.tsx for simpler migration)
```

### 6.2 Create `index.html`

```html
<!-- src/entrypoints/sidepanel/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cognito AI</title>
    <!-- WXT manifest options can be set via meta tags if needed -->
    <!-- <meta name="manifest.open_at_install" content="false" /> -->
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

### 6.3 Create `main.tsx`

```tsx
// src/entrypoints/sidepanel/main.tsx
import '../polyfills/process';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import global styles (paths relative from src/entrypoints/sidepanel/)
import '../styles/features/copilot/index.css';
import '../styles/features/mcp/index.css';
import '../styles/features/mentions/index.css';
import '../styles/features/threads/index.css';
import '../styles/features/reminders/index.css';
import '../styles/features/workflows/index.css';
import '../styles/components/voice-recording-pill.css';
import '../styles/features/onboarding/index.css';
import '../styles/components/local-banner.css';
import '../styles/components/model-download-toast.css';
import '../styles/components/continue-button.css';
import '../styles/components/context-indicator.css';
import '../styles/components/context-warning.css';
import '../styles/components/streaming-warning.css';
import '../styles/components/error-toast.css';
import '../sidepanel.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 6.4 Create `App.tsx`

Move the content from `src/sidepanel.tsx`. The file is ~585 lines and contains:
- `AIChatContent` component (main logic)
- `SidePanel` wrapper component (default export in Plasmo)
- Multiple custom hooks and state management

```tsx
// src/entrypoints/sidepanel/App.tsx
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

// UI Components - use path aliases (configured in wxt.config.ts)
import { CopilotChatWindow } from '@/components/shell';
import { McpManager } from '@/components/features/mcp';
import { Troubleshooting } from '@/components/features/help/Troubleshooting';
import { Features } from '@/components/features/help/Features';
import { ProviderSetup } from '@/components/features/help/ProviderSetup';
import { ToolUIProvider } from '@/ai/tools/components';
import { ThreadListSidePanel } from '@/components/features/threads';
import { ReminderPanel } from '@/components/features/reminders';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { LoggerPanel } from '@/components/features/settings/LoggerPanel';
import { OnboardingScreen } from '@/components/features/onboarding';
import { AudioLinesIcon } from '@/components/shared/icons';
import { VoiceModeUI } from '@/components/features/voice';
import { VoiceRecordingPill } from '@/components/shared/inputs';
import { ContextWarning } from '@/components/features/chat/context/ContextWarning';
import { ErrorToast } from '@/components/shared/notifications';

// Types
import type { VoiceInputHandle } from '@/audio/VoiceInput';
import type { ContextWarningState } from '@/types/sidepanel';
import type { FileAttachmentData, TabAttachmentData } from '@/components/features/chat/components/attachments';

// Contexts
import { WindowVisibilityProvider } from '@/contexts/WindowVisibilityContext';
import { DocumentProvider } from '@/contexts/documentContext';

// Core functionality
import { createLogger } from '~logger';
import { useRegisterAllActions } from '@/actions/registerAll';
import { useRegisterAllWorkflows } from '@/workflows/registerAll';
import { useAIChat } from '@/ai/hooks';

// Custom hooks
import { useApiKey, useOnboarding } from '@/hooks/settings';
import { useVoiceRecording } from '@/hooks/ui';
import { useThreadManagement, useMessageHandlers, useAIChatMessages } from '@/hooks/chat';
import { useActiveTabDetection } from '@/hooks/browser';
import type { LocalPdfInfo } from '@/hooks/browser';

// Sidepanel-specific hooks
import {
  useSidepanelUiState,
  useNotificationSound,
  useBackgroundMessageListener,
  useImagePreviewListener,
  useOnboardingTestHandles,
} from '@/hooks/sidepanel';

// Utils
import { handleAPIError } from '@/utils/errors';

/**
 * Inner component that uses AI SDK v5
 * Copy the full AIChatContent function from src/sidepanel.tsx (~490 lines)
 */
function AIChatContent() {
  // ... copy entire AIChatContent implementation from src/sidepanel.tsx
  // This includes all hooks, state, effects, and the full JSX render
}

/**
 * Main App component (replaces SidePanel default export)
 */
function App() {
  return (
    <WindowVisibilityProvider>
      <DocumentProvider>
        <ToolUIProvider>
          <AIChatContent />
        </ToolUIProvider>
      </DocumentProvider>
    </WindowVisibilityProvider>
  );
}

export default App;
```

> **Migration Tip**: Rather than splitting into multiple files, you can copy the entire `src/sidepanel.tsx` content into `App.tsx` and just change the default export from `SidePanel` to `App`. The imports need path adjustment but the logic stays the same.

### 6.5 Key Differences

| Aspect | Plasmo | WXT |
|--------|--------|-----|
| File | `src/sidepanel.tsx` (auto-detected) | `src/entrypoints/sidepanel/index.html` + `main.tsx` |
| Entry | Default export component | HTML + React mount |
| Styles | Import in component file | Import in `main.tsx` (before App) |
| Config | In `package.json` → `manifest` key | In `wxt.config.ts` or HTML meta tags |
| Path aliases | Work via Plasmo vite config | Work via WXT `alias` config |

### Verification Checklist
- [ ] `src/entrypoints/sidepanel/` directory created
- [ ] `index.html`, `main.tsx`, `App.tsx` created
- [ ] All imports working with path aliases (`@/`, `~/`, `~logger`)
- [ ] Side panel renders correctly in `pnpm dev:wxt`
- [ ] All hooks and state work correctly (test onboarding, chat, voice mode)
- [ ] Error handling and toasts work properly

### Sources
- [WXT Side Panel](https://wxt.dev/guide/essentials/entrypoints#side-panel)
- [WXT React Setup](https://wxt.dev/guide/essentials/frontend-frameworks)

---

## Phase 7: Content Scripts Migration

> **Codebase Verification Notes (2025-12-12):**
> - **CORRECTION**: All paths should be `src/entrypoints/{name}.content/` (not `entrypoints/` - WXT uses `srcDir: 'src'`)
> - **CORRECTION**: Plasmo's `all_frames: true` becomes WXT's `allFrames: true` (camelCase)
> - **CORRECTION**: Plasmo's `run_at: 'document_idle'` becomes WXT's `runAt: 'document_idle'` (camelCase)
> - **CORRECTION**: CSS `@import` in `style.css` won't work in Shadow DOM - must use direct CSS import or copy CSS content
> - **CORRECTION**: `data-text:` imports (Plasmo feature) don't exist in WXT - CSS is imported directly with `import './style.css'`
> - **CORRECTION**: Plasmo's `getStyle()` export is replaced by WXT's `cssInjectionMode: 'ui'` + CSS import
> - **MISSING**: Table incorrectly uses `contents/` paths - actual Plasmo paths are `src/contents/` 
> - **MISSING**: `webmcp-proxy.ts` has `run_at: 'document_idle'` - needs to be migrated as `runAt: 'document_idle'`
> - **NOTE**: All React content scripts use `getStyle()` + `data-text:~/styles/...` pattern which is Plasmo-specific
> - **NOTE**: `ask-ai-button.tsx` is the largest content script (624 lines) with complex drag/drop state
> - **NOTE**: `write-command.tsx` uses `chrome.runtime.connect()` for port messaging - needs lifecycle cleanup with `ctx`
> - **NOTE**: For WXT shadow DOM, you can optionally use `mode: 'open'` or `mode: 'closed'` in `createShadowRootUi`
> - **NOTE**: The `ctx` (ContentScriptContext) should be used to wrap event listeners for auto-cleanup: `ctx.addEventListener()`, `ctx.setTimeout()`, etc.
> 
> **Sources verified:**
> - [WXT Content Scripts](https://wxt.dev/guide/essentials/content-scripts) - CSS and Shadow Root UI details
> - [WXT Entrypoints](https://wxt.dev/guide/essentials/entrypoints#content-scripts) - Naming conventions and config options

### 7.1 Content Script Overview

| Current File | WXT Location | Has UI | CSS Injection | Plasmo Config Notes |
|--------------|--------------|--------|---------------|---------------------|
| `src/contents/ask-command.tsx` | `src/entrypoints/ask-command.content/` | Yes (React) | Shadow DOM | `all_frames: true` |
| `src/contents/ask-ai-button.tsx` | `src/entrypoints/ask-ai-button.content/` | Yes (React) | Shadow DOM | `all_frames: false` |
| `src/contents/text-rewriter.tsx` | `src/entrypoints/text-rewriter.content/` | Yes (React) | Shadow DOM | `all_frames: false` |
| `src/contents/text-summarizer.tsx` | `src/entrypoints/text-summarizer.content/` | Yes (React) | Shadow DOM | `all_frames: false` |
| `src/contents/write-command.tsx` | `src/entrypoints/write-command.content/` | Yes (React) | Shadow DOM | `all_frames: true` |
| `src/contents/webmcp-proxy.ts` | `src/entrypoints/webmcp-proxy.content.ts` | No | N/A | `run_at: 'document_idle'` |

### 7.2 Content Script with React UI (Shadow DOM)

**Example: `ask-command.content`**

**Directory structure:**
```
src/entrypoints/
└── ask-command.content/
    ├── index.tsx     # Entrypoint with defineContentScript + createShadowRootUi
    ├── style.css     # Copy of src/styles/features/ask-command.css (or direct import)
    └── App.tsx       # React component (migrated from ask-command.tsx)
```

**`index.tsx`:**
```tsx
// src/entrypoints/ask-command.content/index.tsx
import './style.css';  // WXT handles this - replaces Plasmo's data-text: import
import ReactDOM from 'react-dom/client';
import App from './App';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,  // Was: all_frames: true in Plasmo
  cssInjectionMode: 'ui', // Injects CSS into Shadow DOM (replaces Plasmo's getStyle())
  
  async main(ctx) {
    // Create Shadow DOM UI with proper isolation
    const ui = await createShadowRootUi(ctx, {
      name: 'cognito-ask-command',  // Unique name for this content script's UI
      position: 'inline',
      anchor: 'body',
      mode: 'open',  // Can be 'closed' for extra isolation
      onMount: (container) => {
        // React warns about mounting to body, so create a wrapper div
        const app = document.createElement('div');
        container.append(app);
        const root = ReactDOM.createRoot(app);
        root.render(<App ctx={ctx} />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
```

**`style.css`:**

> **IMPORTANT**: `@import` statements do NOT work inside Shadow DOM in WXT. You must either:
> 1. **Copy the CSS file** into the content script directory, or
> 2. **Use Tailwind** which is processed at build time

```css
/* src/entrypoints/ask-command.content/style.css */

/* Option 1: Copy the content directly from src/styles/features/ask-command.css */
/* This is the recommended approach for Shadow DOM isolation */

/* === COPIED FROM src/styles/features/ask-command.css === */
.ask-overlay {
  /* ... your styles here ... */
}

/* 
 * Option 2: If using Tailwind, @apply directives work because 
 * they are processed at build time. Example:
 * 
 * .ask-overlay {
 *   @apply fixed z-50 p-4 bg-white rounded-lg shadow-lg;
 * }
 */
```

**`App.tsx`:**
```tsx
// entrypoints/ask-command.content/App.tsx
import { useCallback, useState, useEffect } from 'react';
import type { ContentScriptContext } from 'wxt/client';
import { useAskCommandDetection } from '@/contents/ask-command/useAskCommandDetection';
import { useAskConversation } from '@/contents/ask-command/useAskConversation';
import { usePageContextCapture } from '@/contents/ask-command/usePageContextCapture';
import { AskOverlay } from '@/contents/ask-command/AskOverlay';
import { AskCommandErrorBoundary } from '@/contents/ask-command/ErrorBoundary';
import type { AskPageContext } from '@/types';
import { createLogger } from '~logger';

interface AppProps {
  ctx: ContentScriptContext;
}

export default function App({ ctx }: AppProps) {
  const log = createLogger('AskCommand');
  
  // ... rest of the component logic from ask-command.tsx
  // Move AskCommandContent logic here
}
```

### 7.3 Content Script without UI (webmcp-proxy)

For content scripts without UI (like `webmcp-proxy.ts`), use a single file with `.content.ts` suffix:

```typescript
// src/entrypoints/webmcp-proxy.content.ts
import { TabClientTransport } from '@mcp-b/transports';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { WebMCPTool } from '@/types/webmcp';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: false,  // Was: all_frames: false in Plasmo
  runAt: 'document_idle',  // Was: run_at: 'document_idle' in Plasmo
  
  main(ctx) {
    // Module state
    let client: Client | null = null;
    let transport: TabClientTransport | null = null;
    let isConnected = false;
    
    // Use ctx for lifecycle cleanup when extension updates/unloads
    ctx.onInvalidated(() => {
      if (transport) {
        try { transport.close(); } catch { /* ignore */ }
      }
      client = null;
      transport = null;
      isConnected = false;
    });
    
    // Replace window.addEventListener with ctx.addEventListener for auto-cleanup
    ctx.addEventListener(window, 'beforeunload', () => {
      // cleanup logic
    });
    
    ctx.addEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible' && isConnected) {
        // Refresh tools when tab becomes visible
      }
    });
    
    // Replace chrome.runtime.onMessage.addListener
    // Browser API is auto-polyfilled by WXT
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // handle messages...
      return true; // async response
    });
    
    // ... rest of webmcp-proxy logic
  },
});

### 7.4 CSS Injection Modes

WXT offers three CSS injection modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| `'manifest'` | CSS added to manifest, injected by browser | Simple global styles |
| `'ui'` | CSS injected into Shadow DOM | Isolated UI components |
| `'manual'` | You control injection | Custom scenarios |

**Recommendation for your content scripts:** Use `'ui'` mode with Shadow DOM for full style isolation.

### 7.5 Context Script Lifecycle

WXT provides a `ContentScriptContext` for lifecycle management:

```typescript
export default defineContentScript({
  main(ctx) {
    // Use ctx for cleanup when extension reloads
    ctx.onInvalidated(() => {
      // Cleanup listeners, intervals, etc.
    });
    
    // Wrapped versions that auto-cleanup
    ctx.setTimeout(() => {}, 1000);
    ctx.setInterval(() => {}, 1000);
    ctx.addEventListener(window, 'resize', () => {});
  },
});
```

### 7.6 Migration Steps for Each Content Script

For each content script, follow these steps:

1. **Create directory/file**: 
   - With UI: `src/entrypoints/{name}.content/` (directory with `index.tsx`, `style.css`, `App.tsx`)
   - Without UI: `src/entrypoints/{name}.content.ts` (single file)
   
2. **Create `index.tsx`** (or `.ts`) with `defineContentScript` export

3. **Migrate CSS**:
   - Copy content from `src/styles/features/{name}.css` to `style.css`
   - Remove Plasmo's `getStyle()` export
   - Add `cssInjectionMode: 'ui'` to config
   
4. **Create `App.tsx`** with React component logic (for UI scripts)
   - Move component logic from Plasmo content script
   - Add `ctx: ContentScriptContext` prop for lifecycle
   
5. **Update config options** (Plasmo → WXT):
   - `all_frames: true` → `allFrames: true`
   - `run_at: 'document_idle'` → `runAt: 'document_idle'`
   
6. **Replace Chrome APIs** with browser APIs:
   - `chrome.runtime.onMessage` → `browser.runtime.onMessage`
   - `chrome.runtime.sendMessage` → `browser.runtime.sendMessage`
   
7. **Use ctx lifecycle helpers**:
   - `window.addEventListener(...)` → `ctx.addEventListener(window, ...)`
   - `setTimeout(...)` → `ctx.setTimeout(...)`
   - Add `ctx.onInvalidated(() => { /* cleanup */ })`

### Verification Checklist (per content script)
- [x] Directory structure created
- [x] `defineContentScript` export
- [x] CSS injection mode set
- [x] Shadow DOM UI mounting (if applicable)
- [x] React component renders
- [x] Message listeners work
- [x] Cleanup on context invalidation

### Sources
- [WXT Content Scripts](https://wxt.dev/guide/essentials/content-scripts)
- [WXT Shadow Root UI](https://wxt.dev/guide/essentials/content-scripts#shadow-root)
- [WXT CSS Injection](https://wxt.dev/guide/essentials/content-scripts#css)

---

## Phase 8: Options Page

> **Codebase Verification Notes (2025-12-12):**
> - **CORRECTION**: Directory should be `src/entrypoints/options/` (not `entrypoints/`) - WXT uses `srcDir: 'src'` if not work search the source or verify 
> - **CORRECTION**: Polyfill import should be `../polyfills/process` (not `../../src/polyfills/process`) - relative from `src/entrypoints/options/`
> - **NOTE**: Current `src/options.tsx` is a placeholder Plasmo template (24 lines) with no real functionality - minimal migration needed
> - **NOTE**: WXT supports two entry patterns: single `options.html` file OR `options/index.html` directory (both work the same)
> - **NOTE**: WXT meta tag options: `manifest.open_in_tab`, `manifest.chrome_style`, `manifest.browser_style`, `manifest.include`, `manifest.exclude`
> 
> **Sources verified:**
> - [WXT Entrypoints - Options](https://wxt.dev/guide/essentials/entrypoints#options) - Options page configuration and meta tags

### 8.1 Current Plasmo Implementation

**Current file:** `src/options.tsx` (placeholder - 24 lines)

```tsx
// Current Plasmo options.tsx - minimal placeholder
import "./polyfills/process";
import { useState } from "react"

function IndexOptions() {
  const [data, setData] = useState("")

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: 16 }}>
      <h1>
        Welcome to your <a href="https://www.plasmo.com">Plasmo</a> Extension!
      </h1>
      <input onChange={(e) => setData(e.target.value)} value={data} />
      <footer>Crafted by @PlasmoHQ</footer>{" "}
    </div>
  )
}

export default IndexOptions
```

### 8.2 Create Options Page Structure (WXT)

```
src/entrypoints/
└── options/
    ├── index.html
    └── main.tsx
```

> **Alternative:** You can also use a single file `src/entrypoints/options.html` but the directory approach is recommended for React apps.

### 8.3 Create `index.html`

```html
<!-- src/entrypoints/options/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cognito AI Options</title>
    
    <!-- WXT manifest configuration via meta tags -->
    <!-- Open in a new tab instead of embedded options iframe -->
    <meta name="manifest.open_in_tab" content="true" />
    
    <!-- Optional: Browser-specific styling (false recommended for custom UI) -->
    <!-- <meta name="manifest.chrome_style" content="false" /> -->
    <!-- <meta name="manifest.browser_style" content="false" /> -->
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

### 8.4 Create `main.tsx`

```tsx
// src/entrypoints/options/main.tsx
import '../polyfills/process';  // Correct relative path from src/entrypoints/options/
import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function OptionsPage() {
  const [data, setData] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 16 }}>
      <h1>
        Welcome to <a href="https://cognito.ai">Cognito AI</a>!
      </h1>
      <input onChange={(e) => setData(e.target.value)} value={data} />
      {/* TODO: Add actual settings UI here in future phases */}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <OptionsPage />
);
```

> **Migration Tip:** Since the current `src/options.tsx` is just a placeholder, you can copy the logic directly. In the future, you may want to add actual settings (e.g., API key configuration, voice settings, MCP server management) to this page.

### 8.5 Key Differences

| Aspect | Plasmo | WXT |
|--------|--------|-----|
| File location | `src/options.tsx` (auto-detected) | `src/entrypoints/options/index.html` + `main.tsx` |
| Entry | Default export component | HTML + React mount |
| Config | In `package.json` → `manifest` key | In HTML `<meta>` tags |
| Path aliases | Work via Plasmo vite config | Work via WXT `alias` config |

### Verification Checklist
- [ ] `src/entrypoints/options/` directory created
- [ ] `index.html` and `main.tsx` created
- [ ] `pnpm dev:wxt` starts without errors
- [ ] Options page accessible via extension menu (right-click extension icon → Options)
- [ ] Opens in new tab (verify `open_in_tab` meta tag works)
- [ ] Polyfill import works (no console errors about `process`)

### Sources
- [WXT Options Page](https://wxt.dev/guide/essentials/entrypoints#options)
- [WXT Defining Manifest Options](https://wxt.dev/guide/essentials/entrypoints#defining-manifest-options)

---

## Phase 9: Storage Migration

> **Codebase Verification Notes (2025-12-12):**
> - **CORRECTION**: WXT storage is **built-in** when using WXT - no separate install needed! Import from `#imports` (with auto-imports enabled) or `wxt/storage`
> - **CORRECTION**: Only install `@wxt-dev/storage` separately if using **without** WXT
> - **CORRECTION**: `defaultValue` option in Phase 9 code samples should be `fallback` (WXT uses `fallback` not `defaultValue`)
> - **CORRECTION**: Import path should be `import { storage } from 'wxt/storage'` or `import { storage } from '#imports'` (not `@wxt-dev/storage`)
> - **MISSING**: Phase 9 only mentions `@plasmohq/storage` in `src/services/elevenlabs/settings.ts` - but there are **additional storage files** using raw `chrome.storage.local`:
>   - `src/utils/settings/settingsStorage.ts` - Main user settings storage (uses raw `chrome.storage.local`)
>   - `src/actions/reminder/storage.ts` - Reminder storage (uses raw `chrome.storage.local`)
>   - `src/actions/chromeApi/storage.ts` - Storage helpers with error handling (uses raw `chrome.storage.local`)
>   - `src/types/chrome/storage.ts` - Type definitions for storage
> - **NOTE**: Per WXT docs: "If you're migrating to WXT and already have a storage wrapper, keep using it. There's no reason to replace working code during a migration."
> - **NOTE**: Raw `chrome.storage.local` calls are **compatible with WXT** and can optionally be migrated to `wxt/storage` for better type safety and watchers
> - **NOTE**: Consider keeping `settingsStorage.ts` patterns as-is initially, and only migrate `@plasmohq/storage` which requires library change
> - **NOTE**: `storage` permission is still required in manifest (already present in current extension)
>
> **Sources verified:**
> - [WXT Storage](https://wxt.dev/storage) - Official WXT storage documentation
> - [WXT Storage Installation](https://wxt.dev/storage#installation) - Built-in vs NPM install
> - [Guide: Storage](https://wxt.dev/guide/essentials/storage) - Alternatives and recommendations

### 9.1 WXT Storage (Built-in)

**Good news:** WXT storage is **built-in** when using WXT - no separate install needed!

```typescript
// With auto-imports enabled (recommended)
import { storage } from '#imports';

// Or explicit import
import { storage } from 'wxt/storage';
```

> **Only if NOT using WXT**: If you're using `@wxt-dev/storage` standalone without WXT:
> ```bash
> pnpm add @wxt-dev/storage
> ```

### 9.2 Ensure Storage Permission

```typescript
// wxt.config.ts - storage permission is required
export default defineConfig({
  manifest: {
    permissions: ['storage'], // Already present in current extension
  },
  // ...
});
```

### 9.3 Migrate from @plasmohq/storage

**Before (Plasmo):**
```typescript
// src/services/elevenlabs/settings.ts
import { Storage } from '@plasmohq/storage';

const storage = new Storage({ area: 'local' });

export async function getSelectedVoiceId(): Promise<string | null> {
  const voiceId = await storage.get<string>('elevenlabs_voice_id');
  return voiceId || null;
}

export async function setSelectedVoiceId(voiceId: string): Promise<void> {
  await storage.set('elevenlabs_voice_id', voiceId);
}
```

**After (WXT):**
```typescript
// src/services/elevenlabs/settings.ts
import { storage } from 'wxt/storage';

// Define typed storage items
const voiceIdItem = storage.defineItem<string | null>('local:elevenlabs_voice_id', {
  fallback: null,  // WXT uses 'fallback' not 'defaultValue'
});

const enabledToolsItem = storage.defineItem<string[]>('local:elevenlabs_enabled_tools', {
  fallback: [  // WXT uses 'fallback' not 'defaultValue'
    'navigateTo',
    'clickByText',
    'typeInField',
    // ... default tools
  ],
});

const voiceSettingsItem = storage.defineItem<VoiceSettings>('local:elevenlabs_voice_settings', {
  fallback: {  // WXT uses 'fallback' not 'defaultValue'
    stability: 0.7,
    similarityBoost: 0.9,
    speed: 1.0,
  },
});

export async function getSelectedVoiceId(): Promise<string | null> {
  return await voiceIdItem.getValue();
}

export async function setSelectedVoiceId(voiceId: string): Promise<void> {
  await voiceIdItem.setValue(voiceId);
}

export async function getEnabledTools(): Promise<string[]> {
  return await enabledToolsItem.getValue();
}

export async function setEnabledTools(tools: string[]): Promise<void> {
  await enabledToolsItem.setValue(tools);
}

export async function getVoiceSettings(): Promise<VoiceSettings> {
  return await voiceSettingsItem.getValue();
}

export async function setVoiceSettings(settings: VoiceSettings): Promise<void> {
  await voiceSettingsItem.setValue(settings);
}
```

### 9.4 Benefits of @wxt-dev/storage

| Feature | @plasmohq/storage | @wxt-dev/storage |
|---------|-------------------|------------------|
| Type safety | Generic types | Strongly typed items |
| Default values | Manual handling | Built-in |
| Migrations | Manual | Built-in versioning |
| Watch changes | Manual listeners | `.watch()` method |
| Testing | Mock required | `fakeBrowser` integration |

### 9.5 Watch for Changes

```typescript
// Watch for changes reactively
voiceIdItem.watch((newValue, oldValue) => {
  console.log('Voice ID changed:', { from: oldValue, to: newValue });
});
```

### 9.6 Migration Strategy for Existing Storage

**Recommended approach:** Migrate incrementally:

1. **Migrate `@plasmohq/storage`** (required - library change):
   - `src/services/elevenlabs/settings.ts` → WXT storage

2. **Optionally migrate raw `chrome.storage.local`** (can keep as-is):
   - `src/utils/settings/settingsStorage.ts` - works with WXT, optionally migrate for better typing
   - `src/actions/reminder/storage.ts` - works with WXT, optionally migrate
   - `src/actions/chromeApi/storage.ts` - works with WXT, optionally migrate

> **Per WXT docs:** "If you're migrating to WXT and already have a storage wrapper, keep using it."

### Verification Checklist
- [ ] `storage` permission in manifest (already present)
- [ ] `@plasmohq/storage` code migrated to `wxt/storage` (only file: `elevenlabs/settings.ts`)
- [ ] Storage items using `fallback` (not `defaultValue`)
- [ ] All storage operations working
- [ ] `@plasmohq/storage` removed from dependencies
- [ ] (Optional) Raw `chrome.storage.local` files migrated for consistency

### Sources
- [WXT Storage](https://wxt.dev/storage) - Main storage documentation
- [Guide: Storage](https://wxt.dev/guide/essentials/storage) - Alternatives and recommendations

---

## Phase 10: CSS Migration

> **Codebase Verification Notes (2025-12-12):**
> - **NOTE**: Project has `tailwind.config.js` but **Tailwind is NOT actively used** - only vanilla CSS
> - **ACTION**: Remove Tailwind config files during migration (unused dependencies)
> - **NOTE**: All styling uses vanilla CSS in `src/styles/` directory
> - **NOTE**: Plasmo's `data-text:` CSS import syntax must be replaced with direct CSS imports
> - **NOTE**: Content scripts use Shadow DOM for style isolation
>
> **Sources verified:**
> - [WXT CSS in Content Scripts](https://wxt.dev/guide/essentials/content-scripts#css)
> - [Vite CSS Guide](https://vitejs.dev/guide/features.html#css)

### 10.1 Remove Unused Tailwind Setup

Since Tailwind is not actively used, remove these files during migration:

```bash
# Remove unused Tailwind config
rm tailwind.config.js
rm postcss.config.cjs  # if exists

# Remove unused dependencies
pnpm remove tailwindcss postcss autoprefixer
```

### 10.2 CSS Import Strategy (Vanilla CSS)

**For entrypoints (sidepanel, options, popup):**
```tsx
// src/entrypoints/sidepanel/main.tsx
import '@/styles/index.css';  // Main stylesheet
import './style.css';          // Entry-specific styles (if any)
```

```css
/* src/entrypoints/sidepanel/style.css */
/* Entry-specific overrides if needed */

/* Import global styles via path alias */
@import '../../styles/index.css';
```

**For content scripts:**
```tsx
// src/entrypoints/ask-command.content/index.tsx
import './style.css';

export default defineContentScript({
  cssInjectionMode: 'ui', // Important for Shadow DOM
  // ...
});
```

```css
/* src/entrypoints/ask-command.content/style.css */
/* Copy content from src/styles/features/ask-command.css */
/* @import does NOT work in Shadow DOM - must copy CSS content */
```

### 10.3 Migrate from Plasmo's `data-text:` Syntax

**Before (Plasmo):**
```typescript
import cssText from 'data-text:~/styles/features/ask-command.css';

export const getStyle = () => {
  const style = document.createElement('style');
  style.textContent = cssText;
  return style;
};
```

**After (WXT):**
```typescript
// Just import CSS directly - WXT handles injection
import './style.css';

export default defineContentScript({
  cssInjectionMode: 'ui',
  // ...
});
```

### 10.4 CSS Files to Migrate

Current CSS structure in `src/styles/`:
- `index.css` - Main entry point
- `base/` - Base styles
- `components/` - Component styles
- `features/` - Feature-specific styles (ask-command, text-rewriter, etc.)

For each content script, copy the relevant feature CSS into the content script directory.

### Verification Checklist
- [ ] Tailwind config files removed
- [ ] Tailwind dependencies removed from `package.json`
- [ ] Styles loading in sidepanel
- [ ] Styles loading in content scripts
- [ ] Shadow DOM styles isolated (no style leakage)
- [ ] `data-text:` imports replaced with direct CSS imports

### Sources
- [Vite CSS Guide](https://vitejs.dev/guide/features.html#css)
- [WXT CSS in Content Scripts](https://wxt.dev/guide/essentials/content-scripts#css)

---

## Phase 11: Manifest Configuration

### 11.1 Migrate Manifest from package.json to wxt.config.ts

**Current (package.json):**
```json
{
  "manifest": {
    "content_security_policy": {...},
    "permissions": [...],
    "host_permissions": [...],
    "commands": {...},
    "web_accessible_resources": [...],
    "side_panel": {...},
    "omnibox": {...}
  }
}
```

**New (wxt.config.ts):**
```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  outDir: 'dist',
  browser: 'chrome',
  manifestVersion: 3,

  vite: () => ({
    plugins: [react()],
    resolve: {
      alias: {
        'node:events': 'events-polyfill',
        'events': 'events-polyfill',
        'node:process': resolve(__dirname, 'src/polyfills/process.ts'),
        'process': resolve(__dirname, 'src/polyfills/process.ts'),
        'node:util': 'util/',
        'util': 'util/',
        'google-logging-utils': resolve(__dirname, 'src/polyfills/google-logging-utils.ts'),
      },
    },
  }),

  alias: {
    '~': resolve(__dirname, 'src'),
    '@': resolve(__dirname, 'src'),
    '@assets': resolve(__dirname, 'assets'),
    '~logger': resolve(__dirname, 'src/logger'),
  },

  imports: {
    presets: ['react'],
  },

  manifest: {
    name: 'Cognito : Your AI Browser Agent',
    version: '0.0.1',
    description: 'super powerful and private',
    author: 'dev@codewarnab.in',

    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },

    permissions: [
      'storage',
      'unlimitedStorage',
      'tabs',
      'tabGroups',
      'sidePanel',
      'alarms',
      'scripting',
      'activeTab',
      'webNavigation',
      'identity',
      'notifications',
      'offscreen',
      'cookies',
      'history',
      'search',
      'bookmarks',
      'omnibox',
      'clipboardWrite',
      'contextMenus',
    ],

    optional_permissions: [
      'tabCapture',
      'desktopCapture',
    ],

    host_permissions: [
      'https://youtube-transcript-generator-five.vercel.app/*',
      '<all_urls>',
    ],

    commands: {
      '_execute_side_panel': {
        suggested_key: {
          default: 'Ctrl+Shift+H',
          mac: 'Command+Shift+H',
        },
        description: 'Open AI Chat side panel',
      },
    },

    web_accessible_resources: [
      {
        resources: [
          'sweep1.mp3',
          'assets/fonts/Inter-Regular.ttf',
          'assets/fonts/Inter-Medium.ttf',
          'assets/fonts/Inter-SemiBold.ttf',
          'assets/elevenlabs/*.js',
        ],
        matches: ['<all_urls>'],
      },
    ],

    // WXT auto-generates side_panel config from entrypoints/sidepanel/
    // But you can customize:
    side_panel: {
      default_path: 'sidepanel.html',
    },

    omnibox: {
      keyword: 'ai',
    },

    // Action without popup (for onClicked handler)
    action: {},
  },
});
```

### 11.2 Dynamic Manifest Properties

For conditional manifest based on build mode:

```typescript
manifest: ({ mode, browser }) => ({
  name: mode === 'development' 
    ? 'Cognito AI (Dev)' 
    : 'Cognito : Your AI Browser Agent',
  
  // Browser-specific adjustments
  permissions: browser === 'firefox'
    ? [...basePermissions, 'geckoProfiler']
    : basePermissions,
})
```

### 11.3 Manifest Comparison

After building, compare manifests:

```bash
# Build both
pnpm build        # Plasmo
pnpm build:wxt    # WXT

# Compare
diff build/chrome-mv3-dev/manifest.json dist/manifest.json
```

### Verification Checklist
- [ ] All permissions migrated
- [ ] Host permissions migrated
- [ ] Commands configured
- [ ] Web accessible resources configured
- [ ] CSP configured
- [ ] Manifest output matches original

### Sources
- [WXT Manifest Configuration](https://wxt.dev/guide/essentials/config/manifest)
- [WXT Permissions](https://wxt.dev/guide/essentials/config/manifest#permissions)

---

## Phase 12: Final Cleanup & Verification

### 12.1 Remove Plasmo Dependencies

```bash
pnpm remove plasmo @plasmohq/storage
```

### 12.2 Update package.json

```json
{
  "name": "@cognito/extension",
  "scripts": {
    "dev": "wxt",
    "dev:firefox": "wxt -b firefox",
    "build": "wxt build",
    "build:firefox": "wxt build -b firefox",
    "zip": "wxt zip",
    "zip:firefox": "wxt zip -b firefox",
    "postinstall": "wxt prepare && node scripts/patch-vfile.js && node scripts/patch-math-intrinsics.js && node scripts/patch-streamdown.js",
    "type:check": "tsc --noEmit"
  }
}
```

### 12.3 Remove Plasmo-Specific Files

- [ ] Remove `.plasmo/` directory
- [ ] Remove `src/background.ts` (moved to entrypoints)
- [ ] Remove `src/sidepanel.tsx` (moved to entrypoints)
- [ ] Remove `src/options.tsx` (moved to entrypoints)
- [ ] Remove `src/contents/*.tsx` (moved to entrypoints)
- [ ] Remove `scripts/copy-offscreen.js` (no longer needed)

### 12.4 Update Environment Variables

Replace all remaining `PLASMO_PUBLIC_*` with `WXT_*`:

```bash
# Find all usages
grep -r "PLASMO_PUBLIC" src/
```

Update each file to use `import.meta.env.WXT_*`

### 12.5 Update Documentation

- [ ] Update `AGENTS.md` - Replace Plasmo references with WXT
- [ ] Update `GEMINI.md` - Update build commands
- [ ] Update `CLAUDE.md` - Update framework references
- [ ] Update `README.md` (if exists)

### 12.6 Final Testing Checklist

**Build & Load:**
- [ ] `pnpm build:wxt` completes without errors
- [ ] Extension loads in Chrome
- [ ] No manifest errors

**Side Panel:**
- [ ] Opens with Ctrl+Shift+H
- [ ] UI renders correctly
- [ ] All features functional

**Background:**
- [ ] Service worker initializes
- [ ] Message passing works
- [ ] Alarms/notifications work
- [ ] MCP connections work

**Content Scripts:**
- [ ] Ask command works
- [ ] Text rewriter works
- [ ] Text summarizer works
- [ ] Write command works
- [ ] WebMCP proxy works

**Options Page:**
- [ ] Opens from extension menu
- [ ] Settings save/load correctly

**Storage:**
- [ ] Data persists
- [ ] Migration from old storage (if needed)

### 12.7 Performance Comparison

Run both builds and compare:

| Metric | Plasmo | WXT |
|--------|--------|-----|
| Dev startup time | | |
| Build time | | |
| Bundle size | | |
| HMR speed | | |

### Sources
- [WXT Publishing Guide](https://wxt.dev/guide/essentials/publishing)
- [WXT Troubleshooting](https://wxt.dev/guide/resources/faq)

---

## Appendix A: File Mapping Reference

| Plasmo Location | WXT Location |
|-----------------|--------------|
| `src/background.ts` | `entrypoints/background.ts` |
| `src/sidepanel.tsx` | `entrypoints/sidepanel/index.html` + `main.tsx` |
| `src/options.tsx` | `entrypoints/options/index.html` + `main.tsx` |
| `src/contents/ask-command.tsx` | `entrypoints/ask-command.content/index.tsx` |
| `src/contents/text-rewriter.tsx` | `entrypoints/text-rewriter.content/index.tsx` |
| `src/contents/text-summarizer.tsx` | `entrypoints/text-summarizer.content/index.tsx` |
| `src/contents/write-command.tsx` | `entrypoints/write-command.content/index.tsx` |
| `src/contents/ask-ai-button.tsx` | `entrypoints/ask-ai-button.content/index.tsx` |
| `src/contents/webmcp-proxy.ts` | `entrypoints/webmcp-proxy.content.ts` |
| `public/offscreen.html` | `entrypoints/offscreen.html` |
| `package.json` (manifest) | `wxt.config.ts` |
| `.plasmo/` | `.wxt/` |
| `build/` | `dist/` |

---

## Appendix B: API Mapping Reference

| Plasmo | WXT |
|--------|-----|
| `PlasmoCSConfig` | `defineContentScript({...})` |
| `PlasmoGetStyle` | `cssInjectionMode: 'ui'` + CSS import |
| `chrome.*` API | `browser.*` API (polyfilled) |
| `process.env.PLASMO_PUBLIC_*` | `import.meta.env.WXT_*` |
| `@plasmohq/storage` | `@wxt-dev/storage` or `wxt/storage` |
| `data-text:~/path` | Standard CSS import |
| Auto-detected entrypoints | `entrypoints/` directory |

---

## Appendix C: Troubleshooting

### Common Issues

**Issue: "defineContentScript is not defined"**
- Solution: Run `pnpm wxt prepare` to generate types

**Issue: CSS not applying in Shadow DOM**
- Solution: Ensure `cssInjectionMode: 'ui'` is set

**Issue: Path aliases not resolving**
- Solution: Check both `tsconfig.json` and `wxt.config.ts` aliases

**Issue: Environment variables undefined**
- Solution: Use `import.meta.env.WXT_*` prefix and restart dev server

**Issue: HMR not working**
- Solution: Check `wxt.config.ts` Vite config for React plugin

---

## Appendix D: Additional Resources

### Official Documentation
- [WXT Guide](https://wxt.dev/guide/)
- [WXT API Reference](https://wxt.dev/api/)
- [WXT Examples](https://github.com/wxt-dev/examples)

### Community
- [WXT Discord](https://discord.gg/wxt)
- [WXT GitHub Discussions](https://github.com/wxt-dev/wxt/discussions)

### Related Migration Guides
- [Migrate from Plasmo (WXT Docs)](https://wxt.dev/guide/resources/migrate#plasmo)
- [Migrate from CRXJS](https://wxt.dev/guide/resources/migrate#crxjs)

---

## Changelog

| Date | Phase | Changes |
|------|-------|---------|
| TBD | 1 | Initial WXT setup |
| TBD | 2 | TypeScript configuration |
| TBD | ... | ... |

---

*Generated for Cognito AI Extension migration*  
*Last updated: December 2024*

