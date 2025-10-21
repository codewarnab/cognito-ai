# Action Name Formatting Plan

## Goal
Transform technical tool names like `navigateTo`, `getSearchResults`, `openSearchResult`, `readPageContent` into human-readable action descriptions that show contextual information from the tool's input/output.

## Current State
- Tool names display as raw function names: `navigateTo`, `getSearchResults`, etc.
- No contextual information shown in the compact card header
- Users see technical names instead of friendly descriptions

## Desired State
Examples:
- `navigateTo` → **"Navigating to: codewarnab.in"** (with URL from input)
- `getSearchResults` → **"Reading search results"** or **"Found 9 results from Google"** (with count from output)
- `openSearchResult` → **"Opening first search result"** or **"Opening search result #3: Arnab Mondal"** (with rank and title truncated )
- `readPageContent` → **"Reading current page content"** or **"Reading: Home - 838 characters"**
- `clickElement` → **"Clicking button"** or **"Clicking: Submit"**
- `typeInField` → **"Typing in search field"**
- `switchTabs` → **"Switching to tab: GitHub"**
- `saveMemory` → **"Saving memory"**

## Implementation Plan

### Step 1: Create Action Name Formatter Utility
**File**: `src/components/ui/ToolActionFormatter.tsx`

Create a utility that:
1. Takes tool name, state, input, and output
2. Returns a formatted action string based on:
   - Tool state (loading vs success)
   - Input parameters
   - Output data
3. Falls back to human-readable tool name if no specific formatter exists

**Structure**:
```typescript
interface ActionFormatterContext {
  toolName: string;
  state: 'loading' | 'success' | 'error';
  input?: any;
  output?: any;
}

type ActionFormatter = (ctx: ActionFormatterContext) => string;
```

### Step 2: Define Action Formatters

Create formatters for each tool category:

#### Navigation Tools
- `navigateTo`: 
  - Loading: "Navigating to: {input.url}"
  - Success: "Opened: {output.url}" (with newTab indicator if needed)
  
#### Search Tools
- `getSearchResults`:
  - Loading: "Reading search results..."
  - Success: "Found {output.count} results from {output.engine}"
  
- `openSearchResult`:
  - Loading: "Opening search result #{input.rank}..."
  - Success: "Opened: {output.title}" or "Opened result #{output.rank}"

#### Content Tools  
- `readPageContent`:
  - Loading: "Reading page content..."
  - Success: "Read {output.contentLength} characters from {output.title}"
  
- `getSelectedText`:
  - Loading: "Getting selected text..."
  - Success: "Got {output.length} characters"

#### Interaction Tools
- `clickElement`:
  - Loading: "Clicking {input.selector}..."
  - Success: "Clicked {output.clicked.tagName}" or "Clicked: {output.clicked.text}"
  
- `typeInField`:
  - Loading: "Typing in {input.field}..."
  - Success: "Typed {input.text.length} characters"
  
- `pressKey`:
  - Loading: "Pressing {input.key}..."
  - Success: "Pressed {input.key}"

#### Tab Tools
- `switchTabs`:
  - Loading: "Switching to tab..."
  - Success: "Switched to: {output.title}"
  
- `getActiveTab`:
  - Loading: "Getting active tab..."
  - Success: "Active: {output.title}"

#### Memory Tools
- `saveMemory`:
  - Loading: "Saving memory: {input.key}..."
  - Success: "Saved memory: {input.key}"
  
- `getMemory`:
  - Loading: "Retrieving memory: {input.key}..."
  - Success: "Retrieved: {input.key}"
  
- `deleteMemory`:
  - Loading: "Deleting memory: {input.key}..."
  - Success: "Deleted: {input.key}"
  
- `listMemories`:
  - Loading: "Listing memories..."
  - Success: "Found {output.count} memories"

### Step 3: Update CompactToolCard Component
**File**: `src/components/ui/CompactToolCard.tsx`

Modify to:
1. Accept input/output in props (already done)
2. Use formatter utility to generate display name
3. Replace `toolName` display with formatted action name

**Changes**:
```tsx
// Add import
import { formatToolAction } from './ToolActionFormatter';

// In render
const displayName = formatToolAction({
  toolName,
  state,
  input,
  output
});

// Replace
<span className="compact-tool-name">{toolName}</span>
// With
<span className="compact-tool-name">{displayName}</span>
```

### Step 4: Update CompactToolRenderer
**File**: `src/ai/CompactToolRenderer.tsx`

Ensure input and output are passed correctly to CompactToolCard (already done ✓).

### Step 5: Helper Functions

Create helper functions for common patterns:
- `truncateText(text, maxLength)` - Truncate long text with ellipsis
- `extractDomain(url)` - Get readable domain from URL
- `humanizeKey(key)` - Convert `user.name` to "User Name"
- `ordinal(num)` - Convert 1 to "1st", 2 to "2nd", etc.

### Step 6: Testing Matrix

Test each tool with:
1. Loading state → Check action name shows loading text
2. Success state with typical output → Check contextual info appears
3. Error state → Check error message is clear
4. Edge cases:
   - Very long URLs (truncation)
   - Missing optional output fields
   - Empty strings
   - Special characters in text

## File Changes Summary

### New Files
1. `src/components/ui/ToolActionFormatter.tsx` - Action name formatting logic
2. `src/components/ui/ToolActionFormatter.test.ts` (optional) - Unit tests

### Modified Files
1. `src/components/ui/CompactToolCard.tsx` - Use formatter for display name
2. `src/ai/CompactToolRenderer.tsx` - Verify input/output passing (already ✓)

### Unchanged Files
- All action tool files (no changes needed!)
- Icon mapper (works with tool names, not display names)
- Styles (no changes needed)

## Implementation Order

1. ✅ Create `ToolActionFormatter.tsx` with base structure
2. ✅ Implement formatters for high-priority tools (navigate, search, read)
3. ✅ Update `CompactToolCard.tsx` to use formatter
4. ✅ Test with sample data
5. ✅ Implement remaining formatters (memory, tabs, interactions)
6. ✅ Handle edge cases and fallbacks
7. ✅ Final testing and refinement

## Fallback Strategy

If no formatter exists for a tool:
1. Convert camelCase to Title Case: `navigateTo` → "Navigate To"
2. Add state suffix: "Navigate To..." (loading) or "Navigate To ✓" (success)
3. Show input snippet if available

## Benefits

1. **User-Friendly**: Clear action descriptions instead of technical names
2. **Contextual**: Shows relevant info (URLs, counts, names) at a glance
3. **Progressive**: Can add formatters incrementally without breaking existing tools
4. **Maintainable**: Centralized formatting logic, not scattered across tool files
5. **Flexible**: Easy to customize formatting per tool
6. **Backward Compatible**: Falls back gracefully for undefined formatters
