<!-- 9a7f7ad1-251a-4568-a17d-d1458635ab17 21b51365-3384-4cff-97f1-b548b910fc84 -->
# Consolidate Chrome Extension Copilot Actions

## Current Problem

The extension has 8 specific actions (getActiveTab, searchTabs, openTab, getSelectedText, readPageContent, clickElement, scrollPage, fillInput) that get stuck sometimes due to limited flexibility.

## Proposed Solution

Consolidate into **3 powerful actions**:

### 1. **getDOMSnapshot** - Comprehensive DOM Analysis

**Purpose**: Provide full page structure with all selectors needed for interaction

**Parameters**:

- `scope` (optional): "full" | "interactive" | "forms" | "custom"
- `customSelector` (optional): CSS selector to limit scope
- `includeStyles` (optional): boolean - include computed styles
- `maxDepth` (optional): number - DOM tree depth limit

**Returns**:

```typescript
{
  url: string;
  title: string;
  viewport: { width, height, scrollY, scrollHeight };
  elements: Array<{
    selector: string;           // CSS selector
    xpath: string;              // XPath
    tagName: string;
    id?: string;
    className?: string[];
    attributes: Record<string, string>;
    textContent?: string;
    isVisible: boolean;
    isInteractive: boolean;
    boundingBox?: { x, y, width, height };
    computedStyles?: Record<string, string>;
  }>;
  forms: Array<{
    selector: string;
    inputs: Array<{ selector, type, name, placeholder }>;
  }>;
  interactiveElements: {
    buttons: Array<{ selector, text, ariaLabel }>;
    links: Array<{ selector, href, text }>;
    inputs: Array<{ selector, type, name, placeholder }>;
  };
}
```

**Implementation Notes**:

- Default to "interactive" scope for performance
- Cache results for 5 seconds to avoid repeated calls
- Limit to 1000 elements max, provide warning if truncated

### 2. **executePageScript** - Universal JavaScript Execution

**Purpose**: Execute any JavaScript on the page for maximum flexibility

**Parameters**:

- `code` (required): string - JavaScript code to execute
- `args` (optional): array - Arguments to pass to the script
- `returnResult` (optional): boolean - Whether to return execution result
- `async` (optional): boolean - Execute as async function

**Returns**:

```typescript
{
  success: boolean;
  result?: any;              // Return value from script
  error?: string;            // Error message if failed
  executionTime?: number;    // Milliseconds
  logs?: string[];           // Console output (optional)
}
```

**Implementation Notes**:

- Wrap user code in try-catch for error handling
- Support both sync and async execution
- Timeout after 30 seconds
- Return serializable results only (JSON-compatible)
- Example usage patterns in action description:
  - Click element: `document.querySelector(selector).click()`
  - Fill input: `document.querySelector(selector).value = 'text'`
  - Scroll: `window.scrollTo({top: 0, behavior: 'smooth'})`
  - Custom logic: Multi-line complex operations

### 3. **manageTab** - Tab Operations (Keep Separate)

**Purpose**: Consolidated tab management (simpler than DOM/JS actions)

**Parameters**:

- `action` (required): "getActive" | "search" | "open" | "close" | "switch"
- `query` (optional): string - For search action
- `url` (optional): string - For open action
- `tabId` (optional): number - For switch/close actions

**Returns**: Tab information based on action type

## Migration Strategy

### Step 1: Create New Action Functions

- Add `getDOMSnapshot` action (lines 77-240 in sidepanel.tsx)
- Add `executePageScript` action (lines 241-404)
- Add `manageTab` action (consolidate lines 77-156)

### Step 2: Update useCopilotReadable

- Update capabilities list to reflect new actions (lines 46-68)
- Remove old action names, add new powerful actions
- Update descriptions to guide AI on when to use each

### Step 3: Remove Old Actions

- Remove: `getSelectedText`, `readPageContent`, `clickElement`, `scrollPage`, `fillInput`
- Keep logic available through new actions

### Step 4: Add Helper Functions

Create utility functions for common DOM operations:

```typescript
// In executePageScript, provide common patterns
const commonPatterns = {
  click: `document.querySelector('${selector}').click()`,
  fill: `document.querySelector('${selector}').value = '${value}'`,
  scroll: `window.scrollTo({top: ${amount}, behavior: 'smooth'})`,
  getSelected: `window.getSelection()?.toString()`,
  // etc.
};
```

## Key Benefits

1. **No More Getting Stuck**: AI can write custom JS for edge cases
2. **Better DOM Understanding**: Full snapshot provides complete context
3. **Flexibility**: Handle any scenario with executePageScript
4. **Performance**: Cache DOM snapshots, reduce redundant calls
5. **Debugging**: Better error messages and execution feedback

## Files to Modify

- `c:\Users\User\code\hackathons\chrome-ai\src\sidepanel.tsx` (main refactoring)
- Consider extracting action definitions to separate files for maintainability:
  - `src/actions/domSnapshot.ts`
  - `src/actions/executeScript.ts`
  - `src/actions/tabManagement.ts`

## Testing Strategy

After implementation, test with scenarios that previously got stuck:

- Complex form filling with dynamic fields
- Clicking hidden/shadow DOM elements
- Multi-step interactions requiring state
- Edge cases with unusual selectors

### To-dos

- [ ] Implement getDOMSnapshot action with configurable scope and element filtering
- [ ] Implement executePageScript action with error handling and timeout protection
- [ ] Create manageTab action consolidating getActiveTab, searchTabs, openTab
- [ ] Update useCopilotReadable to reflect new action capabilities and remove old action names
- [ ] Remove deprecated specific actions (getSelectedText, readPageContent, clickElement, scrollPage, fillInput)
- [ ] Test with previously stuck scenarios to validate improved flexibility