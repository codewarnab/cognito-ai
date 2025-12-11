# Tool Error Feedback Loop Implementation

## Problem
When the AI attempts to call a tool that doesn't exist (e.g., `analyzeDom` instead of `readPageContent`), or passes invalid arguments to a tool, the conversation fails abruptly with an error instead of recovering.

## Solution
Implemented a **feedback loop** that catches tool-related errors and returns descriptive error messages to the AI, allowing it to see what went wrong and try again with the correct tools or parameters.

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

### 3. Invalid Tool Arguments Detection (`aiLogic.ts`)
- Detects Zod validation failures when AI passes wrong parameter types
- Matches error patterns:
  - "Invalid input for tool"
  - "Type validation failed"
  - "invalid_type"
- Extracts tool name and validation error details
- Provides clear guidance on expected parameter types (string, number, boolean, array)
- Returns feedback to AI so it can retry with correct types

### 4. Helper Functions (`streamHelpers.ts`)
- `createToolNotFoundFeedback()` - Generates error messages for unavailable tools
- `createInvalidToolArgumentsFeedback()` - Generates error messages for validation failures
- Both provide consistent, helpful error messages with guidance for the AI

## How It Works

### Tool Not Found - Before (Broken Flow):
```
User: "Analyze this page"
AI: calls analyzeDom() 
System: ❌ ERROR: Tool not found
→ Conversation stops
```

### Tool Not Found - After (Feedback Loop):
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

### Invalid Arguments - Before (Broken Flow):
```
User: "Get the last 5 posts"
AI: calls recent_posts({ count: 5 })  // Sends number instead of string
System: ❌ ERROR: Type validation failed
→ Conversation stops
```

### Invalid Arguments - After (Feedback Loop):
```
User: "Get the last 5 posts"
AI: calls recent_posts({ count: 5 })  // Sends number
System: ❌ Invalid arguments for tool "recent_posts".
        Validation errors:
        - Parameter "count": expected string, received number
        Please fix the parameter types and try again.
AI: calls recent_posts({ count: "5" }) ✅  // Sends string
System: Returns posts
AI: "Here are the 5 most recent posts..."
→ Conversation continues
```

## Testing Instructions

1. **Load the extension** with the updated code
2. **Test tool-not-found recovery:**
   - "Use analyzeDom to check this page"
   - "Call the getDomStructure tool"
3. **Test invalid arguments recovery:**
   - Navigate to a WebMCP-enabled site
   - Ask the AI to use a tool with intentionally wrong types
4. **Expected behavior:**
   - AI receives error feedback with guidance
   - AI should recover and retry with correct tool/parameters
   - Conversation continues without aborting

## Benefits

✅ **Graceful degradation** - Errors don't crash the conversation
✅ **Self-correction** - AI can learn from mistakes and try again
✅ **Better UX** - Users don't need to restart conversations
✅ **Debugging** - Tool errors are logged but don't stop execution
✅ **Flexibility** - Works for tool-not-found, execution errors, and validation errors

## Error Types Handled

| Error Type | Detection Pattern | Feedback Provided |
|------------|-------------------|-------------------|
| Tool Not Found | "unavailable tool", "AI_NoSuchToolError" | Lists available tools |
| Invalid Arguments | "Invalid input for tool", "Type validation failed" | Shows expected types, gives type guidance |
| Tool Execution Failed | Caught in execute wrapper | Returns error object with feedback |
| Malformed Function Call | "MALFORMED_FUNCTION_CALL" | Notifies user, logs for debugging |

## Code Locations

- **Tool wrapping**: `src/ai/stream/streamExecutor.ts`
- **Error detection**: `src/ai/core/aiLogic.ts` (onError callback ~lines 460-530)
- **Helper functions**: `src/ai/stream/streamHelpers.ts`
- **Empty response detection**: `src/ai/stream/streamCallbacks.ts`

## Empty Response Detection

The system also detects when the model returns STOP with no content (empty response):

**Location**: `src/ai/stream/streamCallbacks.ts`

**Behavior**:
- Tracks consecutive empty responses per session
- 1st empty: Shows "Processing your request..." message
- 2nd empty: Shows "Model returned empty response, attempting to continue..."
- 3rd+: Shows detailed error message with suggestions to rephrase

**Limitation**: Empty response detection currently only notifies the user - it cannot inject feedback into the AI's context to force a retry because the `onStepFinish` callback doesn't support return values for context injection.

## Related Files

- `src/ai/tools/registryUtils.ts` - Tool registration system
- `src/ai/stream/streamCallbacks.ts` - Stream lifecycle callbacks (empty response detection)
- `src/errors/errorTypes.ts` - Error type definitions
- `src/ai/tools/webmcpTools.ts` - WebMCP tool converter (also returns feedback on errors)
