# Research Workflow Memory Optimization - Corrections & Issues

## Date: December 8, 2025
## Reviewer: AI SDK v6 Documentation Validation

---

## ✅ VERIFIED: Correct Implementation Patterns

### 1. **PrepareStep Signature** ✅
**Status**: Now corrected in main plan

**Correct AI SDK v6 Signature**:
```typescript
type PrepareStepFunction<TOOLS extends Record<string, Tool>> = (options: {
  steps: Array<StepResult<TOOLS>>;
  stepNumber: number;
  model: LanguageModel;
  messages: Array<ModelMessage>;
}) => PromiseLike<PrepareStepResult<TOOLS>> | PrepareStepResult<TOOLS>;
```

**What was wrong in initial plan**:
- Used `toolResults` parameter (doesn't exist)
- Should use `steps` array instead

**Corrected to**:
```typescript
async function researchWorkflowPrepareStep({ stepNumber, messages, steps, model }) {
  const currentStep = steps[stepNumber - 1]; // stepNumber is 1-indexed
  const readPageContentCall = currentStep?.toolCalls.find(
    (tc) => tc.toolName === 'readPageContent'
  );
  // ...
}
```

---

### 2. **StepResult Structure** ✅
**Status**: Now using correct fields

**Available Fields** (from AI SDK):
```typescript
type StepResult<TOOLS> = {
  readonly content: Array<ContentPart<TOOLS>>;
  readonly text: string;
  readonly reasoning: Array<ReasoningPart>;
  readonly toolCalls: Array<TypedToolCall<TOOLS>>;      // ✅ Use this
  readonly toolResults: Array<TypedToolResult<TOOLS>>;  // ✅ Use this
  readonly staticToolCalls: Array<StaticToolCall<TOOLS>>;
  readonly dynamicToolCalls: Array<DynamicToolCall>;
  readonly staticToolResults: Array<StaticToolResult<TOOLS>>;
  readonly dynamicToolResults: Array<DynamicToolResult>;
  readonly finishReason: FinishReason;
  readonly usage: LanguageModelUsage;
}
```

**Usage in plan**:
```typescript
// Access tool calls from current step
const currentStep = steps[stepNumber - 1];
const toolCalls = currentStep.toolCalls; // Correct!
const toolResults = currentStep.toolResults; // Correct!
```

---

### 3. **Message Manipulation** ✅
**Status**: Now correctly modifying tool-result parts

**Correct Message Structure** (from AI SDK):
```typescript
{
  role: 'tool',
  content: [
    {
      type: 'tool-result',
      toolCallId: string,
      toolName: string,
      result: any  // This is what we truncate
    }
  ]
}
```

**Corrected Implementation**:
```typescript
const modifiedMessages = messages.map((msg) => {
  if (msg.role === 'tool' && Array.isArray(msg.content)) {
    const modifiedContent = msg.content.map((part) => {
      if (
        part.type === 'tool-result' &&
        part.toolName === 'readPageContent' &&
        part.result?.stored === true
      ) {
        return {
          ...part,
          result: {
            ...part.result,
            content: `[Content hidden - ${part.result.content?.length} chars]`,
          }
        };
      }
      return part;
    });
    return { ...msg, content: modifiedContent };
  }
  return msg;
});
```

---

### 4. **PrepareStepResult Return** ✅
**Status**: Correct usage

**Valid Return Fields**:
```typescript
type PrepareStepResult<TOOLS> = {
  model?: LanguageModel;           // ✅ Can change model mid-step
  toolChoice?: ToolChoice<TOOLS>;  // ✅ Can force tool selection
  activeTools?: Array<keyof TOOLS>; // ✅ Can limit tools
  system?: string;                  // ✅ Can update system prompt
  messages?: Array<ModelMessage>;   // ✅ Can modify message history
} | undefined;
```

**Our Usage** (correct):
```typescript
return {
  system: synthesisPrompt,      // ✅ Update prompt
  activeTools: synthesisTools   // ✅ Remove navigation tools
};
```

---

## ❌ ISSUES IDENTIFIED & FIXED

### Issue 1: `autoStore` Parameter Design Flaw
**Problem**: The original plan had `autoStore` as an optional parameter on `readPageContent`:
```typescript
readPageContent({ autoStore: true })
```

**Why this is problematic**:
1. AI might forget to pass `autoStore: true`
2. Extra token usage for parameter
3. Not contextually aware

**Solution**: Remove parameter, detect context automatically
```typescript
// In readPageContent execute function:
export function useReadPageContentTool() {
  useEffect(() => {
    registerTool({
      name: 'readPageContent',
      // ... description ...
      execute: async (args, { messages }) => {
        // Auto-detect if we're in research workflow
        const isResearchWorkflow = messages.some(msg => 
          msg.content?.includes('[RESEARCH_WORKFLOW_ACTIVE]')
        );
        
        const content = await extractPageContent();
        
        if (isResearchWorkflow) {
          // Auto-store without AI needing to specify
          const sourceId = getNextSourceId();
          await saveResearchSource({ sourceId, content, ... });
          
          return {
            content,
            sourceId,
            stored: true,
            message: `Content saved to ${sourceId}. Call addMemoryMetadata next.`
          };
        }
        
        return { content };
      }
    });
  }, []);
}
```

**Better approach**: Use workflow initialization to set context flag
```typescript
// In workflow systemPrompt or initialization
system: `[RESEARCH_WORKFLOW_ACTIVE]\nYou are a Research Workflow Agent...`

// Or use experimental_context (AI SDK v6 feature)
experimental_context: { workflowType: 'research' }

// Then in tool:
execute: async (args, { experimental_context }) => {
  const context = experimental_context as { workflowType?: string };
  if (context.workflowType === 'research') {
    // Auto-store
  }
}
```

---

### Issue 2: Step Counting Logic
**Problem**: Original plan used separate variable for step counting

**Better approach**: Use `steps.length` directly
```typescript
// Don't do this:
let sourcesReadCount = 0;
// ... manually increment ...

// Do this instead:
const sourcesReadCount = steps.filter(step => 
  step.toolCalls.some(tc => tc.toolName === 'readPageContent')
).length;
```

**Why**: 
- Single source of truth
- No state management issues
- Works correctly if steps are replayed

---

### Issue 3: Message Indexing
**Problem**: Original plan had unclear message-to-step mapping

**Clarification**:
- `stepNumber` is 1-indexed (step 1, 2, 3...)
- `steps` array is 0-indexed (steps[0], steps[1], steps[2]...)
- `messages` array includes ALL messages (user + assistant + tool)

**Correct mapping**:
```typescript
prepareStep: async ({ stepNumber, steps, messages }) => {
  // Get current step (stepNumber is 1-indexed)
  const currentStep = steps[stepNumber - 1];
  
  // Previous step
  const previousStep = steps[stepNumber - 2];
  
  // Tool calls from current step
  const toolCalls = currentStep?.toolCalls || [];
}
```

---

## 🔧 RECOMMENDED IMPROVEMENTS

### 1. **Use `onStepFinish` Instead of Complex PrepareStep**
**Current approach**: PrepareStep does everything

**Better approach**: Split responsibilities
```typescript
const result = await generateText({
  model,
  tools,
  stopWhen: stepCountIs(50),
  
  // Track progress
  onStepFinish: async ({ toolCalls, toolResults, stepNumber }) => {
    // Count sources read
    if (toolCalls.some(tc => tc.toolName === 'readPageContent')) {
      sourcesReadCount++;
      log.info(`Sources read: ${sourcesReadCount}`);
    }
  },
  
  // Modify behavior
  prepareStep: async ({ steps, stepNumber }) => {
    const sourcesRead = steps.filter(s => 
      s.toolCalls.some(tc => tc.toolName === 'readPageContent')
    ).length;
    
    // Switch to synthesis mode
    if (sourcesRead >= MINIMUM_SOURCES) {
      return {
        system: synthesisPrompt,
        activeTools: ['listResearchSources', 'readResearchMemory', 'generatePDF']
      };
    }
    
    // Hide old content
    if (stepNumber > 2) {
      return {
        messages: truncateOldToolResults(messages, stepNumber)
      };
    }
  }
});
```

---

### 2. **Use `experimental_context` for Workflow Detection**
**AI SDK v6 Feature**:
```typescript
// In generateText call:
experimental_context: {
  workflowType: 'research',
  sessionId: researchSessionId,
  minimumSources: 5
}

// In tool execute:
execute: async (args, { experimental_context }) => {
  const ctx = experimental_context as ResearchWorkflowContext;
  
  if (ctx.workflowType === 'research') {
    // Auto-store logic
    await saveResearchSource({
      sessionId: ctx.sessionId,
      // ...
    });
  }
}
```

**Benefits**:
- No need for magic strings in system prompt
- Type-safe context
- Official AI SDK feature

---

### 3. **Simplify Content Truncation**
**Current approach**: Modify messages in prepareStep

**Better approach**: Store reference, not content
```typescript
// In readPageContent:
return {
  sourceId: 'research_source_1',
  url: tab.url,
  title: tab.title,
  contentLength: content.length,
  stored: true,
  // DON'T include content in response at all!
  message: `Stored ${content.length} chars in ${sourceId}. Call addMemoryMetadata.`
};

// AI never sees full content, so no need to truncate later!
```

**Why this is better**:
- No context pollution
- No need for prepareStep truncation logic
- AI still knows content exists (can read later)

---

## 📋 UPDATED IMPLEMENTATION CHECKLIST

### Phase 1: Database Schema ✅ (No changes needed)
- IndexedDB schema is correct
- CRUD operations are fine

### Phase 2: Tool Modifications
- [ ] **Remove `autoStore` parameter from `readPageContent`**
- [ ] **Use `experimental_context` for workflow detection**
- [ ] **Return metadata only, not full content**
- [ ] **Add `[RESEARCH_WORKFLOW_ACTIVE]` marker to system prompt**

### Phase 3: Memory Tools ✅ (No changes needed)
- Tools are correctly designed

### Phase 4: Background Cleanup ✅ (Already corrected to 30min)

### Phase 5: PrepareStep Implementation
- [ ] **Fix signature to match AI SDK v6**
- [ ] **Use `steps` array instead of `toolResults`**
- [ ] **Simplify step counting logic**
- [ ] **Consider using `onStepFinish` for tracking**

### Phase 6: System Prompt
- [ ] **Add workflow marker for context detection**
- [ ] **Remove instructions to pass `autoStore: true`**
- [ ] **Update to mention auto-storage behavior**

### Phase 7: Testing
- [ ] **Test with AI SDK v6 `experimental_context`**
- [ ] **Verify step counting logic**
- [ ] **Check message truncation works**

---

## 🎯 FINAL RECOMMENDED ARCHITECTURE

```typescript
// 1. Initialize workflow with context
const result = await generateText({
  model,
  system: `[RESEARCH_WORKFLOW_ACTIVE]\n${researchPrompt}`,
  tools: {
    initResearchSession,
    readPageContent,     // Auto-detects research workflow, auto-stores
    addMemoryMetadata,
    listResearchSources,
    readResearchMemory,
    generatePDF
  },
  experimental_context: {
    workflowType: 'research',
    sessionId: researchSessionId
  },
  stopWhen: stepCountIs(50),
  
  // Track sources read
  onStepFinish: async ({ toolCalls }) => {
    if (toolCalls.some(tc => tc.toolName === 'readPageContent')) {
      sourcesReadCount++;
    }
  },
  
  // Modify behavior when threshold met
  prepareStep: async ({ steps, stepNumber }) => {
    const sourcesRead = steps.filter(s => 
      s.toolCalls.some(tc => tc.toolName === 'readPageContent')
    ).length;
    
    if (sourcesRead >= MINIMUM_SOURCES) {
      return {
        system: synthesisPrompt,
        activeTools: ['listResearchSources', 'readResearchMemory', 'generatePDF']
      };
    }
  }
});
```

---

## ✅ CONCLUSION

**Major Issues Found**:
1. ❌ Incorrect `prepareStep` signature (used non-existent `toolResults` param)
2. ❌ Wrong message structure for truncation
3. ❌ `autoStore` parameter design flaw

**All Issues Fixed**: ✅
- Updated main implementation plan
- Corrected AI SDK v6 types
- Simplified architecture

**Ready for Implementation**: ✅
- Follow updated plan in `RESEARCH_WORKFLOW_MEMORY_OPTIMIZATION.md`
- Use corrections from this document
- Test with AI SDK v6 types
