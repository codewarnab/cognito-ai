# Tool Approval Configuration Analysis

Analysis of all extension tools to determine which require user approval and what website-specific options they should support.

---

## Summary

| Category | Total | Need Approval | Has Website Option |
|----------|-------|---------------|-------------------|
| Navigation | 7 | 1 | 1 |
| Page Interaction | 7 | 5 | 5 |
| Page Content | 4 | 1 | 1 |
| Search | 3 | 1 | 0 |
| Bookmarks | 7 | 2 | 0 |
| Reminders | 3 | 0 | 0 |
| Memory | 2 | 0 | 0 |
| Utilities | 1 | 0 | 0 |

---

## 🔴 High Risk - Requires Approval

### Navigation

| Tool | Needs Approval | Website Option | Domain Source | Notes |
|------|----------------|----------------|---------------|-------|
| `navigateTo` | ✅ **Yes** | ✅ **Yes** | Target URL | Already implemented |
| `switchTabs` | ❌ No | - | - | Just switches focus |
| `getActiveTab` | ❌ No | - | - | Read-only |
| `getAllTabs` | ❌ No | - | - | Read-only |
| `applyTabGroups` | ❌ No | - | - | Organizes existing tabs |
| `ungroupTabs` | ❌ No | - | - | Organizes existing tabs |
| `organizeTabsByContext` | ❌ No | - | - | Organizes existing tabs |

### Page Interaction

| Tool | Needs Approval | Website Option | Domain Source | Notes |
|------|----------------|----------------|---------------|-------|
| `typeInField` | ✅ **Yes** | ✅ **Yes** | Current tab URL | Types into form fields |
| `clickByText` | ✅ **Yes** | ✅ **Yes** | Current tab URL | Clicks elements (could submit forms) |
| `pressKey` | ✅ **Yes** | ✅ **Yes** | Current tab URL | Keyboard simulation |
| `focusElement` | ❌ No | - | - | Just focuses, no action |
| `scrollTo` | ❌ No | - | - | Visual only |
| `findSearchBar` | ❌ No | - | - | Read-only detection |
| `executeScript` | ✅ **Yes** | ✅ **Yes** | Current tab URL | **Highest risk** - runs arbitrary JS |

### Page Content

| Tool | Needs Approval | Website Option | Domain Source | Notes |
|------|----------------|----------------|---------------|-------|
| `takeScreenshot` | Yes  | ✅ **Yes** | Current tab URL | Privacy concern on sensitive pages |
| `readPageContent` | ❌  | - | - | Read-only |
| `extractText` | ❌ No | - | - | Read-only |
| `analyzeDom` | ❌ No | - | - | Read-only |

### Search

| Tool | Needs Approval | Website Option | Domain Source | Notes |
|------|----------------|----------------|---------------|-------|
| `chromeSearch` | ❌ No | - | - | Uses Chrome's built-in search |
| `getSearchResults` | ❌ No | - | - | Read-only |
| `openSearchResult` |  *No ** | ❌ No | - | Opens URL (similar to navigateTo) |

---

## 🟡 Medium Risk - Consider for Future

### Bookmarks

| Tool | Needs Approval | Website Option | Domain Source | Notes |
|------|----------------|----------------|---------------|-------|
| `createBookmark` | No | ❌ No | - | Creates data |
| `deleteBookmark` | No  | ❌ No | - | Deletes data |
| `updateBookmark` | ❌ No | - | - | Low risk modification |
| `searchBookmarks` | ❌ No | - | - | Read-only |
| `listBookmarks` | ❌ No | - | - | Read-only |
| `getBookmarkTree` | ❌ No | - | - | Read-only |
| `organizeBookmarks` | ❌ No | - | - | Reorganizes existing |

### Reminders

| Tool | Needs Approval | Website Option | Domain Source | Notes |
|------|----------------|----------------|---------------|-------|
| `createReminder` | ❌ No   | - | - | Local only |
| `listReminders` | ❌ No | - | - | Read-only |
| `cancelReminder` | ❌ No | - | - | Low impact |

---

## 🟢 Low Risk - No Approval Needed

### Memory (Supermemory)

| Tool | Needs Approval | Notes |
|------|----------------|-------|
| `addMemory` | ❌ No | User explicitly enables Supermemory |
| `searchMemories` | ❌ No | Read-only |

### Utilities

| Tool | Needs Approval | Notes |
|------|----------------|-------|
| `getYouTubeTranscript` | ❌ No | Read-only, fetches public data |
| `generatePDF` | ❌ No | Workflow-only, user-initiated |
| `getReportTemplate` | ❌ No | Workflow-only, read-only |

---

## Recommended Implementation Priority

### Phase 1 (Current) ✅
- [x] `navigateTo` - Opens external URLs

### Phase 2 (High Priority) 
- [ ] `executeScript` - **Highest risk**, runs arbitrary JavaScript
- [ ] `typeInField` - Can fill sensitive forms (passwords, payments)
- [ ] `clickByText` - Can submit forms, trigger purchases

### Phase 3 (Medium Priority)
- [ ] `pressKey` - Keyboard simulation

### Phase 4 (Optional)
- [ ] `takeScreenshot` - Privacy on sensitive pages

---

## Domain Extraction Patterns

```typescript
// Pattern 1: Target URL (navigateTo, openSearchResult)
extractDomain: (input) => {
  let url = input?.url;
  if (!url) return null;
  if (!url.includes('://')) url = 'https://' + url;
  return new URL(url).hostname;
}

// Pattern 2: Current Tab (typeInField, clickByText, executeScript)
extractDomain: async (_input, currentTabUrl) => {
  if (!currentTabUrl) return null;
  return new URL(currentTabUrl).hostname;
}
```
