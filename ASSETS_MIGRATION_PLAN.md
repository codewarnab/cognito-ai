# Assets Folder Migration Plan

## Executive Summary
This plan reorganizes the `/assets` folder into a logical folder-based structure and updates the TypeScript path aliases to use `~assets/*` for cleaner imports across the project.

---

## Current State Analysis

### Current Assets Structure
```
assets/
├── chat/               (33 icon files)
├── fileIcons/          (26 icon files)
├── *.tsx               (28 component icon files)
├── *.png               (5 image files)
├── *.webp              (3 image files)
└── *.svg               (1 svg file)
```

### Current Import Patterns
- **Relative imports**: `../../assets/`, `../../../../../assets/`
- **Partial alias usage**: Some files use `~assets/` (3 instances)
- **Inconsistent patterns**: Mix of relative and alias paths
- **84 files** import from assets folder

### Current tsconfig.json
```json
{
  "baseUrl": ".",
  "paths": {
    "~*": ["./src/*"]
  }
}
```

---

## Proposed New Structure

### Target Folder Organization
```
assets/
├── brands/              # Third-party service/company logos
│   ├── integrations/    # MCP integration logos
│   │   ├── Ahrefs.tsx
│   │   ├── Asana.tsx
│   │   ├── Astro.tsx
│   │   ├── Atlassian.tsx
│   │   ├── Canva.tsx
│   │   ├── Figma.tsx
│   │   ├── GitHub.tsx
│   │   ├── HuggingFace.tsx
│   │   ├── Linear.tsx
│   │   ├── Netlify.tsx
│   │   ├── Notion.tsx
│   │   ├── PayPal.tsx
│   │   ├── Sentry.tsx
│   │   ├── Stripe.tsx
│   │   ├── Supabase.tsx
│   │   ├── Supermemory.tsx
│   │   ├── Vercel.tsx
│   │   ├── Webflow.tsx
│   │   ├── Wix.tsx
│   │   ├── coingecko.webp
│   │   ├── context7.png
│   │   ├── deepwiki.webp
│   │   └── wix.webp
│   └── misc/            # Other brand assets
│       └── Globalping.tsx
│
├── icons/               # UI and functional icons
│   ├── chat/            # Chat-specific icons (KEEP AS-IS)
│   │   ├── blocked.tsx
│   │   ├── camera.tsx
│   │   ├── chevron-right.tsx
│   │   ├── chevrown-down.tsx
│   │   ├── chrome.tsx
│   │   ├── circle-check.tsx
│   │   ├── click.tsx
│   │   ├── delete-memory.tsx
│   │   ├── expand.tsx
│   │   ├── folder.tsx
│   │   ├── history.tsx
│   │   ├── keyboard-type.tsx
│   │   ├── link.tsx
│   │   ├── list.tsx
│   │   ├── loading-check.css
│   │   ├── loading-check.tsx
│   │   ├── navigate-to.tsx
│   │   ├── new-tab.tsx
│   │   ├── pdf.tsx
│   │   ├── reading-page-content.tsx
│   │   ├── retrieve-memory.tsx
│   │   ├── save-memory.tsx
│   │   ├── scroll.tsx
│   │   ├── search.tsx
│   │   ├── suggest-memery.tsx
│   │   ├── switchh.tsx
│   │   ├── videotype-detection.tsx
│   │   ├── wait-for.tsx
│   │   ├── x.tsx
│   │   ├── youtube-notion-agent-icons.tsx
│   │   ├── youtube-transcipt.tsx
│   │   └── youtube.tsx
│   │
│   ├── files/           # File type icons (KEEP AS-IS)
│   │   ├── Cicon.tsx
│   │   ├── CPPIcon.tsx
│   │   ├── CSicon.tsx
│   │   ├── CSSIcon.tsx
│   │   ├── CSVicon.tsx
│   │   ├── Goicon.tsx
│   │   ├── HtmlIcon.tsx
│   │   ├── index.tsx
│   │   ├── JAVAicon.tsx
│   │   ├── jsIcon.tsx
│   │   ├── JSONicon.tsx
│   │   ├── jsxIcon.tsx
│   │   ├── LogIcon.tsx
│   │   ├── mdIcon.tsx
│   │   ├── pdfIcon.tsx
│   │   ├── PHPicon.tsx
│   │   ├── PyIcon.tsx
│   │   ├── RSicon.tsx
│   │   ├── Rubyicon.tsx
│   │   ├── Shicon.tsx
│   │   ├── SWIFTicon.tsx
│   │   ├── tsxIcons.tsx
│   │   ├── TXTicon.tsx
│   │   ├── XMLicon.tsx
│   │   └── YAMLicon.tsx
│   │
│   └── ui/              # General UI icons
│       ├── audio-lines.tsx
│       ├── cart.tsx
│       ├── dollar.tsx
│       ├── indian-rupee.tsx
│       ├── report.tsx
│       ├── shield.tsx
│       └── youtubeplusnotion.tsx
│
└── images/              # Static image assets
    ├── agent.png
    ├── icon.png
    ├── intregations.png
    ├── logo.png
    ├── mcp.png
    ├── parallel-task-mcp.png
    ├── research.png
    └── supermemory.svg
```

### Updated tsconfig.json
```json
{
  "baseUrl": ".",
  "paths": {
    "~*": ["./src/*"],
    "~assets/*": ["./assets/*"]
  }
}
```

---

## Migration Phases

### Phase 1: Preparation & Backup ⚙️
**Goal**: Ensure safe migration with rollback capability

#### Tasks:
1. ✅ Create this migration plan document
2. ✅ Analyze current asset usage patterns
3. ⬜ Commit current state to git
4. ⬜ Create backup of `/assets` folder (optional)

**Validation**: Git shows clean working directory before proceeding

---

### Phase 2: TypeScript Configuration Update 🔧
**Goal**: Enable new path alias `~assets/*`

#### Tasks:
1. Update `tsconfig.json` to add `~assets/*` path mapping
2. Verify TypeScript compilation with `pnpm type:check`

#### Files Modified:
- `tsconfig.json`

**Validation**: 
- TypeScript compilation succeeds
- No new type errors introduced

---

### Phase 3: Create New Folder Structure 📁
**Goal**: Organize assets into logical categories

#### Tasks:
1. Create new directory structure:
   ```powershell
   mkdir assets/brands/integrations
   mkdir assets/brands/misc
   mkdir assets/icons/ui
   mkdir assets/images
   ```

2. Move files to new locations:

   **Brand Integrations** (Move from `/assets/` to `/assets/brands/integrations/`):
   - Ahrefs.tsx
   - Asana.tsx
   - astro-docs.tsx (rename to Astro.tsx for consistency)
   - Atlassian.tsx
   - canva.tsx (rename to Canva.tsx)
   - figma.tsx (rename to Figma.tsx)
   - github.tsx (rename to GitHub.tsx)
   - huggingface.tsx (rename to HuggingFace.tsx)
   - linear.tsx (rename to Linear.tsx)
   - Netlify.tsx
   - notion.tsx (rename to Notion.tsx)
   - paypal.tsx (rename to PayPal.tsx)
   - sentry.tsx (rename to Sentry.tsx)
   - stripe.tsx (rename to Stripe.tsx)
   - supabase.tsx (rename to Supabase.tsx)
   - Supermemory.tsx
   - vercel.tsx (rename to Vercel.tsx)
   - webflow.tsx (rename to Webflow.tsx)
   - Wix.tsx
   - coingecko.webp
   - context7.png
   - deepwiki.webp
   - wix.webp

   **Brand Misc** (Move from `/assets/` to `/assets/brands/misc/`):
   - Globalping.tsx

   **UI Icons** (Move from `/assets/` to `/assets/icons/ui/`):
   - audio-lines.tsx
   - cart.tsx
   - dollar.tsx
   - indian-rupee.tsx
   - report.tsx
   - shield.tsx
   - youtubeplusnotion.tsx

   **Images** (Move from `/assets/` to `/assets/images/`):
   - agent.png
   - icon.png
   - intregations.png
   - logo.png
   - mcp.png
   - parallel-task-mcp.png
   - research.png
   - supermemory.svg

3. Rename folders for consistency:
   ```powershell
   # Rename fileIcons to files
   mv assets/fileIcons assets/icons/files-temp
   mv assets/icons/files-temp assets/icons/files
   ```

**Validation**: 
- All files moved successfully
- No duplicate files
- Old locations are empty (except `chat/` folder)

---

### Phase 4: Update Import Statements 🔄
**Goal**: Update all imports to use new paths and aliases

#### Import Mapping Strategy:

**Old Path** → **New Path**

##### Brand Integration Icons:
- `../../assets/Ahrefs` → `~assets/brands/integrations/Ahrefs`
- `../../assets/astro-docs` → `~assets/brands/integrations/Astro`
- `../../assets/huggingface` → `~assets/brands/integrations/HuggingFace`
- `../../assets/linear` → `~assets/brands/integrations/Linear`
- `../../assets/Netlify` → `~assets/brands/integrations/Netlify`
- `../../assets/notion` → `~assets/brands/integrations/Notion`
- `../../assets/paypal` → `~assets/brands/integrations/PayPal`
- `../../assets/sentry` → `~assets/brands/integrations/Sentry`
- `../../assets/supabase` → `~assets/brands/integrations/Supabase`
- `../../assets/Supermemory` → `~assets/brands/integrations/Supermemory`
- `../../assets/webflow` → `~assets/brands/integrations/Webflow`
- Similar patterns for other brand icons

##### Image Assets:
- `../../assets/logo.png` → `~assets/images/logo.png`
- `~assets/intregations.png` → `~assets/images/intregations.png`
- `~assets/agent.png` → `~assets/images/agent.png`
- `~assets/research.png` → `~assets/images/research.png`
- Similar patterns for other images

##### Chat Icons:
- `../../../../../assets/chat/click` → `~assets/icons/chat/click`
- `../../../../../assets/chat/navigate-to` → `~assets/icons/chat/navigate-to`
- `assets/youtubeplusnotion` → `~assets/icons/ui/youtubeplusnotion`
- Similar patterns for other chat icons

##### File Icons:
- `../../assets/fileIcons` → `~assets/icons/files`

##### UI Icons:
- `../../assets/report` → `~assets/icons/ui/report`

#### Files to Update (84 total):

**High Priority** (Most imports):
1. `src/components/ui/tools/icons/ToolIconMapper.tsx` (27 imports)
2. `src/components/ui/tools/icons/McpIconMapper.tsx` (21 imports)
3. `src/constants/mcpServers.tsx` (14 imports)
4. `src/components/ui/tools/ChainOfThoughtToolRenderer.tsx` (5 imports)
5. `src/utils/fileIconMapper.tsx` (1 import, 26 re-exports)

**Medium Priority**:
6. `src/components/ui/tools/cards/CompactToolCard.tsx` (4 imports)
7. `src/components/features/chat/dropdowns/SlashCommandDropdown.tsx` (2 imports)
8. `src/components/features/chat/components/WorkflowBadge.tsx` (2 imports)

**Low Priority** (Single imports):
9. `src/components/features/onboarding/GetStartedPage.tsx`
10. `src/components/features/onboarding/FeaturesPage.tsx`
11. `src/components/features/onboarding/CapabilitiesPage.tsx`
12. `src/components/features/chat/components/EmptyState.tsx`
13. `src/components/features/chat/components/ResearchProgress.tsx`
14. `src/components/features/chat/components/ChatMessages.tsx`
15. `src/components/ui/tools/ChainOfThought/ChainOfThoughtHeader.tsx`
16. `src/components/shared/layouts/LoadingScreen.tsx`

**Special Handling**:
- `src/utils/fileIconMapper.tsx` - Updates index import path

#### Update Strategy:
- Use multi-file batch updates for efficiency
- Group updates by file type (brand icons, images, chat icons, etc.)
- Update component imports and re-exports
- Maintain exact component names during refactor

**Validation**:
- TypeScript compilation succeeds: `pnpm type:check`
- No runtime import errors
- All icon components render correctly

---

### Phase 5: Cleanup & Verification 🧹
**Goal**: Remove old structure and verify everything works

#### Tasks:
1. Remove empty directories from old structure
2. Update any documentation referencing old asset paths
3. Run full TypeScript type check
4. Test build process
5. Visual verification of key pages with assets

#### Verification Checklist:
- [ ] TypeScript compilation: `pnpm type:check`
- [ ] Development build: `pnpm dev`
- [ ] Production build: `pnpm build`
- [ ] No console errors in browser
- [ ] MCP icons render correctly
- [ ] Chat icons appear in UI
- [ ] File type icons display properly
- [ ] Logo and images load correctly
- [ ] Onboarding screens show correct images

**Files to Update** (Documentation):
- None identified yet (may update if asset references exist in docs)

---

### Phase 6: Final Testing & Rollout ✅
**Goal**: Ensure production readiness

#### Tasks:
1. Full application testing
2. Check extension loading in Chrome
3. Verify all features using assets work correctly
4. Create git commit with descriptive message
5. Update team on changes

#### Test Scenarios:
- [ ] Open side panel - logo displays
- [ ] Send chat message - chat icons animate
- [ ] Open MCP manager - brand logos display
- [ ] Browse files in chat - file icons render
- [ ] View onboarding - feature images load
- [ ] Test YouTube-to-Notion workflow icons

---

## Risk Mitigation

### Potential Issues & Solutions:

| Risk | Impact | Mitigation |
|------|--------|------------|
| TypeScript compilation errors | HIGH | Run type:check after each phase |
| Import path typos | MEDIUM | Use search/replace with verification |
| Missing asset files | HIGH | Verify all moves before deleting originals |
| Build failures | HIGH | Test build after Phase 4 |
| Runtime import failures | MEDIUM | Test in dev mode before production build |
| Case sensitivity issues | LOW | Maintain consistent naming (PascalCase for components) |

### Rollback Plan:
If issues arise at any phase:
1. Stop immediately
2. Revert using git: `git checkout .`
3. Review error messages
4. Fix issues in plan
5. Restart from Phase 1

---

## Execution Commands

### Phase 1: Backup
```powershell
# Commit current state
git add .
git commit -m "Pre-migration checkpoint: Assets folder structure"
```

### Phase 2: Update TypeScript Config
```powershell
# Edit tsconfig.json (manual or use script)
# Then verify
pnpm type:check
```

### Phase 3: Create Structure & Move Files
```powershell
# Create directories
New-Item -ItemType Directory -Path "assets/brands/integrations" -Force
New-Item -ItemType Directory -Path "assets/brands/misc" -Force
New-Item -ItemType Directory -Path "assets/icons/ui" -Force
New-Item -ItemType Directory -Path "assets/images" -Force

# Move brand integration files
Move-Item -Path "assets/Ahrefs.tsx" -Destination "assets/brands/integrations/"
Move-Item -Path "assets/Asana.tsx" -Destination "assets/brands/integrations/"
Move-Item -Path "assets/astro-docs.tsx" -Destination "assets/brands/integrations/Astro.tsx"
Move-Item -Path "assets/Atlassian.tsx" -Destination "assets/brands/integrations/"
Move-Item -Path "assets/canva.tsx" -Destination "assets/brands/integrations/Canva.tsx"
Move-Item -Path "assets/figma.tsx" -Destination "assets/brands/integrations/Figma.tsx"
Move-Item -Path "assets/github.tsx" -Destination "assets/brands/integrations/GitHub.tsx"
Move-Item -Path "assets/huggingface.tsx" -Destination "assets/brands/integrations/HuggingFace.tsx"
Move-Item -Path "assets/linear.tsx" -Destination "assets/brands/integrations/Linear.tsx"
Move-Item -Path "assets/Netlify.tsx" -Destination "assets/brands/integrations/"
Move-Item -Path "assets/notion.tsx" -Destination "assets/brands/integrations/Notion.tsx"
Move-Item -Path "assets/paypal.tsx" -Destination "assets/brands/integrations/PayPal.tsx"
Move-Item -Path "assets/sentry.tsx" -Destination "assets/brands/integrations/Sentry.tsx"
Move-Item -Path "assets/stripe.tsx" -Destination "assets/brands/integrations/Stripe.tsx"
Move-Item -Path "assets/supabase.tsx" -Destination "assets/brands/integrations/Supabase.tsx"
Move-Item -Path "assets/Supermemory.tsx" -Destination "assets/brands/integrations/"
Move-Item -Path "assets/vercel.tsx" -Destination "assets/brands/integrations/Vercel.tsx"
Move-Item -Path "assets/webflow.tsx" -Destination "assets/brands/integrations/Webflow.tsx"
Move-Item -Path "assets/Wix.tsx" -Destination "assets/brands/integrations/"
Move-Item -Path "assets/coingecko.webp" -Destination "assets/brands/integrations/"
Move-Item -Path "assets/context7.png" -Destination "assets/brands/integrations/"
Move-Item -Path "assets/deepwiki.webp" -Destination "assets/brands/integrations/"
Move-Item -Path "assets/wix.webp" -Destination "assets/brands/integrations/"

# Move brand misc files
Move-Item -Path "assets/Globalping.tsx" -Destination "assets/brands/misc/"

# Move UI icons
Move-Item -Path "assets/audio-lines.tsx" -Destination "assets/icons/ui/"
Move-Item -Path "assets/cart.tsx" -Destination "assets/icons/ui/"
Move-Item -Path "assets/dollar.tsx" -Destination "assets/icons/ui/"
Move-Item -Path "assets/indian-rupee.tsx" -Destination "assets/icons/ui/"
Move-Item -Path "assets/report.tsx" -Destination "assets/icons/ui/"
Move-Item -Path "assets/shield.tsx" -Destination "assets/icons/ui/"
Move-Item -Path "assets/youtubeplusnotion.tsx" -Destination "assets/icons/ui/"

# Move images
Move-Item -Path "assets/agent.png" -Destination "assets/images/"
Move-Item -Path "assets/icon.png" -Destination "assets/images/"
Move-Item -Path "assets/intregations.png" -Destination "assets/images/"
Move-Item -Path "assets/logo.png" -Destination "assets/images/"
Move-Item -Path "assets/mcp.png" -Destination "assets/images/"
Move-Item -Path "assets/parallel-task-mcp.png" -Destination "assets/images/"
Move-Item -Path "assets/research.png" -Destination "assets/images/"
Move-Item -Path "assets/supermemory.svg" -Destination "assets/images/"

# Rename folders
Move-Item -Path "assets/fileIcons" -Destination "assets/icons/files"
Move-Item -Path "assets/chat" -Destination "assets/icons/chat"
```

### Phase 4: Update Imports
```powershell
# This will be done programmatically using multi_replace_string_in_file
# See detailed file-by-file updates in Phase 4
```

### Phase 5: Cleanup
```powershell
# Verify build
pnpm type:check
pnpm dev

# After verification, commit
git add .
git commit -m "refactor: Reorganize assets folder with logical structure

- Moved brand/integration icons to assets/brands/integrations/
- Moved UI icons to assets/icons/ui/
- Moved file type icons to assets/icons/files/
- Moved chat icons to assets/icons/chat/
- Moved images to assets/images/
- Updated tsconfig.json with ~assets/* path alias
- Updated all 84 import statements to use new structure
- Standardized component naming (PascalCase)"
```

---

## Benefits of New Structure

1. **Better Organization**: 
   - Clear separation between brands, icons, and images
   - Easier to locate assets by category

2. **Improved Maintainability**:
   - New assets can be placed in appropriate categories
   - Consistent naming conventions

3. **Cleaner Imports**:
   - `~assets/*` prefix for all asset imports
   - No more deep relative paths (`../../../../../`)

4. **Scalability**:
   - Easy to add new categories (e.g., `assets/animations/`)
   - Structure supports growth

5. **Developer Experience**:
   - Autocomplete works better with organized structure
   - Faster asset discovery

---

## Post-Migration

### New Import Examples:
```typescript
// Before:
import { Notion } from "../../assets/notion"
import logoImage from '../../assets/logo.png'
import { SearchIcon } from '../../../../../assets/chat/search'

// After:
import { Notion } from "~assets/brands/integrations/Notion"
import logoImage from '~assets/images/logo.png'
import { SearchIcon } from '~assets/icons/chat/search'
```

### Maintenance Guidelines:
1. **New brand integrations**: Place in `assets/brands/integrations/`
2. **New UI icons**: Place in `assets/icons/ui/`
3. **New images**: Place in `assets/images/`
4. **Always use**: `~assets/*` prefix for imports
5. **Naming convention**: PascalCase for React components

---

## Timeline Estimate

| Phase | Estimated Time | Risk Level |
|-------|---------------|------------|
| Phase 1: Preparation | 5 minutes | LOW |
| Phase 2: TypeScript Config | 5 minutes | LOW |
| Phase 3: File Migration | 15 minutes | MEDIUM |
| Phase 4: Import Updates | 30-45 minutes | HIGH |
| Phase 5: Cleanup | 15 minutes | MEDIUM |
| Phase 6: Testing | 20 minutes | MEDIUM |
| **TOTAL** | **90-105 minutes** | **MEDIUM** |

---

## Sign-off

- [ ] Plan reviewed and approved
- [ ] Git repository in clean state
- [ ] Team notified of upcoming changes
- [ ] Ready to execute Phase 1

---

**Document Version**: 1.0  
**Created**: November 19, 2025  
**Author**: GitHub Copilot  
**Status**: Ready for Execution
