<!-- dabee429-8fca-450e-965c-2e7192d64a77 5881d3df-2ae3-4347-b73c-5eb6635b3e26 -->
# Tab Mention Feature Implementation Plan

## Overview

Based on the AI Browser Extension code analysis, the tab mention feature uses the syntax `@[TabName](tabId)` to reference browser tabs. When a user mentions a tab, the system automatically captures that tab's snapshot and passes it as additional context to the AI.

## How the Current System Works

### 1. Mention Syntax Format

- **Tab mentions**: `@[DisplayName](tabId)` - e.g., `@[Google](123)`
- **Tool mentions**: `#[DisplayName](toolName)` - e.g., `#[search](tab_snapshot)`

### 2. Data Flow

```12:15:assets/chunk-B98hL0ZC.js
// When user sends message with mentions (variable names: he=tabMentions, be=toolMentions)
if(he.length>0){
  const j=he.map(async X=>{
    const ie=parseInt(X.id,10);  // Extract tab ID
    const je=await pv(ie);        // Call tab snapshot function
    return `- @${X.display} (${je.url}):
```

### 3. Tab Context Injection

```23:25:assets/chunk-B98hL0ZC.js
Ce={id:crypto.randomUUID(),role:"user",content:`Tab Context for mentioned tabs:
${G}`,ts:Date.now(),internal:!0,parts:[{type:"text",text:`Tab Context for mentioned tabs:
${G}`}]}
```

The system creates an **internal message** (not visible to user) that contains the full HTML snapshot of mentioned tabs, which gets added to the conversation before the AI processes the user's message.

### 4. System Prompt Instructions

```70:76:ai-browser-extension-system-prompt.md
**Tab and Tool Mentions:**
- Users can mention specific browser tabs using @TabName syntax (e.g., @[Google](123))
- Users can mention specific tools using #ToolName syntax (e.g., #[search](tab_snapshot))
- **IMPORTANT**: When a user mentions a tab with @, you will receive an additional message with the full page snapshot from that tab
- The tab context is provided automatically - you don't need to call tab_snapshot for mentioned tabs
- Read and analyze the tab context provided before taking any actions
```

## Implementation Plan

### Phase 1: UI Components

#### 1.1 Mention Input Component

Create a rich text input component that:

- Detects `@` character input
- Triggers autocomplete dropdown
- Handles keyboard navigation (up/down arrows, Enter, Escape)
- Supports multiple mentions in one message
- Displays mentions as styled chips/badges in the input

**Key Features:**

- Listen for `@` keypress
- Show dropdown positioned below cursor
- Filter tabs by title as user types
- Insert mention in format: `@[TabTitle](tabId)`

#### 1.2 Tab Dropdown Menu

Create a dropdown component that:

- Fetches all open browser tabs using Chrome API
- Displays tab title, favicon, and URL
- Filters tabs based on search input
- Shows visual feedback on hover/selection
- Positions itself relative to the cursor position

**Data Structure:**

```typescript
interface Tab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
}
```

#### 1.3 Mention Display

Style mentioned tabs in the input:

- Show as clickable badges/chips
- Include tab title
- Allow removal by clicking X or pressing backspace
- Use distinct color (e.g., brand colors from branding guide)

### Phase 2: Mention Parsing

#### 2.1 Extract Mentions from Input

Create parser function:

```typescript
function extractMentions(text: string) {
  const tabMentionRegex = /@\[([^\]]+)\]\((\d+)\)/g;
  const toolMentionRegex = /#\[([^\]]+)\]\(([^\)]+)\)/g;
  
  const tabMentions = [];
  const toolMentions = [];
  
  let match;
  while ((match = tabMentionRegex.exec(text)) !== null) {
    tabMentions.push({ display: match[1], id: match[2] });
  }
  
  while ((match = toolMentionRegex.exec(text)) !== null) {
    toolMentions.push({ display: match[1], id: match[2] });
  }
  
  return { tabMentions, toolMentions };
}
```

#### 2.2 Validate Tab IDs

- Parse tab IDs as integers
- Validate tab still exists using Chrome Tabs API
- Handle errors gracefully (show "Tab no longer available")

### Phase 3: Tab Data Capture

#### 3.1 Snapshot Function

Create function to capture tab content:

```typescript
async function captureTabSnapshot(tabId: number) {
  try {
    // Use existing tab_snapshot tool/function (pv in the code)
    const snapshot = await executeTabSnapshot(tabId);
    
    return {
      url: snapshot.url,
      snapshot: snapshot.html, // Clean HTML content
      screenshot: snapshot.screenshot, // Optional
      error: null
    };
  } catch (error) {
    return {
      url: null,
      snapshot: null,
      screenshot: null,
      error: error.message
    };
  }
}
```

#### 3.2 Batch Processing

Process all mentioned tabs in parallel:

```typescript
async function processMentionedTabs(tabMentions) {
  const snapshots = await Promise.all(
    tabMentions.map(async (mention) => {
      const tabId = parseInt(mention.id, 10);
      const result = await captureTabSnapshot(tabId);
      
      if (result.error) {
        return `- @${mention.display}: ${result.error}`;
      }
      
      let content = `- @${mention.display} (${result.url}):\n\`\`\`\n${result.snapshot}\n\`\`\``;
      
      if (result.screenshot) {
        content += '\n\n[Screenshot available for this tab]';
      }
      
      return content;
    })
  );
  
  return snapshots.join('\n\n');
}
```

### Phase 4: AI Context Integration

#### 4.1 Create Internal Message

Before sending user message to AI, inject tab context:

```typescript
async function sendMessageWithMentions(userMessage: string) {
  const { tabMentions, toolMentions } = extractMentions(userMessage);
  
  // Add user message
  const userMsg = {
    id: generateId(),
    role: 'user',
    content: userMessage,
    ts: Date.now(),
    parts: [{ type: 'text', text: userMessage }]
  };
  
  // Create internal context message if tabs mentioned
  let contextMsg = null;
  if (tabMentions.length > 0) {
    const tabContext = await processMentionedTabs(tabMentions);
    contextMsg = {
      id: generateId(),
      role: 'user',
      content: `Tab Context for mentioned tabs:\n${tabContext}`,
      ts: Date.now(),
      internal: true, // Don't show to user in UI
      parts: [{ type: 'text', text: `Tab Context for mentioned tabs:\n${tabContext}` }]
    };
  }
  
  // Modify system prompt if tools mentioned
  let systemPrompt = buildSystemPrompt();
  if (toolMentions.length > 0) {
    const toolList = toolMentions.map(t => `- #${t.display} (${t.id})`).join('\n');
    systemPrompt += `\n\n[Note: User mentioned these tools:\n${toolList}]`;
  }
  
  // Send to AI with context
  return await callAI({
    messages: contextMsg ? [userMsg, contextMsg] : [userMsg],
    systemPrompt: systemPrompt
  });
}
```

#### 4.2 Message Array Management

- User message is visible in chat
- Context message is marked as `internal: true` (not displayed in UI)
- Both messages sent to AI for processing
- AI receives full context automatically

### Phase 5: Chrome Extension Integration

#### 5.1 Chrome Tabs API

Use Chrome API to fetch tabs:

```typescript
async function getAllTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.map(tab => ({
    id: tab.id,
    title: tab.title || 'Untitled',
    url: tab.url || '',
    favIconUrl: tab.favIconUrl
  }));
}
```

#### 5.2 Tab Snapshot Tool

Integrate with existing `tab_snapshot` tool:

- Reuse existing implementation (appears to be `pv` function in code)
- Captures clean HTML without scripts/styles
- Returns structured data with URL and content

### Phase 6: Error Handling

#### 6.1 Handle Missing Tabs

```typescript
// If tab no longer exists
if (isNaN(tabId)) {
  return `- @${mention.display}: Invalid tab ID`;
}

const tab = await chrome.tabs.get(tabId).catch(() => null);
if (!tab) {
  return `- @${mention.display}: Tab no longer available`;
}
```

#### 6.2 Handle Permission Errors

- Check if tab is accessible (not chrome:// URLs)
- Handle cross-origin restrictions
- Provide clear error messages to user

## Technical Architecture

### Component Structure

```
ChatInput
├── MentionInput (contenteditable or textarea with overlay)
├── MentionDropdown
│   ├── TabList
│   │   └── TabItem (title, favicon, url)
│   └── SearchFilter
└── MentionChip (rendered mentions)
```

### Data Flow Diagram

```
User types @ 
  → Detect trigger
  → Fetch tabs from Chrome API
  → Show dropdown with tabs
  → User selects tab
  → Insert @[TabName](tabId) into input
  → User sends message
  → Extract mentions from text
  → Capture tab snapshots (parallel)
  → Create internal context message
  → Send both messages to AI
  → AI processes with full context
```

## Key Implementation Files

Based on the build structure:

- **Main chat logic**: `assets/chunk-B98hL0ZC.js` (contains sendMessage logic)
- **System prompt**: `ai-browser-extension-system-prompt.md`
- **Sidepanel UI**: `sidepanel.html` + React components
- **Service worker**: `service-worker-loader.js` (handles Chrome API calls)

## Libraries/Tools Needed

1. **Mention input library**: Consider using:

   - `react-mentions` for mention autocomplete
   - `draft-js` or `lexical` for rich text editing
   - Or build custom with contenteditable

2. **Regex parsing**: Native JavaScript regex for mention extraction

3. **Chrome APIs**:

   - `chrome.tabs.query()` - Get all tabs
   - `chrome.tabs.get()` - Validate tab exists
   - Existing `tab_snapshot` tool - Capture content

## Success Criteria

1. ✅ User can type `@` to trigger tab dropdown
2. ✅ Dropdown shows all open tabs with title and favicon
3. ✅ User can filter tabs by typing
4. ✅ Selected tab inserts as `@[TabName](tabId)`
5. ✅ Multiple mentions supported in one message
6. ✅ Tab content automatically captured when message sent
7. ✅ AI receives tab context as internal message
8. ✅ Error handling for missing/inaccessible tabs
9. ✅ Mentions styled distinctly in input
10. ✅ Tool mentions with `#` also supported

## Future Enhancements

- Show tab preview on hover
- Support for mentioning specific elements within tabs
- History of frequently mentioned tabs
- Keyboard shortcuts for quick tab access
- Batch mention multiple tabs at once

### To-dos

- [ ] Create mention input component with @ trigger detection and autocomplete
- [ ] Build tab dropdown menu with search/filter and keyboard navigation
- [ ] Implement regex-based mention extraction from user input
- [ ] Create tab snapshot capture function using Chrome API and existing tools
- [ ] Build internal message system to inject tab context before AI processing
- [ ] Integrate all components into existing chat flow with error handling