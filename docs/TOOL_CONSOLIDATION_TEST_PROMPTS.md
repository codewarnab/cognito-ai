# Tool Consolidation Testing Prompts

## Purpose
This document contains 55 carefully designed test prompts to evaluate tool consolidation performance. Use these prompts to establish baseline metrics and compare post-consolidation performance.

---

## Test Categories

### Category 1: DOM Interaction Tests (10 prompts)

**Tests merged `domInteraction` tool actions: click, clickByText, focus, type, pressKey**

```
1. "Click the Sign In button"
   Expected: clickByText action with text="Sign In"
   
2. "Click the element with text 'Learn More'"
   Expected: clickByText action with text="Learn More"
   
3. "Type 'hello world' in the search box"
   Expected: type action with text="hello world", target="search box"
   
4. "Type 'john@example.com' in the email field and press enter"
   Expected: type action with text="john@example.com", target="email field", pressEnter=true
   
5. "Focus on the first input field"
   Expected: focus action with selector for first input
   
6. "Press the Escape key"
   Expected: pressKey action with key="Escape"
   
7. "Click the submit button using CSS selector #submit-btn"
   Expected: click action with selector="#submit-btn"
   
8. "Click any button that says 'Accept Cookies'"
   Expected: clickByText action with text="Accept Cookies"
   
9. "Type my name in the username field and click login"
   Expected: Multiple actions - type then clickByText
   
10. "Press Tab to move to the next field"
    Expected: pressKey action with key="Tab"
```

**Metrics to Track:**
- ✅ Correct action selected
- ✅ Correct parameters provided
- ⏱️ Response time
- 🔄 Number of retries

---

### Category 2: Memory Operation Tests (5 prompts)

**Tests merged `memoryOperation` tool actions: save, get, list, delete, suggest**

```
11. "Remember that my name is John"
    Expected: save action with key="user.name", value="John", category="fact"
    
12. "What's my name?"
    Expected: get action with key="user.name"
    
13. "List all things you remember about me"
    Expected: list action
    
14. "Forget my name"
    Expected: delete action with key="user.name"
    
15. "Suggest saving that I prefer dark mode"
    Expected: suggest action with suggestion about dark mode preference
```

**Metrics to Track:**
- ✅ Correct action selected
- ✅ Proper category assigned (fact vs behavior)
- ✅ Key canonicalization working
- 💬 User consent requested for save

---

### Category 3: Tab Operation Tests (7 prompts)

**Tests merged `tabOperation` tool actions: navigate, switch, getActive, getAll**

```
16. "Navigate to google.com"
    Expected: navigate action with url="google.com"
    
17. "Switch to the GitHub tab"
    Expected: switch action with url/title matching "GitHub"
    
18. "What's the current tab URL?"
    Expected: getActive action
    
19. "List all open tabs"
    Expected: getAll action
    
20. "Go to reddit.com in a new tab"
    Expected: navigate action with url="reddit.com", newTab=true
    
21. "Switch to the tab with 'YouTube' in the title"
    Expected: switch action with title matching "YouTube"
    
22. "What website am I on?"
    Expected: getActive action
```

**Metrics to Track:**
- ✅ Correct action selected
- ✅ URL parsing working
- ✅ Tab matching logic accurate

---

### Category 4: Content Reading Tests (5 prompts)

**Tests merged `contentReader` tool actions: readPage, getSelection, extractText**

```
23. "Read the page content"
    Expected: readPage action
    
24. "What text did I select?"
    Expected: getSelection action
    
25. "Extract the main heading from the page"
    Expected: extractText action with selector for h1
    
26. "Read the entire article on this page"
    Expected: readPage action with cleanHtml=true
    
27. "Get the text from the first paragraph"
    Expected: extractText action with selector for first p
```

**Metrics to Track:**
- ✅ Correct action selected
- ✅ Proper selector generation
- ✅ Content extraction accuracy

---

### Category 5: Search Operation Tests (5 prompts)

**Tests merged `searchOperation` tool actions: search, getResults, openResult**

```
28. "Search for 'best pizza near me'"
    Expected: search action with query="best pizza near me"
    
29. "Parse the search results from this Google page"
    Expected: getResults action with engine="google"
    
30. "Open the 3rd search result"
    Expected: openResult action with rank=3
    
31. "Search for React tutorials and open the first result"
    Expected: Multiple actions - search then openResult with rank=1
    
32. "What are the top 5 search results on this page?"
    Expected: getResults action
```

**Metrics to Track:**
- ✅ Correct action selected
- ✅ Sequential operations handled
- ✅ Ranking logic working

---

### Category 6: History Operation Tests (2 prompts)

**Tests merged `historyOperation` tool actions: search, getVisits**

```
33. "Search my history for GitHub"
    Expected: search action with query="GitHub"
    
34. "How many times have I visited reddit.com?"
    Expected: getVisits action with url="reddit.com"
```

**Metrics to Track:**
- ✅ Correct action selected
- ✅ Query formatting correct

---

### Category 7: Reminder Operation Tests (3 prompts)

**Tests merged `reminderOperation` tool actions: create, list, cancel**

```
35. "Remind me to take a break in 30 minutes"
    Expected: create action with message="take a break", delayMinutes=30
    
36. "List my reminders"
    Expected: list action
    
37. "Cancel my break reminder"
    Expected: cancel action with reminderId matching "break"
```

**Metrics to Track:**
- ✅ Correct action selected
- ✅ Time parsing accurate
- ✅ Reminder matching working

---

### Category 8: Report Generation Tests (3 prompts)

**Tests merged `reportGenerator` tool actions: generateMarkdown, generatePDF, getTemplate**

```
38. "Generate a markdown report about this page"
    Expected: generateMarkdown action
    
39. "Create a PDF report with the page content"
    Expected: generatePDF action
    
40. "Show me available report templates"
    Expected: getTemplate action
```

**Metrics to Track:**
- ✅ Correct action selected
- ✅ Content extraction working
- ✅ Format generation successful

---

### Category 9: Complex Multi-Step Tests (5 prompts)

**Tests tool combinations and sequential operations**

```
41. "Go to google.com, search for 'AI tools', open the first result, and remember that URL"
    Expected: 
    - tabOperation: navigate to google.com
    - domInteraction: type "AI tools" and press enter
    - searchOperation: openResult rank=1
    - memoryOperation: save URL
    
42. "Type 'hello' in the search box, press enter, then read the page content"
    Expected:
    - domInteraction: type "hello" with target="search box", pressEnter=true
    - contentReader: readPage
    
43. "Click the login button, type my email, type my password, and click submit"
    Expected:
    - domInteraction: clickByText "login"
    - domInteraction: type email
    - domInteraction: type password
    - domInteraction: clickByText "submit"
    
44. "List all my tabs, switch to GitHub, and remember the repository URL"
    Expected:
    - tabOperation: getAll
    - tabOperation: switch to GitHub
    - memoryOperation: save repo URL
    
45. "Search my history for YouTube, open the most visited video, and take a screenshot"
    Expected:
    - historyOperation: search "YouTube"
    - tabOperation: navigate to URL
    - takeScreenshot (standalone tool)
```

**Metrics to Track:**
- ✅ Correct sequence of tools
- ✅ Context maintained across steps
- ✅ All steps complete successfully
- 🔄 Number of retries needed

---

### Category 10: Error Recovery Tests (5 prompts)

**Tests error handling and graceful degradation**

```
46. "Click a button that doesn't exist"
    Expected: domInteraction attempts, returns helpful error
    
47. "Type in a field that isn't on the page"
    Expected: domInteraction attempts, suggests alternatives
    
48. "Remember something without asking permission first"
    Expected: AI should ask for permission before calling save action
    
49. "Delete a memory that doesn't exist"
    Expected: memoryOperation: delete with graceful error message
    
50. "Navigate to an invalid URL"
    Expected: tabOperation: navigate with validation error
```

**Metrics to Track:**
- ✅ Error detected correctly
- ✅ Helpful error messages
- ✅ No crashes or hangs
- 🔄 Recovery attempts

---

### Category 11: Ambiguous Prompts (5 prompts)

**Tests action selection with context-dependent prompts**

```
51. "Click it" 
    Context: User previously mentioned "the submit button"
    Expected: domInteraction: clickByText with text from context
    
52. "Type that" 
    Context: User previously said "type hello world"
    Expected: domInteraction: type with text from context
    
53. "Go there" 
    Context: Discussion about a specific website
    Expected: tabOperation: navigate with URL from context
    
54. "Remember this" 
    Context: User shared information in previous message
    Expected: memoryOperation: save with value from context
    
55. "Search for that" 
    Context: User mentioned a topic
    Expected: searchOperation: search with query from context
```

**Metrics to Track:**
- ✅ Context resolution working
- ✅ Correct action selected
- ✅ Parameters extracted from context
- 💬 Clarification requested when needed

---

## Test Execution Protocol

### Setup

1. **Clear State**
   - Clear all memories
   - Close extra tabs
   - Navigate to a test page (e.g., example.com)

2. **Recording Setup**
   - Enable logging
   - Clear console
   - Start timer

3. **Metrics Collection**
   - Tool name selected
   - Action selected (for merged tools)
   - Parameters provided
   - Response time (ms)
   - Success/failure
   - Error messages
   - Number of retries
   - Token count used

### Execution

For each prompt:

1. Send prompt to AI
2. Record which tool(s) called
3. Record parameters
4. Record response time
5. Verify expected behavior
6. Note any errors or retries
7. Save results to spreadsheet

### Comparison

**Baseline vs Post-Merger:**

| Metric | Baseline | Post-Merger | Change | Target |
|--------|----------|-------------|--------|--------|
| Success Rate | X% | Y% | ±Z% | ≥95% |
| Avg Response Time | Xms | Yms | ±Zms | ≤110% |
| Token Usage | X | Y | -Z% | -40% |
| Retries | X | Y | ±Z | ≤X |
| Tool Selection Accuracy | X% | Y% | ±Z% | ≥95% |

---

## Test Results Template

```markdown
## Test Run: [Baseline / Post-Merger]
**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** [Chrome version, OS]

### Prompt 1: "Click the Sign In button"
- ✅/❌ Success
- Tool: clickByText / domInteraction
- Action: [if applicable]
- Parameters: { text: "Sign In" }
- Response Time: Xms
- Retries: X
- Tokens: X
- Notes: [any observations]

[Repeat for all 55 prompts]

---

### Summary Statistics

**Overall:**
- Total Tests: 55
- Successful: X (X%)
- Failed: X (X%)
- Avg Response Time: Xms
- Avg Tokens: X
- Avg Retries: X

**By Category:**
- DOM Interactions: X/10 (X%)
- Memory Operations: X/5 (X%)
- Tab Operations: X/7 (X%)
- Content Reading: X/5 (X%)
- Search Operations: X/5 (X%)
- History Operations: X/2 (X%)
- Reminder Operations: X/3 (X%)
- Report Generation: X/3 (X%)
- Multi-Step: X/5 (X%)
- Error Recovery: X/5 (X%)
- Ambiguous: X/5 (X%)

**Top Issues:**
1. [Issue description] - X occurrences
2. [Issue description] - X occurrences
3. [Issue description] - X occurrences

**Recommendations:**
[Any adjustments needed based on results]
```

---

## Automated Testing Script Pseudo-code

```typescript
interface TestPrompt {
  id: number;
  category: string;
  prompt: string;
  expectedTool: string;
  expectedAction?: string;
  expectedParams?: Record<string, any>;
  context?: string;
}

interface TestResult {
  promptId: number;
  success: boolean;
  toolUsed: string;
  actionUsed?: string;
  params: Record<string, any>;
  responseTime: number;
  tokensUsed: number;
  retries: number;
  error?: string;
  notes?: string;
}

const testPrompts: TestPrompt[] = [
  {
    id: 1,
    category: "DOM Interaction",
    prompt: "Click the Sign In button",
    expectedTool: "domInteraction",
    expectedAction: "clickByText",
    expectedParams: { text: "Sign In" }
  },
  // ... all 55 prompts
];

async function runTestSuite(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  for (const testPrompt of testPrompts) {
    console.log(`Running test ${testPrompt.id}: ${testPrompt.prompt}`);
    
    const result = await runSingleTest(testPrompt);
    results.push(result);
    
    // Wait between tests
    await sleep(2000);
  }
  
  return results;
}

async function runSingleTest(test: TestPrompt): Promise<TestResult> {
  const start = performance.now();
  let retries = 0;
  let success = false;
  let toolUsed = '';
  let actionUsed = '';
  let params = {};
  let tokensUsed = 0;
  let error = '';
  
  try {
    // Send prompt to AI
    const response = await sendPromptToAI(test.prompt, test.context);
    
    // Extract tool call info
    toolUsed = response.toolCalls[0]?.name || '';
    params = response.toolCalls[0]?.arguments || {};
    actionUsed = params.action || '';
    tokensUsed = response.usage?.totalTokens || 0;
    retries = response.retryCount || 0;
    
    // Verify expectations
    success = verifyExpectations(test, { toolUsed, actionUsed, params });
    
  } catch (e) {
    error = String(e);
    success = false;
  }
  
  const responseTime = performance.now() - start;
  
  return {
    promptId: test.id,
    success,
    toolUsed,
    actionUsed,
    params,
    responseTime,
    tokensUsed,
    retries,
    error: error || undefined
  };
}

function verifyExpectations(
  test: TestPrompt,
  actual: { toolUsed: string; actionUsed?: string; params: any }
): boolean {
  // Check tool matches
  if (actual.toolUsed !== test.expectedTool) {
    return false;
  }
  
  // Check action matches (for merged tools)
  if (test.expectedAction && actual.actionUsed !== test.expectedAction) {
    return false;
  }
  
  // Check key parameters match
  if (test.expectedParams) {
    for (const [key, value] of Object.entries(test.expectedParams)) {
      if (actual.params[key] !== value) {
        return false;
      }
    }
  }
  
  return true;
}

function generateReport(results: TestResult[]): void {
  const totalTests = results.length;
  const successful = results.filter(r => r.success).length;
  const failed = totalTests - successful;
  const successRate = (successful / totalTests) * 100;
  
  const avgResponseTime = average(results.map(r => r.responseTime));
  const avgTokens = average(results.map(r => r.tokensUsed));
  const avgRetries = average(results.map(r => r.retries));
  
  console.log(`
╔═══════════════════════════════════════════════════════╗
║           TOOL CONSOLIDATION TEST REPORT              ║
╚═══════════════════════════════════════════════════════╝

Total Tests:        ${totalTests}
Successful:         ${successful} (${successRate.toFixed(1)}%)
Failed:             ${failed}
Avg Response Time:  ${avgResponseTime.toFixed(0)}ms
Avg Tokens:         ${avgTokens.toFixed(0)}
Avg Retries:        ${avgRetries.toFixed(2)}

By Category:
${generateCategoryBreakdown(results)}

Failed Tests:
${generateFailedTestsList(results)}
  `);
}

// Export results to CSV
function exportToCSV(results: TestResult[]): void {
  const csv = results.map(r => 
    `${r.promptId},${r.success},${r.toolUsed},${r.actionUsed || ''},${r.responseTime},${r.tokensUsed},${r.retries},"${r.error || ''}"`
  ).join('\n');
  
  fs.writeFileSync('test-results.csv', 
    'ID,Success,Tool,Action,ResponseTime,Tokens,Retries,Error\n' + csv
  );
}
```

---

## Success Criteria

### Must Pass (Critical)

- ✅ Overall success rate ≥ 95%
- ✅ No critical failures (crashes, hangs)
- ✅ DOM interaction success ≥ 95%
- ✅ Memory operation success ≥ 95%
- ✅ Tab operation success ≥ 95%

### Should Pass (Important)

- ✅ Token usage reduced by ≥ 40%
- ✅ Response time ≤ 110% of baseline
- ✅ Content reading success ≥ 90%
- ✅ Search operation success ≥ 85%
- ✅ Multi-step tests ≥ 80%

### Nice to Have

- ✅ Error recovery tests ≥ 80%
- ✅ Ambiguous prompts ≥ 70%
- ✅ Average retries reduced
- ✅ Tool selection accuracy ≥ 95%

---

## Next Steps

1. ✅ Review and approve test prompts
2. ✅ Set up testing environment
3. ✅ Run baseline tests (before consolidation)
4. ✅ Record baseline metrics
5. ✅ Implement consolidation
6. ✅ Run post-merger tests
7. ✅ Compare results
8. ✅ Make decision (proceed/rollback/refine)

---

**Document Version:** 1.0  
**Last Updated:** 2024-11-09  
**Status:** Ready for Testing
