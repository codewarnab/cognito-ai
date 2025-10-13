# Automatic Page Context for CopilotKit

## Summary
Modified the CopilotKit side panel to automatically provide the current page content to the AI assistant, eliminating the need for manual text selection. Also implemented proper chat clearing functionality.

## Changes Made

### 1. Added State for Page Content
```typescript
const [pageContent, setPageContent] = useState<{
    title: string;
    url: string;
    textContent: string;
    selectedText: string;
} | null>(null);
```

### 2. Auto-Fetch Page Content
Added a `useEffect` hook that:
- Fetches page content when the component mounts
- Re-fetches when the active tab changes
- Extracts up to 5000 characters of text content from the page
- Handles restricted URLs (chrome://, chrome-extension://)
- Listens to tab activation and update events

### 3. Provide Content via useCopilotReadable
Added a new `useCopilotReadable` hook that automatically shares:
- Page title
- Page URL
- Page text content (first 5000 characters)
- Currently selected text (if any)

This data is now always available to the AI agent without requiring user interaction.

### 4. Proper Chat Clear Functionality
Implemented proper message clearing using CopilotKit's `useCopilotMessagesContext`:
```typescript
const { setMessages } = useCopilotMessagesContext();

const handleClearChat = () => {
    setMessages([]);
};
```

This clears the chat history without reloading the page, providing a smooth user experience.

## How It Works

1. **Automatic Updates**: The page content is fetched automatically:
   - When the side panel loads
   - When you switch tabs
   - When a tab is updated (page navigation)

2. **Smart Handling**: 
   - Restricts access to chrome:// and extension pages
   - Limits text to 5000 characters to avoid overwhelming the AI
   - Gracefully handles errors

3. **Always Available**: The AI agent can now see:
   - What page you're currently viewing
   - The main text content of that page
   - Any text you have selected

## Implementation Details

The implementation follows the CopilotKit documentation pattern:
- Uses `useCopilotReadable` to provide context
- The context is automatically injected into the agent's runtime
- The agent can access this via `runtimeContext.get('ag-ui')`

## Benefits

1. **No Manual Selection Required**: Users don't need to select text first
2. **Contextual Awareness**: AI always knows what page you're on
3. **Seamless Experience**: Works automatically in the background
4. **Real-time Updates**: Updates when you switch tabs or navigate

## Future Enhancements

- Add user control to adjust the text limit
- Include metadata like page description, keywords
- Support for structured content extraction (headings, links, etc.)
- Option to include/exclude images and other media information
