# DOM Analyzer & Script Execution Implementation Plan

## 🎯 Problem Statement

**Current Issue**: When AI encounters tasks it doesn't have specific tools for (e.g., drawing a pelican in JS Paint), it fails because:
1. ✅ `pageContextExtractor.ts` provides initial page context (text, inputs, buttons, links)
2. ❌ No way to deeply analyze DOM structure with classes, IDs, data attributes
3. ❌ No way to execute custom JavaScript code on the page

**Goal**: Enable AI to:
- Deeply analyze DOM when no specific tool exists
- Execute arbitrary JavaScript on the page to accomplish tasks
- Handle complex interactions like canvas drawing, form manipulation, etc.

---

## 📊 Current Project Architecture Analysis

### Existing Tools Structure

```
src/actions/
├── interactions/
│   ├── click.tsx           - clickElement (CSS selector based)
│   ├── clickByText.tsx     - Smart text-based clicking
│   ├── typeInField.tsx     - Type in input fields
│   ├── text-extraction.tsx - extractText with structure analysis
│   ├── focus.tsx           - Focus elements
│   ├── scroll.tsx          - Scroll page
│   └── getSearchResults.tsx - Parse search results

src/utils/
├── pageContextExtractor.ts - Basic page context (text, inputs, buttons)
└── tabSnapshot.ts          - Tab content snapshot

Tool Registration Pattern:
1. Hook-based: useToolName() in action file
2. registerTool() from ai/tools/registry
3. Parameters: Zod schema validation
4. Execute: async function with chrome.scripting.executeScript
5. UI: CompactToolRenderer or custom renderer
```

### How chrome.scripting.executeScript Works

```typescript
// Pattern used across codebase:
const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [param1, param2], // Serializable arguments
    func: (arg1, arg2) => {
        // Code runs in page context
        // Has access to DOM, window, document
        // Returns serializable data
        return { success: true, data: result };
    }
});

const result = results[0]?.result;
```

### Current Limitations

| Feature | Status | Location |
|---------|--------|----------|
| Basic DOM extraction | ✅ Exists | `pageContextExtractor.ts` |
| Text extraction | ✅ Exists | `text-extraction.tsx` |
| Page structure analysis | ✅ Exists | `extractText` tool |
| Deep DOM analysis (classes, IDs, attributes) | ❌ Missing | - |
| Script execution | ❌ Missing | - |
| Canvas manipulation | ❌ Missing | - |
| Complex event handling | ❌ Missing | - |

---

## 🏗️ Multi-Phase Implementation Plan

## **PHASE 1: Deep DOM Analyzer Tool** ⭐ HIGH PRIORITY

### 1.1 Create Deep DOM Analyzer

**File**: `src/actions/dom/analyzeDom.tsx`

**Purpose**: Provide comprehensive DOM structure analysis with:
- Element tree with classes, IDs, data attributes
- Interactive element detection (canvas, video, audio, custom elements)
- Event listeners (where detectable)
- Shadow DOM analysis
- ARIA attributes and accessibility info

**Tool Definition**:
```typescript
{
  name: 'analyzeDom',
  description: `Deep analysis of page DOM structure. Use when no specific tool exists for a task.
  
  WHEN TO USE:
  - Finding specific elements by class/id/attribute
  - Understanding page structure for complex tasks
  - Before executing custom scripts
  
  RETURNS: Element tree with selectors, classes, IDs, attributes, event info`,
  
  parameters: {
    selector: string (optional) - Focus on specific element
    depth: number (default: 5) - How deep to analyze
    includeHidden: boolean (default: false) - Include hidden elements
    includeEventListeners: boolean (default: true) - Detect event listeners
    includeAttributes: boolean (default: true) - All data-* and custom attributes
  }
}
```

**Implementation Strategy**:
```typescript
// Phase 1.1: Core structure
- Element tree traversal (BFS or DFS)
- Collect: tagName, id, classes[], attributes{}
- Detect: onclick, event listeners (via getEventListeners if available)
- Shadow DOM recursion
- Return structured JSON tree

// Phase 1.2: Interactive elements
- Canvas detection with dimensions
- Video/audio with controls info
- Custom elements (<my-component>)
- Contenteditable regions

// Phase 1.3: Accessibility
- ARIA roles, labels, descriptions
- Focusable elements
- Tab order analysis
```

### 1.2 Update Prompts

**Files to Update**:
1. `src/ai/prompts/templates/remote.ts` - Add analyzeDom to tool list
2. `src/ai/prompts/utils.ts` - Add usage guidelines

**Prompt Addition**:
```
DOM ANALYSIS WORKFLOW:
When you don't have a specific tool for a task:
1. Use analyzeDom to understand page structure
2. Identify target elements (canvas, forms, custom components)
3. Get selectors, classes, IDs for interaction
4. Use executeScript to run custom code if needed

Example: Drawing on canvas
1. analyzeDom(selector='canvas') → get canvas ID and dimensions
2. executeScript to draw using canvas API
```

---

## **PHASE 2: Script Execution Tool** 🔥 CRITICAL

### 2.1 Create Execute Script Tool

**File**: `src/actions/dom/executeScript.tsx`

**Purpose**: Execute arbitrary JavaScript in page context
- Full access to DOM, window, document
- Canvas API, WebGL, custom libraries
- Event triggering, form manipulation
- Return structured results to AI

**Tool Definition**:
```typescript
{
  name: 'executeScript',
  description: `Execute JavaScript code in the active page context. Use for tasks without specific tools.
  
  WHEN TO USE:
  - Custom event triggering
  - Accessing page-specific APIs
  - Tasks requiring multiple DOM operations
  
  PRECONDITIONS:
  - Use analyzeDom first to understand page structure
  - Verify selectors and element existence
  
  SECURITY:
  - Runs in page context (has full access)
  - User must trust the code being executed
  
  EXAMPLE: Drawing on canvas
  executeScript(code="
    const canvas = document.querySelector('#canvas-id');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'blue';
    ctx.fillRect(10, 10, 100, 100);
  ")`,
  
  parameters: {
    code: string (required) - JavaScript code to execute
    returnValue: boolean (default: true) - Return execution result
    timeout: number (default: 5000) - Execution timeout in ms
  }
}
```

**Implementation Strategy**:

```typescript
// Phase 2.1: Basic execution
execute: async ({ code, returnValue = true, timeout = 5000 }) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [code, returnValue, timeout],
    func: (scriptCode, shouldReturn, timeoutMs) => {
      try {
        // Wrap in async function for await support
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fn = new AsyncFunction(scriptCode);
        
        // Execute with timeout
        const promise = fn();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Script timeout')), timeoutMs)
        );
        
        const result = await Promise.race([promise, timeoutPromise]);
        
        return {
          success: true,
          result: shouldReturn ? result : undefined,
          executed: true
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    }
  });
  
  return results[0]?.result;
}
```

### 2.2 Safety Considerations

**Security Layers**:
1. ⚠️ **User Consent**: Show script preview before execution
2. 🔒 **Sandboxing**: Runs in page context (already sandboxed by browser)
3. 📝 **Logging**: Log all script executions for debugging
4. ⏱️ **Timeout**: Prevent infinite loops (default 5s)
5. 🚫 **Blacklist**: Block dangerous APIs (optional future enhancement)

**UI Confirmation** (Optional):
```typescript
// Show script preview modal
const userConfirmed = await showScriptPreview(code);
if (!userConfirmed) {
  return { error: 'User cancelled script execution' };
}
```

### 2.3 Error Handling

```typescript
// Comprehensive error reporting
try {
  // execution
} catch (error) {
  log.error('Script execution failed', { error, code });
  return {
    error: error.message,
    type: error.constructor.name,
    lineNumber: extractLineNumber(error),
    suggestion: generateErrorSuggestion(error)
  };
}
```

---

## **PHASE 3: Integration & Prompts** 🔗

### 3.1 Register New Tools

**File**: `src/actions/registerAll.ts`

```typescript
import { registerDomActions } from "./dom";

export function useRegisterAllActions() {
  // ... existing registrations
  registerDomActions(); // Add new DOM tools
}
```

**File**: `src/actions/dom/index.ts` (new)

```typescript
import { useAnalyzeDomTool } from "./analyzeDom";
import { useExecuteScriptTool } from "./executeScript";

export function registerDomActions() {
  useAnalyzeDomTool();
  useExecuteScriptTool();
}
```

### 3.2 Update System Prompts

**File**: `src/ai/prompts/templates/remote.ts`

Add to `buildCapabilities()`:

```typescript
function buildCapabilities(): string {
  return `
CAPABILITIES:

... existing capabilities ...

📋 DOM ANALYSIS & SCRIPT EXECUTION:
- analyzeDom - Deep DOM structure analysis (classes, IDs, attributes, events)
- executeScript - Run JavaScript in page context for complex tasks

ADVANCED INTERACTION WORKFLOW:
When you encounter a task without a specific tool:

1. ANALYZE FIRST:
   - Use analyzeDom to understand page structure
   - Identify target elements (canvas, forms, custom components)
   - Get selectors, classes, IDs needed

2. PLAN APPROACH:
   - Determine what DOM operations are needed
   - Consider existing tools first (clickByText, typeInField)
   - Use executeScript only when necessary

3. EXECUTE:
   - Write clean, focused JavaScript code
   - Use specific selectors from analyzeDom
   - Handle errors gracefully
   - Return useful results

EXAMPLE - Drawing on Canvas:
User: "Draw a blue pelican on this canvas"

Step 1: analyzeDom(selector='canvas')
→ Returns: {id: 'paint-canvas', width: 800, height: 600, classes: ['main-canvas']}

Step 2: executeScript(code=`
  const canvas = document.getElementById('paint-canvas');
  const ctx = canvas.getContext('2d');
  
  // Draw pelican (simplified)
  ctx.fillStyle = '#4A90E2';
  ctx.beginPath();
  ctx.ellipse(400, 300, 50, 80, 0, 0, Math.PI * 2);
  ctx.fill();
  // ... more drawing code
  
  return { drawn: true, position: {x: 400, y: 300} };
`)
→ Returns: {success: true, result: {drawn: true, position: {...}}}

Step 3: Confirm to user with screenshot
`;
}
```

### 3.3 Add Error Recovery

**File**: `src/ai/prompts/templates/remote.ts` - Update `buildErrorRecovery()`

```typescript
"DOM INTERACTION FAILURES:",
"  1. Element not found → Use analyzeDom to find correct selector",
"  2. Script error → Check console output, fix syntax, retry",
"  3. Canvas not accessible → Verify canvas element exists and is visible",
"  4. Permission denied → Some pages block script execution (CSP)",
"",
"SCRIPT EXECUTION BEST PRACTICES:",
"  - Always use analyzeDom before executeScript",
"  - Use specific selectors (ID preferred over class)",
"  - Test with simple operations first",
"  - Return useful data for verification",
"  - Handle both success and error cases",
```

---

## **PHASE 4: UI Enhancements** 🎨

### 4.1 Tool Renderers

**File**: `src/components/ui/tools/formatters/formatters/dom.ts` (new)

```typescript
export const analyzeDomFormatter: ActionFormatter = ({ state, input, output }) => {
  if (state === 'loading') {
    return {
      action: 'Analyzing DOM structure',
      description: input?.selector || 'Full page'
    };
  }
  
  if (state === 'success') {
    const elementCount = output?.elementCount || 0;
    const depth = output?.depth || 0;
    return {
      action: 'DOM analyzed',
      description: `${elementCount} elements (depth: ${depth})`
    };
  }
  
  return { action: 'DOM analysis failed' };
};

export const executeScriptFormatter: ActionFormatter = ({ state, input, output }) => {
  if (state === 'loading') {
    return {
      action: 'Executing script',
      description: `${input?.code?.length || 0} characters`
    };
  }
  
  if (state === 'success') {
    return {
      action: 'Script executed',
      description: output?.result ? 'Returned result' : 'Completed'
    };
  }
  
  return { action: 'Script failed', description: output?.error };
};
```

### 4.2 Visual Feedback

Add visual indicators when scripts execute:
- 🔄 Loading spinner in toolbar
- ✅ Success flash animation
- ❌ Error indicator with details

---

## **PHASE 5: Testing & Validation** ✅

### 5.1 Test Cases

**Test 1: Canvas Drawing (JS Paint)**
```
User: "Draw a blue square on the canvas"
Expected:
1. analyzeDom(selector='canvas')
2. executeScript(code='canvas drawing code')
3. Verify drawing appears
```

**Test 2: Form Manipulation**
```
User: "Fill all inputs with random data"
Expected:
1. analyzeDom(selector='form')
2. executeScript(code='form filling code')
3. Verify inputs populated
```

**Test 3: Custom Element Interaction**
```
User: "Click the dropdown and select option 3"
Expected:
1. analyzeDom(selector='custom-dropdown')
2. executeScript(code='custom event triggering')
3. Verify selection changed
```

### 5.2 Error Handling Tests

- Script syntax error
- Element not found
- Timeout
- CSP blocked execution
- Invalid selector

---

## **PHASE 6: Documentation** 📚

### 6.1 Update Documentation

**Files to Create/Update**:
1. `docs/DOM_ANALYSIS_GUIDE.md` - How to use analyzeDom
2. `docs/SCRIPT_EXECUTION_GUIDE.md` - Safe script execution practices
3. `docs/ADVANCED_INTERACTIONS.md` - Complex task workflows

### 6.2 Example Scripts Library

Create `src/examples/scripts/` with common patterns:
- Canvas drawing
- Form manipulation
- Custom events
- Animation control
- Data extraction

---

## 📋 Implementation Checklist

### Phase 1: Deep DOM Analyzer
- [ ] Create `src/actions/dom/analyzeDom.tsx`
- [ ] Implement DOM tree traversal
- [ ] Add shadow DOM support
- [ ] Include event listener detection
- [ ] Add interactive element detection
- [ ] Create UI formatter
- [ ] Add icon to ToolIconMapper
- [ ] Write unit tests

### Phase 2: Script Execution
- [x] Create `src/actions/dom/executeScript.tsx`
- [x] Implement basic script execution
- [x] Add timeout mechanism
- [x] Add error handling with stack traces
- [x] Add safety warnings
- [x] Create UI formatter with preview
- [x] Add logging for debugging
- [ ] Write security tests

### Phase 3: Integration
- [x] Create `src/actions/dom/index.ts`
- [x] Update `src/actions/registerAll.ts`
- [x] Add to tool registry
- [x] Update `src/ai/prompts/templates/remote.ts`
- [x] Update `src/ai/prompts/utils.ts`
- [x] Add error recovery guidelines

### Phase 4: UI Enhancements
- [x] Create `src/components/ui/tools/formatters/formatters/dom.ts`
- [x] Add formatters to registry
- [x] Add icons to ToolIconMapper
- [x] Create visual feedback animations
- [ ] Add script preview modal (optional)

### Phase 5: Testing
- [ ] Test canvas drawing (JS Paint)
- [ ] Test form manipulation
- [ ] Test custom elements
- [ ] Test error scenarios
- [ ] Test timeout handling
- [ ] Test CSP blocking

### Phase 6: Documentation
- [ ] Write DOM analysis guide
- [ ] Write script execution guide
- [ ] Create example scripts library
- [ ] Update main README
- [ ] Add to FEATURES.md

---

## 🎯 Success Metrics

### Must Have:
- ✅ AI can analyze DOM structure deeply
- ✅ AI can execute JavaScript on pages
- ✅ Canvas drawing works (JS Paint test)
- ✅ Error handling prevents crashes
- ✅ Security warnings implemented

### Nice to Have:
- ✅ Script preview before execution
- ✅ Common script patterns library
- ✅ Visual feedback animations
- ✅ Comprehensive test coverage
- ✅ Detailed documentation

---

## 🚀 Quick Start Implementation Order

### Week 1: Core Functionality
1. **Day 1-2**: Implement `analyzeDom.tsx`
   - Basic DOM traversal
   - Element info collection
   - Testing with simple pages

2. **Day 3-4**: Implement `executeScript.tsx`
   - Basic script execution
   - Error handling
   - Timeout mechanism

3. **Day 5**: Integration
   - Register tools
   - Update prompts
   - Basic testing

### Week 2: Polish & Testing
1. **Day 6-7**: Advanced features
   - Shadow DOM support
   - Event listener detection
   - Interactive elements

2. **Day 8-9**: UI & UX
   - Tool formatters
   - Visual feedback
   - Error messages

3. **Day 10**: Testing & Documentation
   - JS Paint test
   - Documentation
   - Example scripts

---

## 💡 Future Enhancements

### Phase 7: Advanced Features (Post-Launch)
1. **Script Templates**: Pre-built scripts for common tasks
2. **Interactive Debugger**: Step-through script execution
3. **Performance Monitoring**: Track script execution time
4. **Script History**: Save and reuse successful scripts
5. **Multi-frame Support**: Execute in iframes
6. **Batch Operations**: Run scripts on multiple tabs

### Phase 8: AI Improvements
1. **Self-Learning**: AI learns from successful scripts
2. **Pattern Recognition**: Detect similar tasks
3. **Auto-optimization**: Suggest better approaches
4. **Confidence Scoring**: Rate likelihood of success

---

## ⚠️ Important Notes

### Security Considerations
1. **CSP**: Some sites block script injection (Content Security Policy)
2. **XSS Risk**: User must trust AI-generated code
3. **Permissions**: Already have scripting permission
4. **Sandboxing**: Executes in page context (browser sandbox)

### Performance Considerations
1. **DOM Size**: Large DOMs may slow analyzeDom
2. **Script Complexity**: Complex scripts may timeout
3. **Memory**: Canvas operations can be memory-intensive
4. **Rate Limiting**: Consider limiting script executions per minute

### Compatibility
1. **Chrome Version**: Requires Chrome 88+ (already required)
2. **Manifest V3**: Compatible with current setup
3. **CSP**: May fail on strict CSP sites
4. **Iframes**: Cross-origin iframes won't work

---

## 📞 Support & Debugging

### Common Issues

**Issue 1: Script Execution Blocked**
- Cause: CSP restrictions
- Solution: Inform user, suggest alternative approach
- Example: "This site blocks script execution. Try using clickByText instead."

**Issue 2: Element Not Found**
- Cause: Wrong selector or dynamic content
- Solution: Use analyzeDom first, wait for element
- Example: Add retry with delay

**Issue 3: Canvas Not Drawing**
- Cause: Canvas context locked or cleared
- Solution: Check canvas state, retry
- Example: Verify canvas exists and is visible

### Debug Mode

Add debug flag to see detailed execution:
```typescript
DEBUG_DOM_TOOLS=true // Show all DOM operations
DEBUG_SCRIPT_EXECUTION=true // Show script code and results
```

---

## 📈 Rollout Plan

### Beta Testing (Week 1-2)
- Internal testing on known sites
- JS Paint scenario verification
- Collect edge cases

### Limited Release (Week 3)
- Flag feature for opt-in users
- Monitor error rates
- Gather user feedback

### Full Release (Week 4)
- Enable for all users
- Update documentation
- Announce in changelog

---

## ✅ Acceptance Criteria

Before marking this plan complete:

1. ✅ AI can successfully draw on JS Paint canvas
2. ✅ DOM analysis returns actionable element info
3. ✅ Script execution handles errors gracefully
4. ✅ Security warnings are clear
5. ✅ Documentation is complete
6. ✅ Test suite passes 90%+
7. ✅ Performance meets targets (<2s for analyzeDom, <5s for executeScript)
8. ✅ No crashes or infinite loops
9. ✅ User feedback is positive
10. ✅ Code review approved

---

## 🎉 Expected Impact

### User Benefits
- ✅ Can accomplish ANY task on ANY page
- ✅ No more "I don't have a tool for that"
- ✅ Creative use cases (drawing, games, automation)
- ✅ Advanced users can leverage full browser capabilities

### Technical Benefits
- ✅ Fallback for edge cases
- ✅ Rapid prototyping of new interactions
- ✅ Reduced need for specific tools
- ✅ Better error recovery

### Business Benefits
- ✅ Differentiation from competitors
- ✅ Power user retention
- ✅ Reduced support tickets ("tool not found")
- ✅ Platform for innovation

---

**END OF PLAN**

Ready to implement when approved! 🚀
