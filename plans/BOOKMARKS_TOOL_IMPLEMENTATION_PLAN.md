# Bookmarks Tool Implementation Plan

## Overview
This plan details the implementation of Chrome Bookmarks API integration for the chrome-ai extension. The bookmarks tool will enable AI-powered bookmark management, organization, and search capabilities.

---

## Analysis: How Tools Work in Chrome-AI

### Tool Architecture Pattern

1. **Tool Registration Flow**
   - Tools are defined using React hooks in `/src/actions/[category]/`
   - Each tool hook calls `registerTool()` from `ai/tools/registryUtils.ts`
   - Tools are registered in `actions/registerAll.ts` via category-specific register functions
   - Tools use Zod schemas for parameter validation

2. **Tool Definition Structure**
   ```typescript
   {
     name: string,                    // Tool identifier
     description: string,             // AI-readable description with usage guidelines
     parameters: z.ZodSchema,         // Input validation schema
     execute: async (args, abortSignal?) => Promise<any>,  // Tool logic
     validateContext?: () => Promise<{valid: boolean, error?: string}>  // Optional pre-check
   }
   ```

3. **Tool UI Registration**
   - Tools register UI renderers via `useToolUI()` hook
   - Uses `CompactToolRenderer` for consistent display
   - Custom renderers for input/output visualization
   - Automatic error handling and loading states

4. **Tool Action Formatters**
   - Formatters transform technical tool names into human-readable descriptions
   - Located in `components/ui/tools/formatters/`
   - Each tool should have a formatter in `formatters/[category].ts`
   - Registered in `formatters/registry.ts`
   - Shows contextual info (loading/success/error states) with descriptions

5. **Tool Enablement System**
   - Tools listed in `ai/tools/enabledTools.ts` (DEFAULT_ENABLED_TOOLS array)
   - User can override via Settings UI (`EnabledToolsSettings.tsx`)
   - Storage in `chrome.storage.local` as `enabledToolsOverride`
   - Runtime filtering in `getToolsForMode()` based on enabled list

6. **Tool Categorization**
   - Tools grouped by category in `constants/toolDescriptions.ts`
   - Categories: Navigation, Content, Interaction, Search & History, Memory & Reminders, Other
   - Used for organized display in Settings UI

7. **Chrome API Helpers**
   - Safe wrappers in `actions/chromeApiHelpers.ts`
   - Error handling with custom `BrowserAPIError` class
   - Permission validation before API calls

---

## Phase 1: Foundation & Planning ✅ COMPLETED

### 1.1 Directory Structure Setup ✅
**Goal:** Create organized directory structure for bookmarks functionality

**Tasks:**
- [x] Create `/src/actions/bookmarks/` directory
- [x] Create `/src/actions/bookmarks/index.tsx` (main registration file)
- [x] Create placeholder files for each bookmark tool

**Files to Create:**
```
src/actions/bookmarks/
├── index.tsx                    # Registration entry point
├── createBookmark.tsx           # Create/add bookmark
├── searchBookmarks.tsx          # Search bookmarks by query
├── listBookmarks.tsx            # List bookmarks from folder
├── deleteBookmark.tsx           # Remove bookmark
├── updateBookmark.tsx           # Edit bookmark title/URL
├── organizeBookmarks.tsx        # AI-powered organization
└── getBookmarkTree.tsx          # Get folder hierarchy

src/components/ui/tools/formatters/formatters/
└── bookmarks.ts                 # Action formatters for UI display
```

### 1.2 Chrome API Helpers ✅
**Goal:** Create safe wrapper functions for Chrome Bookmarks API

**Tasks:**
- [x] Add bookmarks API helpers to `actions/chromeApiHelpers.ts`
- [x] Implement error handling for bookmark operations
- [x] Add permission validation checks

**Functions to Add:**
```typescript
// In chromeApiHelpers.ts
export async function safeBookmarksCreate(bookmark: chrome.bookmarks.BookmarkCreateArg)
export async function safeBookmarksSearch(query: string | {query?: string, url?: string, title?: string})
export async function safeBookmarksGet(id: string | string[])
export async function safeBookmarksGetTree()
export async function safeBookmarksGetChildren(id: string)
export async function safeBookmarksRemove(id: string)
export async function safeBookmarksUpdate(id: string, changes: chrome.bookmarks.BookmarkChangesArg)
export async function safeBookmarksMove(id: string, destination: chrome.bookmarks.BookmarkDestinationArg)
export async function safeBookmarksGetRecent(numberOfItems: number)
```

**Error Handling:**
- Check for `chrome.bookmarks` API availability
- Handle missing bookmark IDs
- Validate URLs and titles
- Catch and wrap Chrome API errors in `BrowserAPIError`

### 1.3 Type Definitions ✅
**Goal:** Define TypeScript types for bookmark operations

**Tasks:**
- [x] Create type definitions in `types/bookmarks.ts`
- [x] Define bookmark result formats
- [x] Create folder structure types

**Types to Define:**
```typescript
// In types/bookmarks.ts
export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  dateGroupModified?: number;
  parentId?: string;
  children?: BookmarkNode[];
  index?: number;
}

export interface BookmarkSearchResult {
  id: string;
  title: string;
  url: string;
  parentPath: string;
  dateAdded: number;
}

export interface BookmarkFolder {
  id: string;
  title: string;
  path: string;
  children: BookmarkNode[];
}

export interface BookmarkOrganizationSuggestion {
  bookmarkId: string;
  currentFolder: string;
  suggestedFolder: string;
  reason: string;
}
```

### 1.4 Action Formatters Setup ✅
**Goal:** Create formatters for displaying bookmark tool actions in UI

**Tasks:**
- [x] Create `src/components/ui/tools/formatters/formatters/bookmarks.ts`
- [x] Implement formatters for all 7 bookmark tools
- [x] Register formatters in `formatters/registry.ts`

**Formatters to Implement:**
```typescript
// In components/ui/tools/formatters/formatters/bookmarks.ts
import type { ActionFormatter } from '../types';
import { truncateText, extractDomain } from '../helpers';

export const createBookmarkFormatter: ActionFormatter = ({ state, input, output }) => {
    const title = output?.title || input?.title;
    const url = output?.url || input?.url;
    
    if (state === 'loading') {
        return {
            action: 'Creating bookmark',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Bookmark created',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    return { action: 'Failed to create bookmark' };
};

export const searchBookmarksFormatter: ActionFormatter = ({ state, input, output }) => {
    const query = input?.query;
    const count = output?.count || 0;
    
    if (state === 'loading') {
        return {
            action: 'Searching bookmarks',
            description: query ? `"${truncateText(query, 30)}"` : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Found bookmarks',
            description: `${count} result${count !== 1 ? 's' : ''}`
        };
    }
    return { action: 'Bookmark search failed' };
};

export const listBookmarksFormatter: ActionFormatter = ({ state, output }) => {
    const count = output?.count || 0;
    
    if (state === 'loading') {
        return { action: 'Loading bookmarks' };
    }
    if (state === 'success') {
        return {
            action: 'Listed bookmarks',
            description: `${count} item${count !== 1 ? 's' : ''}`
        };
    }
    return { action: 'Failed to list bookmarks' };
};

export const deleteBookmarkFormatter: ActionFormatter = ({ state, input }) => {
    if (state === 'loading') {
        return { action: 'Deleting bookmark' };
    }
    if (state === 'success') {
        return { action: 'Bookmark deleted' };
    }
    return { action: 'Failed to delete bookmark' };
};

export const updateBookmarkFormatter: ActionFormatter = ({ state, input, output }) => {
    const title = output?.title || input?.title;
    
    if (state === 'loading') {
        return { action: 'Updating bookmark' };
    }
    if (state === 'success') {
        return {
            action: 'Bookmark updated',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    return { action: 'Failed to update bookmark' };
};

export const getBookmarkTreeFormatter: ActionFormatter = ({ state, output }) => {
    const totalFolders = output?.totalFolders || 0;
    
    if (state === 'loading') {
        return { action: 'Loading bookmark tree' };
    }
    if (state === 'success') {
        return {
            action: 'Loaded bookmark tree',
            description: `${totalFolders} folder${totalFolders !== 1 ? 's' : ''}`
        };
    }
    return { action: 'Failed to load bookmark tree' };
};

export const organizeBookmarksFormatter: ActionFormatter = ({ state, output }) => {
    const suggestions = output?.suggestions;
    const count = suggestions?.newFolders?.length || 0;
    
    if (state === 'loading') {
        return { action: 'Analyzing bookmarks' };
    }
    if (state === 'success') {
        return {
            action: 'Organization suggestions',
            description: count > 0 ? `${count} suggestion${count !== 1 ? 's' : ''}` : 'No changes needed'
        };
    }
    return { action: 'Failed to analyze bookmarks' };
};
```

**Register in registry.ts:**
```typescript
// In components/ui/tools/formatters/registry.ts
import {
    createBookmarkFormatter,
    searchBookmarksFormatter,
    listBookmarksFormatter,
    deleteBookmarkFormatter,
    updateBookmarkFormatter,
    getBookmarkTreeFormatter,
    organizeBookmarksFormatter
} from './formatters/bookmarks';

export const formatters: Record<string, ActionFormatter> = {
    // ... existing formatters
    
    // Bookmarks
    createBookmark: createBookmarkFormatter,
    searchBookmarks: searchBookmarksFormatter,
    listBookmarks: listBookmarksFormatter,
    deleteBookmark: deleteBookmarkFormatter,
    updateBookmark: updateBookmarkFormatter,
    getBookmarkTree: getBookmarkTreeFormatter,
    organizeBookmarks: organizeBookmarksFormatter,
};
```

---

## Phase 2: Core Bookmark Tools ✅ COMPLETED

### 2.1 Create Bookmark Tool ✅
**Goal:** Enable AI to save new bookmarks

**Implementation:**
```typescript
// File: src/actions/bookmarks/createBookmark.tsx

export function useCreateBookmark() {
  registerTool({
    name: 'createBookmark',
    description: `Save a bookmark to Chrome bookmarks. Use when user wants to "bookmark this", "save page", "add to bookmarks". Can specify folder (default: "Other bookmarks"). Returns bookmark ID and location. REQUIRES CONSENT: Ask "Want me to bookmark this?" first. Cannot bookmark chrome:// pages.`,
    
    parameters: z.object({
      url: z.string().describe('Full URL to bookmark (must include https:// or http://)'),
      title: z.string().describe('Bookmark title. If not provided, uses page title'),
      folderId: z.string().optional().describe('Optional: Parent folder ID. Omit to save in "Other bookmarks"')
    }),
    
    execute: async ({ url, title, folderId }) => {
      const bookmark = await safeBookmarksCreate({
        url,
        title,
        parentId: folderId
      });
      return {
        success: true,
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        folder: bookmark.parentId
      };
    }
  });
  
  // Register UI renderer
}
```

**Status:** ✅ Implemented
- Full URL validation (http/https only)
- Prevents chrome:// page bookmarking
- Default folder support (Other bookmarks)
- Custom folder ID support
- Rich UI with title and URL display
- Error handling with BrowserAPIError

### 2.2 Search Bookmarks Tool ✅
**Goal:** Enable AI to find bookmarks by query

**Implementation:**
```typescript
// File: src/actions/bookmarks/searchBookmarks.tsx

export function useSearchBookmarks() {
  registerTool({
    name: 'searchBookmarks',
    description: `Search bookmarks by query (searches title and URL). Use when user asks "find bookmark", "search my bookmarks", "do I have a bookmark for X". Returns matching bookmarks with paths. Searches all folders recursively. Returns max 50 results sorted by relevance.`,
    
    parameters: z.object({
      query: z.string().describe('Search query. Searches in bookmark titles and URLs. Case-insensitive. Examples: "github", "react docs", "example.com"'),
      limit: z.number().optional().default(10).describe('Max results to return (1-50, default 10)')
    }),
    
    execute: async ({ query, limit = 10 }) => {
      const results = await safeBookmarksSearch(query);
      const limited = results.slice(0, Math.min(limit, 50));
      
      // Enrich with folder paths
      const enriched = await Promise.all(
        limited.map(async (bookmark) => {
          const path = await getBookmarkPath(bookmark.id);
          return {
            id: bookmark.id,
            title: bookmark.title,
            url: bookmark.url,
            path: path,
            dateAdded: bookmark.dateAdded
          };
        })
      );
      
      return {
        success: true,
        count: enriched.length,
        total: results.length,
        bookmarks: enriched
      };
    }
  });
}
```

**Status:** ✅ Implemented
- Full-text search in titles and URLs
- Folder path resolution with tree traversal
- Result limiting (1-50, default 10)
- Parallel path enrichment
- Rich UI with bookmark cards showing title, URL, path
- Scrollable results display
- Total count tracking

### 2.3 List Bookmarks Tool ✅
**Goal:** List bookmarks from specific folder

**Implementation:**
```typescript
// File: src/actions/bookmarks/listBookmarks.tsx

export function useListBookmarks() {
  registerTool({
    name: 'listBookmarks',
    description: `List bookmarks from a specific folder. Use when user asks "show bookmarks in [folder]", "what's in my bookmarks bar", "list my saved sites". Returns bookmarks and subfolders. Default: lists "Other bookmarks".`,
    
    parameters: z.object({
      folderId: z.string().optional().describe('Folder ID to list. Omit for "Other bookmarks". Special IDs: "0"=root, "1"=bookmarks bar, "2"=other bookmarks'),
      includeSubfolders: z.boolean().optional().default(false).describe('Include subfolders recursively')
    }),
    
    execute: async ({ folderId = '2', includeSubfolders = false }) => {
      const children = await safeBookmarksGetChildren(folderId);
      
      const items = children.map(item => ({
        id: item.id,
        title: item.title,
        url: item.url,
        type: item.url ? 'bookmark' : 'folder',
        dateAdded: item.dateAdded,
        childCount: item.children?.length || 0
      }));
      
      return {
        success: true,
        folderId,
        count: items.length,
        items
      };
    }
  });
}
```

**Status:** ✅ Implemented
- Lists bookmarks and folders from specified folder
- Default to "Other bookmarks" (ID: 2)
- Special folder ID support (0=root, 1=bookmarks bar, 2=other bookmarks)
- Distinguishes between bookmarks and folders with icons
- Shows child count for folders
- Rich UI with scrollable list

### 2.4 Delete Bookmark Tool ✅
**Goal:** Remove bookmarks

**Implementation:**
```typescript
// File: src/actions/bookmarks/deleteBookmark.tsx

export function useDeleteBookmark() {
  registerTool({
    name: 'deleteBookmark',
    description: `Delete a bookmark by ID. Use when user asks to "delete bookmark", "remove this bookmark", "delete saved link". REQUIRES CONSENT: Ask "Delete bookmark [title]?" first. Cannot undo. Cannot delete special folders (bookmarks bar, other bookmarks).`,
    
    parameters: z.object({
      bookmarkId: z.string().describe('Bookmark ID to delete. Get from searchBookmarks or listBookmarks')
    }),
    
    execute: async ({ bookmarkId }) => {
      // Validate it's not a special folder
      const bookmark = await safeBookmarksGet(bookmarkId);
      if (!bookmark[0].url) {
        throw new Error('Cannot delete folders. Delete individual bookmarks instead.');
      }
      
      await safeBookmarksRemove(bookmarkId);
      
      return {
        success: true,
        deletedId: bookmarkId,
        message: 'Bookmark deleted successfully'
      };
    }
  });
}
```

**Status:** ✅ Implemented
- Validates bookmark exists before deletion
- Prevents deletion of folders (bookmarks only)
- Prevents deletion of special folders (0, 1, 2)
- Safety checks and validation
- Clear success/error messages
- Requires user consent (documented in description)

### 2.5 Update Bookmark Tool ✅
**Goal:** Edit bookmark properties

**Implementation:**
```typescript
// File: src/actions/bookmarks/updateBookmark.tsx

export function useUpdateBookmark() {
  registerTool({
    name: 'updateBookmark',
    description: `Update bookmark title or URL. Use when user asks to "rename bookmark", "change bookmark URL", "edit bookmark". Can modify title, URL, or both. Returns updated bookmark.`,
    
    parameters: z.object({
      bookmarkId: z.string().describe('Bookmark ID to update'),
      title: z.string().optional().describe('New bookmark title'),
      url: z.string().optional().describe('New bookmark URL (must be valid URL)')
    }),
    
    execute: async ({ bookmarkId, title, url }) => {
      if (!title && !url) {
        throw new Error('Must provide at least title or url to update');
      }
      
      const changes: any = {};
      if (title) changes.title = title;
      if (url) changes.url = url;
      
      const updated = await safeBookmarksUpdate(bookmarkId, changes);
      
      return {
        success: true,
        id: updated.id,
        title: updated.title,
        url: updated.url
      };
    }
  });
}
```

**Status:** ✅ Implemented
- Update title and/or URL
- Validates at least one field provided
- URL validation (http/https only)
- Prevents chrome:// URLs
- Shows updated title and URL in UI
- Handles partial updates (title only or URL only)

---

## Phase 2 Summary ✅

**All 5 core bookmark tools implemented:**
1. ✅ createBookmark - Save bookmarks with folder support
2. ✅ searchBookmarks - Search with path resolution
3. ✅ listBookmarks - List folder contents with type distinction
4. ✅ deleteBookmark - Delete with safety validations
5. ✅ updateBookmark - Edit title/URL with validation

**Features implemented:**
- Full Chrome Bookmarks API integration
- Comprehensive error handling
- Rich UI renderers with CompactToolRenderer
- Input/output visualization
- URL validation and security checks
- Path resolution and folder navigation
- Proper TypeScript typing
- Logging and debugging support

---

## Phase 3: Advanced Features ✅ COMPLETED

**All 2 advanced bookmark tools implemented:**
1. ✅ getBookmarkTree - Complete folder hierarchy with statistics
2. ✅ organizeBookmarks - AI-powered organization with pattern detection

**Features implemented:**
- Recursive tree traversal and simplification
- Folder-only or full bookmark tree views
- Optional depth limiting for large collections
- Domain-based grouping analysis
- Keyword pattern detection (tutorials, docs, blogs, tools, etc.)
- Duplicate URL detection
- Organization statistics and metrics
- Move suggestions with reasoning
- Auto-create folders capability (with consent)
- Configurable minimum group size
- Rich UI with detailed statistics display
- Comprehensive error handling and logging

---

## Phase 3: Advanced Features ✅ COMPLETED

### 3.1 Get Bookmark Tree Tool ✅
**Goal:** Retrieve complete bookmark folder hierarchy

**Status:** ✅ Implemented
- Complete bookmark tree retrieval with recursive traversal
- Tree simplification with folder-only or full bookmark views
- Bookmark counting per folder
- Folder and bookmark statistics (total counts, depth)
- Optional max depth limiting for large trees
- Rich UI with folder count, bookmark count, and depth display
- Comprehensive error handling

**Implementation:**
```typescript
// File: src/actions/bookmarks/getBookmarkTree.tsx

export function useGetBookmarkTree() {
  registerTool({
    name: 'getBookmarkTree',
    description: `Get complete bookmark folder structure. Use when user asks "show my bookmark folders", "what's my bookmark organization", "list folder structure". Returns hierarchical tree with all folders and bookmark counts.`,
    
    parameters: z.object({
      includeBookmarks: z.boolean().optional().default(false).describe('Include individual bookmarks (can be large). Default: only shows folders')
    }),
    
    execute: async ({ includeBookmarks = false }) => {
      const tree = await safeBookmarksGetTree();
      
      const simplified = simplifyTree(tree[0], includeBookmarks);
      
      return {
        success: true,
        tree: simplified,
        totalFolders: countFolders(simplified),
        totalBookmarks: includeBookmarks ? countBookmarks(simplified) : undefined
      };
    }
  });
}

function simplifyTree(node: chrome.bookmarks.BookmarkTreeNode, includeBookmarks: boolean) {
  // Recursively build simplified tree structure
  // Filter out bookmarks if includeBookmarks=false
}
```

### 3.2 Organize Bookmarks Tool (AI-Powered) ✅
**Goal:** AI suggests bookmark organization improvements

**Status:** ✅ Implemented
- Comprehensive bookmark analysis with pattern detection
- Domain-based grouping (suggests folders for sites with 3+ bookmarks)
- Keyword pattern detection (tutorials, docs, guides, blogs, tools, etc.)
- Duplicate detection (exact URL matches)
- Organization statistics (total bookmarks, unique domains, folder distribution)
- Move suggestions with detailed reasoning
- Optional auto-create folders with user consent
- Configurable minimum group size (2-10 bookmarks)
- Folder-specific or full tree analysis
- Rich UI showing analysis results, suggestions, and auto-created folders

**Implementation:**
```typescript
// File: src/actions/bookmarks/organizeBookmarks.tsx

export function useOrganizeBookmarks() {
  registerTool({
    name: 'organizeBookmarks',
    description: `Analyze bookmarks and suggest organization improvements. Use when user asks "organize my bookmarks", "clean up bookmarks", "suggest bookmark folders". Returns suggestions for creating folders and moving bookmarks. Does NOT auto-apply changes.`,
    
    parameters: z.object({
      folderId: z.string().optional().describe('Folder to analyze. Omit to analyze all bookmarks'),
      autoCreate: z.boolean().optional().default(false).describe('If true, automatically create suggested folders (requires consent)')
    }),
    
    execute: async ({ folderId, autoCreate = false }) => {
      // Get bookmarks to analyze
      const bookmarks = folderId 
        ? await safeBookmarksGetChildren(folderId)
        : await getAllBookmarks();
      
      // Analyze patterns (domains, titles, etc.)
      const suggestions = analyzeBookmarkPatterns(bookmarks);
      
      // Optionally auto-create folders
      if (autoCreate) {
        for (const suggestion of suggestions.newFolders) {
          await safeBookmarksCreate({
            title: suggestion.name,
            parentId: folderId || '2'
          });
        }
      }
      
      return {
        success: true,
        suggestions: {
          newFolders: suggestions.newFolders,
          moves: suggestions.moves,
          duplicates: suggestions.duplicates
        },
        autoCreated: autoCreate
      };
    }
  });
}

function analyzeBookmarkPatterns(bookmarks: BookmarkNode[]) {
  // Group by domain
  // Detect patterns in titles
  // Find duplicates
  // Suggest folder names
}
```

---

## Phase 4: Integration & Configuration ✅ COMPLETED

### 4.1 Tool Registration ✅
**Goal:** Register all bookmark tools in the system

**Status:** ✅ Implemented
- bookmarks/index.tsx already created with registration function
- Already added to registerAll.ts (registerBookmarkActions)
- Bookmarks types exported from types/index.ts

**Tasks:**
- [x] Create `src/actions/bookmarks/index.tsx` with registration function
- [x] Add to `src/actions/registerAll.ts`
- [x] Export types from `src/types/index.ts`

**Implementation:**
```typescript
// File: src/actions/bookmarks/index.tsx

import { createLogger } from '~logger';
import { useCreateBookmark } from './createBookmark';
import { useSearchBookmarks } from './searchBookmarks';
import { useListBookmarks } from './listBookmarks';
import { useDeleteBookmark } from './deleteBookmark';
import { useUpdateBookmark } from './updateBookmark';
import { useGetBookmarkTree } from './getBookmarkTree';
import { useOrganizeBookmarks } from './organizeBookmarks';

const log = createLogger('Actions-Bookmarks');

export function registerBookmarkActions() {
  useCreateBookmark();
  useSearchBookmarks();
  useListBookmarks();
  useDeleteBookmark();
  useUpdateBookmark();
  useGetBookmarkTree();
  useOrganizeBookmarks();
  
  log.debug('Bookmark actions registered');
}

export {
  useCreateBookmark,
  useSearchBookmarks,
  useListBookmarks,
  useDeleteBookmark,
  useUpdateBookmark,
  useGetBookmarkTree,
  useOrganizeBookmarks
};
```

**Update registerAll.ts:**
```typescript
import { registerBookmarkActions } from "./bookmarks";

export function useRegisterAllActions() {
  // ... existing registrations
  registerBookmarkActions();
}
```

### 4.2 Tool Descriptions & Categories ✅
**Goal:** Add bookmark tools to settings UI configuration

**Status:** ✅ Implemented
- All 7 bookmark tool descriptions added to TOOL_DESCRIPTIONS
- "Bookmarks" category created in TOOL_CATEGORIES
- Formatters already registered in formatters/registry.ts
- Tools set to disabled by default as requested

**Tasks:**
- [x] Add descriptions to `constants/toolDescriptions.ts`
- [x] Create "Bookmarks" category
- [x] Verify formatters are registered in `formatters/registry.ts`
- [x] Set **disabled by default** as requested

**Implementation:**
```typescript
// In constants/toolDescriptions.ts

export const TOOL_DESCRIPTIONS: Record<string, string> = {
  // ... existing tools
  
  // Bookmarks
  createBookmark: 'Save pages to Chrome bookmarks',
  searchBookmarks: 'Search saved bookmarks by keyword',
  listBookmarks: 'List bookmarks from folders',
  deleteBookmark: 'Remove saved bookmarks',
  updateBookmark: 'Edit bookmark title or URL',
  getBookmarkTree: 'View bookmark folder structure',
  organizeBookmarks: 'AI-powered bookmark organization',
};

export const TOOL_CATEGORIES: Record<string, string[]> = {
  // ... existing categories
  'Bookmarks': [
    'createBookmark',
    'searchBookmarks', 
    'listBookmarks',  
    'deleteBookmark',
    'updateBookmark',
    'getBookmarkTree',
    'organizeBookmarks'
  ],
};
```

**Verify Formatters Registered:**
Ensure all 7 bookmark formatters are added to `components/ui/tools/formatters/registry.ts` (completed in Phase 1.4)

### 4.3 Enabled Tools Configuration (DISABLED BY DEFAULT) ✅
**Goal:** Add bookmark tools to enabled tools list, but **DISABLED BY DEFAULT**

**Status:** ✅ Implemented
- Added TOOLS_DISABLED_BY_DEFAULT array in enabledTools.ts
- Bookmark tools included in DEFAULT_ENABLED_TOOLS (so they appear in Settings UI)
- EnabledToolsSettings.tsx updated to respect TOOLS_DISABLED_BY_DEFAULT
- Tools appear in Settings UI but are disabled by default on first load
- Users must explicitly enable them via toggle in Settings

**Implementation:**
- Created `TOOLS_DISABLED_BY_DEFAULT` array with all 7 bookmark tools
- Modified `EnabledToolsSettings.tsx` to check this array on initial load
- Tools show as disabled (toggle OFF) in Settings UI by default
- Once user changes them, their preference is saved to storage

**Tasks:**
- [x] Update `ai/tools/enabledTools.ts`
- [x] Add bookmark tools to DEFAULT list with **exclusion**
- [x] Ensure tools are disabled by default in UI

**Implementation:**
```typescript
// In ai/tools/enabledTools.ts

export const DEFAULT_ENABLED_TOOLS: string[] = [
  // ... existing tools (all enabled by default)
  
  // Bookmarks - DISABLED BY DEFAULT
  // Uncomment to enable:
  // 'createBookmark',
  // 'searchBookmarks',
  // 'listBookmarks',
  // 'deleteBookmark',
  // 'updateBookmark',
  // 'getBookmarkTree',
  // 'organizeBookmarks',
];

// Alternative approach: Add to a DISABLED_BY_DEFAULT list
export const TOOLS_DISABLED_BY_DEFAULT: string[] = [
  'createBookmark',
  'searchBookmarks',
  'listBookmarks',
  'deleteBookmark',
  'updateBookmark',
  'getBookmarkTree',
  'organizeBookmarks',
];
```

**Note:** The current architecture enables all tools in DEFAULT_ENABLED_TOOLS by default. To have them disabled, we should:
1. NOT include them in DEFAULT_ENABLED_TOOLS initially
2. Add them to TOOL_DESCRIPTIONS and TOOL_CATEGORIES for Settings UI
3. Users can manually enable them in Settings

### 4.4 Permissions ✅
**Goal:** Ensure proper Chrome API permissions

**Status:** ✅ Already Present
- "bookmarks" permission already in manifest.json permissions array
- Runtime validation handled by safeBookmarks* helpers in chromeApiHelpers.ts
- No changes needed

**Tasks:**
- [x] Add bookmarks permission to `manifest.json` (if not present)
- [x] Validate permissions at runtime

**Verified in manifest.json:**
```json
{
  "permissions": [
    "bookmarks",  // ✅ Already present
    // ... other permissions
  ]
}
```

---

## Phase 5: Testing & Documentation

### 5.1 Unit Tests
**Goal:** Test individual bookmark tools

**Test Cases:**
- [ ] Create bookmark with valid URL
- [ ] Create bookmark in specific folder
- [ ] Search bookmarks with various queries
- [ ] List bookmarks from different folders
- [ ] Delete bookmark by ID
- [ ] Update bookmark title and URL
- [ ] Get bookmark tree structure
- [ ] Handle API errors gracefully
- [ ] Validate permission checks

### 5.2 Integration Tests
**Goal:** Test tool interactions with AI system

**Test Cases:**
- [ ] AI creates bookmark from conversation
- [ ] AI searches and finds bookmarks
- [ ] AI organizes bookmarks based on context
- [ ] Tool enablement/disablement in Settings
- [ ] Multi-tool workflows (search → delete)

### 5.3 User Documentation
**Goal:** Document bookmark tools for users

**Tasks:**
- [ ] Add to FEATURES.md
- [ ] Create examples in README
- [ ] Document Settings UI usage

**Example Documentation:**
```markdown
## Bookmark Management

The AI can help manage your Chrome bookmarks:

### Features
- 📚 **Save Bookmarks**: "Bookmark this page" or "Save to bookmarks"
- 🔍 **Search Bookmarks**: "Find my React bookmarks"
- 📋 **List Bookmarks**: "Show bookmarks in my Dev folder"
- ✏️ **Edit Bookmarks**: "Rename this bookmark to..."
- 🗑️ **Delete Bookmarks**: "Remove this bookmark"
- 🌲 **View Structure**: "Show my bookmark folders"
- 🤖 **AI Organization**: "Organize my bookmarks"

### Enable Bookmark Tools
1. Open Settings (gear icon)
2. Scroll to "Enabled Tools"
3. Expand "Bookmarks" category
4. Toggle desired bookmark tools ON
5. Reload extension

### Privacy
- Bookmarks are stored locally in Chrome
- No data sent to external servers
- Tools require user consent for destructive actions
```

---

## Phase 6: Optimization & Polish

### 6.1 Performance
**Goal:** Optimize bookmark operations

**Tasks:**
- [ ] Implement caching for bookmark tree
- [ ] Lazy load large bookmark lists
- [ ] Optimize search algorithm
- [ ] Add rate limiting for bulk operations

### 6.2 Error Handling
**Goal:** Improve error messages and recovery

**Tasks:**
- [ ] Comprehensive error messages
- [ ] Validation feedback
- [ ] Graceful degradation
- [ ] User-friendly error display

### 6.3 UI Polish
**Goal:** Enhance tool UI renderers

**Tasks:**
- [ ] Custom bookmark icons in tool cards
- [ ] Rich preview for bookmark search results
- [ ] Folder hierarchy visualization
- [ ] Drag-and-drop organization (future)

---

## Implementation Priority

### High Priority (MVP) ✅ COMPLETED
1. ✅ Phase 1: Foundation (directory, helpers, types, **formatters**)
2. ✅ Phase 2: Core tools (create, search, list, delete, update) - **COMPLETED**
3. ✅ Phase 3: Advanced features (tree navigation, AI organization) - **COMPLETED**
4. ✅ Phase 4: Integration (registration, settings, permissions, **formatter registration**) - **COMPLETED**

### Medium Priority
5. Phase 5: Testing

### Low Priority (Nice to Have)
6. Phase 6: Optimization & polish

---

## Success Metrics

- [x] All 7 bookmark tools registered and functional
- [x] All 7 bookmark formatters registered in `formatters/registry.ts`
- [x] Tools appear in Settings UI under "Bookmarks" category
- [x] Tools are **disabled by default**, users can enable manually
- [x] Tool actions display with human-readable descriptions in UI
- [x] AI can create, search, list, update, and delete bookmarks
- [x] Error handling works for invalid operations
- [x] Permissions properly validated
- [ ] Documentation complete (Phase 5)

---

## Known Limitations

1. **Chrome API Constraints**
   - Cannot bookmark `chrome://` or `about:` pages
   - Cannot access bookmarks from other Chrome profiles
   - Limited to Chrome/Chromium-based browsers

2. **Tool Limitations**
   - Bulk operations require multiple tool calls
   - No real-time bookmark sync across devices (handled by Chrome)
   - Organization suggestions based on heuristics only

3. **Performance**
   - Large bookmark collections (>1000) may be slow
   - Full tree retrieval can be expensive
   - Search is simple text matching (no semantic search)

---

## Future Enhancements

1. **Smart Organization**
   - ML-based folder suggestions
   - Duplicate detection with fuzzy matching
   - Auto-tagging based on content

2. **Enhanced Search**
   - Semantic search using embeddings
   - Search by date range
   - Search by visit frequency

3. **Collaboration**
   - Export bookmarks as markdown
   - Share bookmark collections
   - Import from other browsers

4. **Advanced Features**
   - Bookmark annotations/notes
   - Custom metadata/tags
   - Bookmark health checks (broken links)

---

## Timeline Estimate

- **Phase 1 (Foundation):** 2.5-3.5 hours (includes formatters)
- **Phase 2 (Core Tools):** 4-6 hours
- **Phase 3 (Advanced):** 3-4 hours
- **Phase 4 (Integration):** 2-3 hours (includes formatter registration)
- **Phase 5 (Testing):** 3-4 hours
- **Phase 6 (Polish):** 2-3 hours

**Total:** 16.5-23.5 hours for complete implementation

**MVP (Phases 1, 2.1-2.3, 4):** 8.5-12.5 hours

---

## Getting Started

To begin implementation:

1. **Review this plan** with the team
2. **Start with Phase 1** - Set up directory structure
3. **Implement Phase 2.1** - Create bookmark tool as proof of concept
4. **Test integration** - Ensure tool appears in AI and Settings
5. **Iterate** through remaining phases

Remember: Tools are **disabled by default** - users must explicitly enable in Settings!
