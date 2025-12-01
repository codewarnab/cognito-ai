# Empty Response Feedback Loop - Implementation Options

## Problem

When the AI model returns `finishReason: 'stop'` with no text content and no tool calls, the conversation effectively stalls. The user sees nothing, and the AI doesn't retry.

```
[2025-12-01T09:29:06.645Z] [StreamCallbacks] [WARN] ⚠️ Empty response detected - model returned STOP with no content
```

## Current Behavior

The existing code in `streamCallbacks.ts`:
1. ✅ Detects empty responses
2. ✅ Tracks consecutive empty responses
3. ✅ Shows messages to the user
4. ❌ Does NOT provide feedback to the AI to retry

## Implementation Options

---

## Option 1: Throw Error to Trigger Feedback Loop (Recommended)

**Complexity**: Medium  
**Effectiveness**: High  
**Risk**: Low

### Concept

Throw a custom error when an empty response is detected. The `onError` callback in `aiLogic.ts` already supports returning feedback strings to the AI. We leverage this existing mechanism.

### Implementation Steps

#### Step 1: Create Custom Error Type

Add to `src/errors/errorTypes.ts`:

```typescript
/**
 * Error thrown when AI returns empty response (STOP with no content)
 * Used to trigger the feedback loop in onError callback
 */
export class EmptyResponseError extends Error {
  public readonly consecutiveCount: number;
  public readonly isRetryable: boolean = true;

  constructor(consecutiveCount: number) {
    super(`Model returned empty response (attempt ${consecutiveCount})`);
    this.name = 'EmptyResponseError';
    this.consecutiveCount = consecutiveCount;
  }
}
```

#### Step 2: Modify `streamCallbacks.ts` to Throw Error

In `createOnStepFinishCallback`, instead of just writing to the stream, throw the error:

```typescript
if (isEmptyResponse) {
  tracker.consecutiveEmptyCount++;
  tracker.lastEmptyTimestamp = Date.now();

  log.warn('⚠️ Empty response detected - triggering feedback loop', {
    consecutiveCount: tracker.consecutiveEmptyCount,
  });

  // Throw error to trigger onError callback feedback loop
  if (tracker.consecutiveEmptyCount <= 3) {
    throw new EmptyResponseError(tracker.consecutiveEmptyCount);
  }
  
  // After 3 attempts, let it fail gracefully with user message
  // (existing code to show user message)
}
```

#### Step 3: Handle in `aiLogic.ts` onError Callback

Add detection for `EmptyResponseError` in the `onError` callback:

```typescript
// Check if this is an empty response error (feedback loop)
if (errorMessage.includes('empty response') || 
    errorName === 'EmptyResponseError' ||
    errorObj?.consecutiveCount) {
  
  const attemptCount = errorObj?.consecutiveCount || 1;
  
  log.warn('🔄 EMPTY RESPONSE - Providing feedback to AI:', { attemptCount });

  // Create feedback based on attempt count
  let feedback: string;
  if (attemptCount === 1) {
    feedback = `Your previous response was empty. Please provide a complete response to the user's request. ` +
      `Make sure to either:\n` +
      `1. Answer the user's question with text, OR\n` +
      `2. Use an appropriate tool to help answer their question\n\n` +
      `Do not return an empty response.`;
  } else if (attemptCount === 2) {
    feedback = `Your response was empty again. The user is waiting for an answer. ` +
      `Please carefully read the conversation and provide a helpful response. ` +
      `If you're unsure what to do, ask the user for clarification.`;
  } else {
    feedback = `Multiple empty responses detected. Please provide ANY response - ` +
      `even if it's just to say you need more information or clarification from the user.`;
  }

  return feedback;
}
```

### Pros
- ✅ Uses existing feedback loop infrastructure
- ✅ AI receives context about what went wrong
- ✅ Configurable retry attempts
- ✅ Graceful degradation after max retries

### Cons
- ⚠️ Throwing errors in `onStepFinish` may have side effects
- ⚠️ Need to test thoroughly with AI SDK behavior

---

## Option 2: Inject System Message via `prepareStep`

**Complexity**: Low  
**Effectiveness**: Medium  
**Risk**: Low

### Concept

Use the `prepareStep` callback to inject a system prompt modification when empty responses are detected. Store state externally and check it in `prepareStep`.

### Implementation Steps

#### Step 1: Create Shared State Module

Create `src/ai/stream/emptyResponseState.ts`:

```typescript
interface EmptyResponseState {
  lastStepWasEmpty: boolean;
  consecutiveCount: number;
  sessionId: string;
}

const stateMap = new Map<string, EmptyResponseState>();

export function markEmptyResponse(sessionId: string): void {
  const state = stateMap.get(sessionId) || { 
    lastStepWasEmpty: false, 
    consecutiveCount: 0, 
    sessionId 
  };
  state.lastStepWasEmpty = true;
  state.consecutiveCount++;
  stateMap.set(sessionId, state);
}

export function clearEmptyResponse(sessionId: string): void {
  const state = stateMap.get(sessionId);
  if (state) {
    state.lastStepWasEmpty = false;
    state.consecutiveCount = 0;
  }
}

export function getEmptyResponseState(sessionId: string): EmptyResponseState | undefined {
  return stateMap.get(sessionId);
}

export function cleanupSession(sessionId: string): void {
  stateMap.delete(sessionId);
}
```

#### Step 2: Mark Empty Responses in `streamCallbacks.ts`

```typescript
import { markEmptyResponse, clearEmptyResponse } from './emptyResponseState';

// In createOnStepFinishCallback:
if (isEmptyResponse) {
  markEmptyResponse(trackerId);
  // ... existing logging
} else {
  clearEmptyResponse(trackerId);
}
```

#### Step 3: Modify System Prompt in `prepareStep`

In `aiLogic.ts`, modify the `prepareStep` callback:

```typescript
import { getEmptyResponseState, clearEmptyResponse } from '../stream/emptyResponseState';

prepareStep: async ({ stepNumber }) => {
  // ... existing code ...

  // Check for empty response from previous step
  const emptyState = getEmptyResponseState(sessionId);
  if (emptyState?.lastStepWasEmpty) {
    log.info('🔄 Previous step was empty - augmenting system prompt');
    
    const emptyResponseAddition = `\n\n[IMPORTANT: Your previous response was empty. ` +
      `You MUST provide a response this time. Either answer with text or use a tool.]`;
    
    // Clear the flag
    clearEmptyResponse(sessionId);
    
    return {
      ...existingPrepareStepResult,
      system: (existingPrepareStepResult?.system || enhancedPrompt) + emptyResponseAddition,
    };
  }

  // ... rest of existing prepareStep logic ...
}
```

### Pros
- ✅ Simple to implement
- ✅ No error throwing required
- ✅ Works within existing callback structure

### Cons
- ⚠️ `prepareStep` runs BEFORE the step, not after - timing may not work
- ⚠️ Requires external state management
- ⚠️ System prompt modification is less direct than error feedback

---

## Option 3: Post-Process Stream and Re-invoke

**Complexity**: High  
**Effectiveness**: High  
**Risk**: Medium

### Concept

After the stream completes, check if the response was empty. If so, append a user message asking for a response and re-invoke the streaming.

### Implementation Steps

#### Step 1: Create Re-invoke Logic in `aiLogic.ts`

```typescript
// After writer.merge() completes, check for empty response
const finalResult = await result;
const finalText = await result.text;
const finalToolCalls = await result.toolCalls;

if (!finalText?.trim() && (!finalToolCalls || finalToolCalls.length === 0)) {
  log.warn('🔄 Empty response detected - re-invoking with feedback');
  
  // Append a system message to the conversation
  const feedbackMessage: UIMessage = {
    id: generateId(),
    role: 'user',
    content: '[System: Your previous response was empty. Please provide a response.]',
    createdAt: new Date(),
  };
  
  // Re-invoke streaming with updated messages
  const retryMessages = [...messages, feedbackMessage];
  
  // Recursive call with retry flag
  return streamAIResponse({
    ...params,
    messages: retryMessages,
    _retryCount: (_retryCount || 0) + 1,
  });
}
```

#### Step 2: Add Retry Limit

```typescript
export async function streamAIResponse(params: {
  // ... existing params ...
  _retryCount?: number; // Internal retry counter
}) {
  const { _retryCount = 0 } = params;
  
  // Limit retries to prevent infinite loops
  if (_retryCount >= 3) {
    log.error('Max empty response retries reached');
    // Return stream with error message
    return createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({
          type: 'text-delta',
          id: 'max-retry-error-' + generateId(),
          delta: '⚠️ The model is unable to generate a response. Please try rephrasing your question.',
        });
      },
    });
  }
  
  // ... rest of function ...
}
```

### Pros
- ✅ Most direct feedback mechanism
- ✅ Guaranteed to send feedback to AI
- ✅ Full control over retry behavior

### Cons
- ⚠️ Complex implementation
- ⚠️ May cause UI flicker during re-invoke
- ⚠️ Need to handle streaming state carefully
- ⚠️ Recursive calls could be problematic

---

## Option 4: Use AI SDK's `experimental_continueSteps`

**Complexity**: Low  
**Effectiveness**: Medium  
**Risk**: Low

### Concept

The AI SDK has experimental features for continuing conversations. We could leverage these to automatically continue when responses are empty.

### Implementation Steps

#### Step 1: Check AI SDK Documentation

Research if `experimental_continueSteps` or similar features can be configured to handle empty responses.

#### Step 2: Configure in `streamText` Call

```typescript
return await streamText({
  model,
  messages: modelMessages,
  tools: abortableTools,
  system: enhancedPrompt,
  
  // Experimental: Continue if response is incomplete
  experimental_continueSteps: true,
  
  // Custom continue condition
  experimental_continueCondition: ({ text, toolCalls, finishReason }) => {
    // Continue if empty response
    if (finishReason === 'stop' && !text?.trim() && !toolCalls?.length) {
      return true; // Continue generating
    }
    return false;
  },
  
  // ... rest of config
});
```

### Pros
- ✅ Uses SDK's built-in mechanisms
- ✅ Minimal custom code
- ✅ May be more stable long-term

### Cons
- ⚠️ Experimental API may change
- ⚠️ May not exist or work as expected
- ⚠️ Less control over feedback content

---

## Recommendation

**Start with Option 1** (Throw Error to Trigger Feedback Loop):

1. It leverages the existing, tested feedback loop infrastructure
2. It provides clear feedback to the AI
3. It has configurable retry behavior
4. It fails gracefully after max attempts

If Option 1 causes issues with the AI SDK's error handling, **fall back to Option 2** (prepareStep modification), which is simpler but less direct.

---

## Testing Plan

For any option implemented:

1. **Trigger empty responses**: Find scenarios that cause the model to return empty
   - Very short/ambiguous prompts
   - Requests the model can't fulfill
   - Edge cases in tool usage

2. **Verify feedback is sent**: Check logs for feedback being returned

3. **Verify AI retries**: Confirm the AI receives feedback and attempts a proper response

4. **Test max retries**: Ensure graceful degradation after max attempts

5. **Test normal flow**: Ensure normal conversations aren't affected
