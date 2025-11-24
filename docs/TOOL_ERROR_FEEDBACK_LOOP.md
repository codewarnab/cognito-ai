# Tool Error Feedback Loop Implementation

## Problem
When the AI attempts to call a tool that doesn't exist (e.g., `analyzeDom` instead of `readPageContent`), the conversation fails abruptly with an error instead of recovering.

## Solution
Implemented a **feedback loop** that catches unavailable tool calls and returns descriptive error messages to the AI, allowing it to see what went wrong and try again with the correct tools.

## Implementation Details

### 1. Tool Execution Error Handling (`streamExecutor.ts`)
- Wrapped all tool executions in try-catch blocks
- When a tool fails, instead of throwing an error:
  - Returns a structured error object: `{ error: true, message: string, toolName: string, feedback: string }`
  - Logs the failure for debugging
  - Provides context to help AI understand what went wrong

### 2. Tool-Not-Found Detection (`aiLogic.ts`)
- Enhanced the `onError` callback in the stream merge
- Detects errors that match patterns:
  - "Model tried to call unavailable tool"
  - "unavailable tool"
  - "AI_NoSuchToolError"
- Extracts the attempted tool name from the error message
- Generates helpful feedback listing available tools (first 15)
- Returns feedback string to AI SDK instead of throwing

### 3. Helper Function (`streamHelpers.ts`)
- Added `createToolNotFoundFeedback()` helper
- Generates consistent, helpful error messages
- Lists available tools (up to 20)
- Provides clear guidance to the AI

## How It Works

### Before (Broken Flow):
```
User: "Analyze this page"
AI: calls analyzeDom() 
System: ❌ ERROR: Tool not found
→ Conversation stops
```

### After (Feedback Loop):
```
User: "Analyze this page"
AI: calls analyzeDom()
System: ❌ Tool "analyzeDom" is not available.
        Available tools: readPageContent, getActiveTab, getAllTabs, ...
        Please choose from the available tools and try again.
AI: calls readPageContent() ✅
System: Returns page content
AI: "I've analyzed the page content..."
→ Conversation continues
```

## Testing Instructions

1. **Load the extension** with the updated code
2. **Ask the AI to use a non-existent tool:**
   - "Use analyzeDom to check this page"
   - "Call the getDomStructure tool"
3. **Expected behavior:**
   - AI receives error feedback listing available tools
   - AI should recover and use a valid tool (e.g., `readPageContent`)
   - Conversation continues without aborting

## Benefits

✅ **Graceful degradation** - Errors don't crash the conversation
✅ **Self-correction** - AI can learn from mistakes and try again
✅ **Better UX** - Users don't need to restart conversations
✅ **Debugging** - Tool errors are logged but don't stop execution
✅ **Flexibility** - Works for both tool-not-found and tool-execution errors

## Error Types Handled

1. **Tool Not Found**: AI calls a tool that isn't registered
2. **Tool Execution Failed**: Tool exists but throws during execution
3. **Invalid Parameters**: Tool receives wrong arguments (caught by Zod validation)

## Code Locations

- **Tool wrapping**: `src/ai/stream/streamExecutor.ts` (lines 51-104)
- **Error detection**: `src/ai/core/aiLogic.ts` (lines 283-306)
- **Helper function**: `src/ai/stream/streamHelpers.ts` (lines 95-110)

## Related Files

- `src/ai/tools/registryUtils.ts` - Tool registration system
- `src/ai/stream/streamCallbacks.ts` - Stream lifecycle callbacks
- `src/errors/errorTypes.ts` - Error type definitions
