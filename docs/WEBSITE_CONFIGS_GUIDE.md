# Website-Specific Configurations Guide

## Overview

The Chrome AI extension supports **website-aware AI behavior** through dynamic tool availability and prompt augmentation. This allows the AI to provide better, more focused assistance based on the website you're currently visiting.

## Current State

Currently, only the **base configuration** is active, which means:
- ✅ All general-purpose tools are available on every website
- ✅ The AI uses standard prompts without website-specific guidance
- ✅ The infrastructure is ready for website-specific configs to be added

## How It Works

### Architecture

```
User visits website
       ↓
websiteDetector detects URL
       ↓
Matches against registered configs (by priority)
       ↓
If match found → Use website-specific tools + prompts
If no match    → Use base config (all tools)
       ↓
AI receives filtered tools and augmented prompts
```

### Components

1. **`websiteDetector.ts`** - Detects current website and matches to configs
2. **`toolMapper.ts`** - Filters tools based on website config
3. **`promptAugmenter.ts`** - Adds website-specific prompts
4. **`sites/`** - Directory containing website configurations
5. **`types.ts`** - TypeScript types for configurations

---

## Adding a Website-Specific Configuration

### Step 1: Create Configuration File

Create a new file in `src/ai/prompts/website/sites/` for your website.

**Example: `google-docs.ts`**

```typescript
import type { WebsiteConfig } from '../types';

export const googleDocsConfig: WebsiteConfig = {
  // Unique identifier for this config
  id: 'google-docs',
  
  // Display name
  name: 'Google Docs',
  
  // URL patterns to match (can be multiple)
  // The URL must contain this string to match
  urlPatterns: [
    'docs.google.com/document/',
  ],
  
  // List of tool names allowed on this website
  // Only these tools will be available to the AI
  allowedTools: [
    // Reading/viewing tools
    'readPageContent',
    'screenshot',
    'getActiveTab',
    
    // Interaction tools
    'typeInField',
    'clickElement',
    'clickByText',
    'pressKey',
    
    // Navigation tools
    'scrollPage',
    
    // Add website-specific custom tools here
    // 'docsFormatText',
    // 'docsInsertImage',
  ],
  
  // Website-specific prompt instructions
  // This gets added to the system prompt when on this website
  promptAddition: `
🟢 GOOGLE DOCS DETECTED - DOCUMENT EDITING MODE

You are currently on Google Docs. You can create, edit, and format documents.

=== AVAILABLE TOOLS ===

typeInField
- Purpose: Type text into the document body
- When to use: Adding new content, editing existing text
- IMPORTANT: Click into document body first to ensure focus
- Example: typeInField({text: "Hello World", pressEnter: true})

clickByText
- Purpose: Click menu items by their visible text
- When to use: Accessing File, Edit, Insert, Format menus
- Examples: 
  * clickByText({text: 'Format'}) - Open Format menu
  * clickByText({text: 'Bold'}) - Make text bold

readPageContent
- Purpose: Read current document content and structure
- Returns: Document text, headings, formatting structure

=== COMMON WORKFLOWS ===

Adding a heading:
1. readPageContent (see current content)
2. clickElement (click into document)
3. typeInField({text: 'My Heading', pressEnter: true})
4. clickByText({text: 'Format'})
5. clickByText({text: 'Paragraph styles'})
6. clickByText({text: 'Heading 1'})
7. screenshot (verify result)

Making text bold:
1. Select text (click and drag or Shift+Arrow)
2. clickByText({text: 'Format'})
3. clickByText({text: 'Bold'})
4. Or use keyboard: pressKey({key: 'b', modifiers: ['Control']})

=== IMPORTANT NOTES ===

- Always click into document body before typing
- Use clickByText for menu navigation
- Verify changes with screenshot or readPageContent
- Some documents may be read-only
  `,
  
  // Priority determines matching order (higher = checked first)
  // Use 10 for most website-specific configs
  // Base config has priority 0
  priority: 10,
};
```

### Step 2: Export from sites/index.ts

Add your config to the exports:

```typescript
// src/ai/prompts/website/sites/index.ts
export { baseWebsiteConfig } from './base';
export { googleDocsConfig } from './google-docs';  // ← Add this
```

### Step 3: Register in websiteDetector.ts

Import and add to the registry:

```typescript
// src/ai/prompts/website/websiteDetector.ts
import type { WebsiteConfig, WebsiteToolContext } from './types';
import {
    baseWebsiteConfig,
    googleDocsConfig,  // ← Add import
} from './sites';

const websiteConfigs: WebsiteConfig[] = [
    googleDocsConfig,      // ← Add to array (before base)
    baseWebsiteConfig,     // Base always last
].sort((a, b) => (b.priority || 0) - (a.priority || 0));
```

### Step 4: Test Your Configuration

1. Navigate to the target website (e.g., Google Docs)
2. Open the extension side panel
3. Check the console logs - you should see:
   ```
   🌐 Detected website: Google Docs
   🔧 Website-aware configuration active
   ```
4. Verify that only the allowed tools are available
5. Check that the prompt additions appear in the AI's behavior

---

## Creating Website-Specific Tools

Sometimes you need specialized tools that only work on a specific website.

### Example: Google Sheets Cell Editor

**File: `src/actions/interactions/googleSheets.tsx`**

```typescript
import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';

export function useGoogleSheetsTools() {
    useEffect(() => {
        // Register a tool that only works on Google Sheets
        registerTool({
            name: "sheetsEditCell",
            description: "Edit a cell in Google Sheets by address (e.g., A1, B5)",
            parameters: z.object({
                cellAddress: z.string().describe('Cell address like "A1"'),
                value: z.string().describe('Value or formula to enter'),
            }),
            execute: async ({ cellAddress, value }) => {
                const [tab] = await chrome.tabs.query({ 
                    active: true, 
                    currentWindow: true 
                });
                
                if (!tab?.id) return { error: "No active tab" };

                // Use chrome.scripting to interact with the page
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    args: [cellAddress, value],
                    func: (cell, val) => {
                        // DOM manipulation code here
                        // This runs in the page context
                        const cellElement = document.querySelector(
                            `[aria-label^="${cell} "]`
                        );
                        
                        if (!cellElement) {
                            return { 
                                success: false, 
                                error: `Cell ${cell} not found` 
                            };
                        }
                        
                        // Click cell, type value, etc.
                        cellElement.click();
                        // ... more interaction code
                        
                        return { success: true };
                    }
                });

                return results[0]?.result || { error: "Failed" };
            },
        });
    }, []);
}
```

Then add to the website config:

```typescript
allowedTools: [
    'sheetsEditCell',  // ← Your custom tool
    'readPageContent',
    // ... other tools
],
```

And document it in the `promptAddition`:

```typescript
promptAddition: `
sheetsEditCell ⭐ RECOMMENDED
- Purpose: Edit any cell by address
- Parameters: cellAddress ("A1"), value (text or formula)
- Example: sheetsEditCell({cellAddress: "A1", value: "100"})
`,
```

---

## Best Practices

### URL Patterns

✅ **Good - Specific patterns**
```typescript
urlPatterns: [
    'docs.google.com/document/',      // Google Docs only
    'docs.google.com/spreadsheets/',  // Google Sheets only
]
```

❌ **Bad - Too broad**
```typescript
urlPatterns: [
    'google.com',  // Matches ALL Google sites
    'docs',        // Matches any URL with "docs"
]
```

### Tool Selection

**Include:**
- ✅ Tools that are essential for the website
- ✅ Tools that work reliably on the website
- ✅ Website-specific custom tools

**Exclude:**
- ❌ Tools that don't work on the website
- ❌ Tools that cause errors or conflicts
- ❌ Tools that are irrelevant to the website's purpose

### Prompt Additions

**Good prompt structure:**
```typescript
promptAddition: `
🟢 [WEBSITE NAME] DETECTED - [MODE DESCRIPTION]

=== AVAILABLE TOOLS ===

toolName
- Purpose: What it does
- When to use: When to use it
- Parameters: What params it accepts
- Example: Code example

=== COMMON WORKFLOWS ===

Task name:
1. Step 1
2. Step 2
3. Step 3

=== IMPORTANT NOTES ===

- Critical info
- Limitations
- Special considerations
`,
```

**Focus on:**
- ✅ Clear, actionable instructions
- ✅ Common workflows and examples
- ✅ Important limitations or gotchas
- ✅ Tool-specific guidance

**Avoid:**
- ❌ Generic information
- ❌ Overly verbose explanations
- ❌ Repeating base prompt information

### Priority Levels

- **10** - Website-specific configs (Google Docs, Sheets, etc.)
- **5** - Domain-specific configs (GitHub, LinkedIn, etc.)
- **0** - Base config (always last)

Higher priority configs are checked first, so more specific patterns should have higher priority.

---

## Examples

### Example 1: GitHub Configuration

```typescript
export const githubConfig: WebsiteConfig = {
  id: 'github',
  name: 'GitHub',
  urlPatterns: ['github.com'],
  allowedTools: [
    'readPageContent',
    'clickElement',
    'clickByText',
    'screenshot',
    'getActiveTab',
    'navigateTo',
    'scrollPage',
  ],
  promptAddition: `
🟢 GITHUB DETECTED - CODE REPOSITORY MODE

You can help users:
- Navigate repositories
- Read code files
- Analyze issues and PRs
- Extract repository information

Use readPageContent to extract:
- README content
- Code file content
- Issue/PR discussions
- Repository metadata
  `,
  priority: 5,
};
```

### Example 2: YouTube Configuration

```typescript
export const youtubeConfig: WebsiteConfig = {
  id: 'youtube',
  name: 'YouTube',
  urlPatterns: ['youtube.com/watch'],
  allowedTools: [
    'readPageContent',
    'screenshot',
    'clickElement',
    'scrollPage',
    'getYoutubeTranscript',  // Custom tool
  ],
  promptAddition: `
🟢 YOUTUBE DETECTED - VIDEO VIEWING MODE

getYoutubeTranscript
- Extracts video transcript/captions
- Returns timestamped text
- Works for videos with captions enabled

readPageContent
- Gets video title, description
- Reads comments
- Extracts channel information
  `,
  priority: 10,
};
```

---

## Troubleshooting

### Config Not Detecting

**Problem:** Your config isn't being detected on the target website.

**Solutions:**
1. Check URL pattern matches exactly: `console.log(window.location.href)`
2. Verify priority is higher than base (use 10)
3. Check config is imported and added to `websiteConfigs` array
4. Look for console errors in the extension

### Tools Not Available

**Problem:** Tools listed in `allowedTools` aren't working.

**Solutions:**
1. Verify tool name matches exactly (case-sensitive)
2. Check tool is registered in the tool registry
3. Ensure tool is imported/initialized in the app
4. Test the tool independently before adding to config

### Prompt Not Appearing

**Problem:** Website-specific prompt doesn't seem to affect AI behavior.

**Solutions:**
1. Check `promptAddition` is not empty
2. Verify `augmentSystemPrompt` is being called in `aiLogic.ts`
3. Look for the prompt in console logs (should show in prepareStep)
4. Test with a very obvious prompt change to confirm it's working

---

## Advanced Topics

### Dynamic Tool Registration

You can register tools at runtime:

```typescript
import { registerWebsiteConfig } from './websiteDetector';

registerWebsiteConfig({
  id: 'custom-site',
  name: 'My Custom Site',
  urlPatterns: ['mysite.com'],
  allowedTools: ['readPageContent'],
  promptAddition: 'Custom instructions...',
  priority: 10,
});
```

### Multiple URL Patterns

Match multiple URLs with one config:

```typescript
urlPatterns: [
  'docs.google.com/document/',
  'docs.google.com/edit',
  'drive.google.com/document',
],
```

### Conditional Tools

Enable tools based on page content:

```typescript
// In prepareStep callback (advanced)
const pageContent = await readPageContent();
if (pageContent.includes('edit')) {
  return { tools: editingTools };
} else {
  return { tools: viewingTools };
}
```

---

## Summary

To add a website-specific configuration:

1. ✅ Create config file in `sites/` folder
2. ✅ Define URL patterns, allowed tools, and prompt additions
3. ✅ Export from `sites/index.ts`
4. ✅ Import and register in `websiteDetector.ts`
5. ✅ Test on the target website
6. ✅ Optionally create website-specific custom tools

The infrastructure is ready - just add your configs and they'll work automatically! 🚀
