# AI SDK Issue: Gemini Tool Name Validation

> **For:** Contributing to Vercel AI SDK  
> **Repository:** https://github.com/vercel/ai  
> **Package:** `@ai-sdk/google`

---

## Problem Summary

Gemini API rejects tool/function names that start with numbers. The AI SDK's Google provider does not sanitize tool names before sending to the API, causing requests to fail with:

```
AI_APICallError: * GenerateContentRequest.tools[0].function_declarations[5].name: Invalid function name.
Must start with a letter or an underscore. Must be alphanumeric (a-z, A-Z, 0-9),
underscores (_), dots (.), colons (:), or dashes (-), with a maximum length of 64.
```

### Real-World Example

MCP tools like `21st_magic_component_builder` fail because they start with `21st`.

---

## Gemini Function Naming Rules

From the error message, valid function names must:

1. **Start with** a letter (`a-z`, `A-Z`) or underscore (`_`)
2. **Contain only** alphanumeric chars, underscores, dots, colons, dashes
3. **Maximum length** of 64 characters

---

## Proposed Fix

### Location

`packages/google/src/google-generative-ai-language-model.ts` (or wherever tools are converted for the Gemini API)

### Implementation

```typescript
/**
 * Sanitize tool/function names for Gemini compatibility.
 * Gemini requires names to start with a letter or underscore.
 */
function sanitizeFunctionName(name: string): string {
    let sanitized = name;
    
    // If name starts with a digit, prefix with "fn_"
    if (/^[0-9]/.test(sanitized)) {
        sanitized = `fn_${sanitized}`;
    }
    
    // Replace any invalid characters with underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9_.:-]/g, '_');
    
    // Ensure max length of 64
    if (sanitized.length > 64) {
        sanitized = sanitized.substring(0, 64);
    }
    
    return sanitized;
}
```

### Integration Points

1. **When preparing tools for API call:**
   - Create a mapping: `sanitizedName -> originalName`
   - Send sanitized names to Gemini

2. **When receiving tool calls from Gemini:**
   - Map the sanitized name back to original name
   - Execute the correct tool

3. **Emit a warning** when sanitization occurs so users are aware:
   ```typescript
   console.warn(`[ai-sdk/google] Tool name "${originalName}" was sanitized to "${sanitizedName}" for Gemini compatibility`);
   ```

---

## Affected Files (Estimated)

Based on standard AI SDK structure:

| File | Change |
|------|--------|
| `packages/google/src/google-generative-ai-language-model.ts` | Add sanitization when building tool declarations |
| `packages/google/src/map-google-generative-ai-finish-reason.ts` | May need to map tool names back on response |
| `packages/google/src/convert-to-google-generative-ai-messages.ts` | Handle any tool result mapping |

---

## Test Cases

```typescript
describe('tool name sanitization', () => {
    it('prefixes names starting with digits', () => {
        expect(sanitizeFunctionName('21st_component')).toBe('fn_21st_component');
        expect(sanitizeFunctionName('123test')).toBe('fn_123test');
    });

    it('preserves valid names', () => {
        expect(sanitizeFunctionName('myTool')).toBe('myTool');
        expect(sanitizeFunctionName('_private')).toBe('_private');
        expect(sanitizeFunctionName('tool.v2')).toBe('tool.v2');
    });

    it('replaces invalid characters', () => {
        expect(sanitizeFunctionName('tool@name')).toBe('tool_name');
        expect(sanitizeFunctionName('my tool')).toBe('my_tool');
    });

    it('truncates long names', () => {
        const longName = 'a'.repeat(100);
        expect(sanitizeFunctionName(longName).length).toBe(64);
    });
});
```

---

## GitHub Issue Template

### Title
`[google] Automatically sanitize tool names that start with numbers`

### Body
```markdown
### Description
When using tools with names that start with numbers (e.g., `21st_magic_component` from MCP servers), Gemini API rejects the request with "Invalid function name" error.

### Expected Behavior
The Google provider should automatically sanitize tool names to comply with Gemini's naming rules, similar to how other providers may handle this.

### Actual Behavior
Request fails with:
\`\`\`
AI_APICallError: * GenerateContentRequest.tools[0].function_declarations[5].name: Invalid function name.
\`\`\`

### Proposed Solution
Add automatic sanitization in the Google provider:
1. Prefix names starting with digits with `fn_`
2. Replace invalid characters with underscores
3. Maintain internal mapping for tool result routing

### Environment
- AI SDK version: v4.x / v5.x / v6.x
- Provider: @ai-sdk/google
```

---

## Workaround (Current)

In our codebase, we implemented sanitization at the application level in:
- **Backend:** `packages/backend-vercel/src/routes/ai/chat.ts` (lines 118-128)
- **Frontend:** `apps/extension/src/ai/stream/streamExecutor.ts` (lines 15-55)

This works but requires every consumer to implement their own sanitization.

---

## Priority

**Medium-High** - This affects any MCP tool or dynamically named tool that may start with a number. As MCP adoption grows, more tools will have arbitrary names.

---

## Additional Complexity: HITL Pattern & Name Mapping

### The Hidden Problem

When implementing sanitization at the application level, we discovered a **critical issue**: the sanitized name sent to Gemini is what the model returns in tool calls, but other parts of the system (approval UI, tool execution, metadata lookups) may only know the **original** name.

This breaks Human-In-The-Loop (HITL) patterns where:
1. Tools are registered without an `execute` function (AI SDK waits for `addToolResult`)
2. UI must identify the tool to show approval buttons
3. After approval, the correct executor must be looked up and invoked

### The Flow That Breaks

```
Registration (original name)     AI Call (sanitized name)      Lookup (fails!)
        │                                  │                         │
        ▼                                  ▼                         ▼
"21st_magic_component"  ──────►  "fn_21st_magic_component"  ──────►  ???
        │                                                            │
   Stored in                                              isMcpTool() returns false
   metadata map                                           getMcpToolExecutor() returns undefined
```

### Required Solution: Bidirectional Name Mapping

Any sanitization implementation must:

1. **Register both name variants** when tools are discovered:
   ```typescript
   // Register original
   registerToolServer(originalName, serverId);
   registerMcpToolExecutor(originalName, executor);
   
   // Also register sanitized variant
   const sanitizedName = sanitizeToolName(originalName);
   if (sanitizedName !== originalName) {
       registerToolServer(sanitizedName, serverId);
       registerMcpToolExecutor(sanitizedName, executor);
   }
   ```

2. **OR maintain a reverse mapping** and translate before lookups:
   ```typescript
   function getOriginalToolName(name: string): string {
       // Check if name has fn_ prefix followed by digit
       if (/^fn_[0-9]/.test(name)) {
           return name.substring(3); // Remove 'fn_' prefix
       }
       return name;
   }
   ```

3. **Preserve mapping through entire lifecycle:**
   - Tool registration → Gemini API call → Tool call response → UI rendering → Approval → Execution → Result mapping

### Implementation in AI SDK

If this is fixed in `@ai-sdk/google`, the SDK should:

1. **Maintain an internal `Map<sanitizedName, originalName>`** during the request
2. **Apply reverse mapping** when processing tool calls in the response
3. **Ensure `toolCall.toolName` exposed to user code uses the original name**
4. **Handle `addToolResult` with either original or sanitized name**

This ensures user code never sees sanitized names and existing HITL patterns continue to work.

### Updated Affected Files

| File | Change |
|------|--------|
| `packages/google/src/google-generative-ai-language-model.ts` | Add sanitization + maintain name mapping |
| `packages/google/src/convert-to-google-generative-ai-messages.ts` | Apply reverse mapping on tool results |
| `packages/ai-core/src/types.ts` | Potentially add `originalToolName` to tool call types |

---

## Updated GitHub Issue Template

### Title
`[google] Automatically sanitize and map tool names that start with numbers`

### Body
```markdown
### Description
When using tools with names that start with numbers (e.g., `21st_magic_component` from MCP servers), Gemini API rejects the request with "Invalid function name" error.

Additionally, any sanitization must preserve the **original tool name** in responses so that Human-In-The-Loop patterns (tools without `execute` functions that use `addToolResult`) continue to work.

### Expected Behavior
1. The Google provider should automatically sanitize tool names to comply with Gemini's naming rules
2. Tool calls returned from Gemini should have the **original** tool name, not the sanitized one
3. `addToolResult` should accept either original or sanitized names

### Actual Behavior
Request fails with:
\`\`\`
AI_APICallError: * GenerateContentRequest.tools[0].function_declarations[5].name: Invalid function name.
\`\`\`

### Proposed Solution
1. Prefix names starting with digits with `fn_` before sending to Gemini
2. Maintain internal `Map<sanitizedName, originalName>` during the request
3. Map tool names back to original in the response before exposing to user code
4. Accept either name variant in `addToolResult`

### Use Case: HITL Pattern
Many MCP implementations use HITL where tools require user approval:
- Tool registered without `execute` function
- AI SDK waits for `addToolResult` to be called
- UI code uses tool name to look up metadata and show approval UI
- If tool name is sanitized but lookup only has original, the flow breaks

### Environment
- AI SDK version: v6.x
- Provider: @ai-sdk/google
```

