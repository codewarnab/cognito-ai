# Tool Consolidation Quick Reference

## 📊 At a Glance

| Metric | Current | Proposed | Change |
|--------|---------|----------|--------|
| **Total Tools** | ~40 | ~12-15 | ⬇️ 60% |
| **Context Tokens** | ~14,000 | ~7,200 | ⬇️ 48% |
| **Success Rate** | ~92% | ~95%+ | ⬆️ 3% |
| **Implementation** | 3-4 weeks | - | - |

---

## 🎯 Consolidation Map

### ✅ TIER 1: Merge These

| New Tool | Merges | Count | Priority |
|----------|--------|-------|----------|
| `domInteraction` | clickElement, clickByText, focusElement, typeInField, pressKey | 5→1 | 🔥 High |
| `memoryOperation` | saveMemory, getMemory, listMemories, deleteMemory, suggestSaveMemory | 5→1 | 🔥 High |
| `tabOperation` | navigateTo, switchTabs, getActiveTab, getAllTabs | 4→1 | 🔥 High |
| `contentReader` | readPageContent, getSelectedText, extractText | 3→1 | 🔥 High |
| `searchOperation` | chromeSearch, getSearchResults, openSearchResult | 3→1 | 🔥 High |
| `historyOperation` | searchHistory, getUrlVisits | 2→1 | 🔥 High |
| `reminderOperation` | createReminder, listReminders, cancelReminder | 3→1 | 🔥 High |
| `reportGenerator` | generateMarkdown, generatePDF, getReportTemplate | 3→1 | 🔥 High |

**Total: 28 tools → 8 tools (⬇️ 71%)**

---

### 🟡 TIER 2: Maybe Merge

| New Tool | Merges | Count | Priority |
|----------|--------|-------|----------|
| `pageNavigation` | scrollPage, scrollIntoView, findSearchBar | 3→1 | 🟡 Medium |

---

### ⛔ Keep Separate

| Tool | Reason |
|------|--------|
| `takeScreenshot` | Standalone, unique capability |
| `executeBrowserAction` | Agent (wraps multiple tools) |
| `analyzeYouTubeVideo` | Agent (specialized) |
| `applyTabGroups` | Complex, specialized |
| `ungroupTabs` | Complex, specialized |
| `organizeTabsByContext` | AI-powered, complex |

---

## 🔧 Implementation Schemas

### domInteraction

```typescript
{
  name: "domInteraction",
  parameters: {
    action: enum[
      'click',        // Click by CSS selector
      'clickByText',  // Click by text search
      'focus',        // Focus element
      'type',         // Type in field
      'pressKey'      // Press special key
    ],
    // Action-specific params:
    selector?: string,
    text?: string,
    target?: string,
    key?: string,
    clearFirst?: boolean,
    pressEnter?: boolean,
    fuzzy?: boolean,
  }
}
```

### memoryOperation

```typescript
{
  name: "memoryOperation",
  parameters: {
    action: enum['save', 'get', 'list', 'delete', 'suggest'],
    key?: string,
    value?: string,
    category?: enum['fact', 'behavior'],
    source?: enum['user', 'task', 'system'],
  }
}
```

### tabOperation

```typescript
{
  name: "tabOperation",
  parameters: {
    action: enum['navigate', 'switch', 'getActive', 'getAll'],
    url?: string,
    tabId?: number,
    newTab?: boolean,
  }
}
```

### contentReader

```typescript
{
  name: "contentReader",
  parameters: {
    action: enum['readPage', 'getSelection', 'extractText'],
    selector?: string,
    cleanHtml?: boolean,
  }
}
```

### searchOperation

```typescript
{
  name: "searchOperation",
  parameters: {
    action: enum['search', 'getResults', 'openResult'],
    query?: string,
    rank?: number,
    engine?: enum['google', 'bing'],
  }
}
```

---

## 📈 Expected Performance

### Context Window Savings

```
Before: 40 tools × 350 tokens = 14,000 tokens
After:  12 tools × 600 tokens =  7,200 tokens
Saved:                          6,800 tokens (48%)
```

### Tool Selection Accuracy

```
Current: 40 options → ~92% accuracy
Proposed: 12 options → ~95% accuracy
Improvement: +3%
```

### Response Time

```
Expected: ≤110% of current (±10%)
Overhead: 1-2ms per tool call (negligible)
```

---

## 🧪 Testing Checklist

- [ ] Run 55 baseline prompts
- [ ] Collect baseline metrics
  - [ ] Success rate
  - [ ] Response time
  - [ ] Token usage
  - [ ] Retry count
- [ ] Implement Tier 1 mergers
- [ ] Run 55 post-merger prompts
- [ ] Compare metrics
- [ ] Decision: Proceed / Rollback / Refine

---

## ⚠️ Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Wrong action selected | ✅ Clear descriptions + examples |
| Performance degradation | ✅ Baseline testing |
| Breaking changes | ✅ Phased rollout |
| AI confusion | ✅ Discriminated unions |
| Developer complexity | ✅ Good documentation |

---

## 📅 Timeline

| Week | Tasks |
|------|-------|
| **Week 1** | Baseline testing, setup automation |
| **Week 2** | Implement domInteraction, memoryOperation, tabOperation, contentReader |
| **Week 3** | Implement searchOperation, historyOperation, reminderOperation, reportGenerator |
| **Week 4** | Integration testing, refinement, documentation |

---

## ✅ Success Criteria

**Must Have:**
- ✅ Success rate ≥ 95%
- ✅ Token reduction ≥ 40%
- ✅ No critical failures

**Should Have:**
- ✅ Response time ≤ 110%
- ✅ Tool selection accuracy ≥ 95%
- ✅ Multi-step tests ≥ 80%

**Nice to Have:**
- ✅ Error recovery ≥ 80%
- ✅ Ambiguous prompts ≥ 70%
- ✅ Reduced retries

---

## 🚀 Quick Start

1. **Review the plan:** `docs/TOOL_CONSOLIDATION_PLAN.md`
2. **Check test prompts:** `docs/TOOL_CONSOLIDATION_TEST_PROMPTS.md`
3. **Run baseline tests:** Use 55 prompts, record metrics
4. **Implement in order:** Start with domInteraction (highest impact)
5. **Test after each merger:** Verify no regressions
6. **Compare final results:** Must meet success criteria

---

## 📞 Decision Points

**After Baseline Testing:**
- ✅ Metrics collected?
- ✅ Test automation working?
- → **Proceed to implementation**

**After Each Tier 1 Merger:**
- ✅ Success rate maintained?
- ✅ No performance regression?
- → **Proceed to next merger** or **Rollback**

**After All Tier 1 Mergers:**
- ✅ Overall success rate ≥ 95%?
- ✅ Token reduction ≥ 40%?
- ✅ Response time ≤ 110%?
- → **Success! Deploy** or **Refine**

**Consider Tier 2:**
- ✅ Tier 1 showed positive results?
- ✅ Resources available?
- → **Implement Tier 2** or **Stop at Tier 1**

---

## 📝 Example Tool Usage

### Before (Current)

```typescript
// AI needs to choose from 5 different tools
AI chooses: clickByText
Parameters: { text: "Sign In" }
```

### After (Consolidated)

```typescript
// AI chooses 1 tool + action
AI chooses: domInteraction
Parameters: { 
  action: "clickByText", 
  text: "Sign In" 
}
```

**Same outcome, better organization!**

---

## 🎓 Key Insights

1. **Fewer tools = Better accuracy**
   - AI models perform better with fewer choices
   - Categories provide mental models

2. **Context matters more than tool count**
   - 48% context reduction is significant
   - More room for conversation history

3. **Action parameters work well**
   - Modern AI models handle discriminated unions
   - Clear examples prevent confusion

4. **Testing is critical**
   - Baseline metrics are essential
   - Real prompts reveal real issues
   - Data-driven decisions

5. **Phased approach reduces risk**
   - One category at a time
   - Quick rollback if needed
   - Learn from each step

---

## 🔗 Related Documents

- 📘 **Full Plan:** `docs/TOOL_CONSOLIDATION_PLAN.md`
- 🧪 **Test Prompts:** `docs/TOOL_CONSOLIDATION_TEST_PROMPTS.md`
- 📚 **Current Tools:** `src/actions/*/`
- 🏗️ **Tool Registry:** `src/ai/tools/registryUtils.ts`

---

**Last Updated:** 2024-11-09  
**Version:** 1.0  
**Status:** Ready to Implement
