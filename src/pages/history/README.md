# History Search Page

## Overview

A fully accessible, performant on-device semantic search interface for browsing history. Built with React, it provides semantic search, domain filtering, date ranges, privacy controls, and keyboard navigation - all meeting WCAG AA accessibility standards.

## Architecture

### File Structure

```
src/pages/history/
├── index.tsx              # Main HistoryPage component
├── components.tsx         # Reusable UI components
├── types.ts              # TypeScript type definitions
├── useSettings.ts        # Settings management hook
├── useHistorySearch.ts   # Search with Port connection & debouncing
├── useKeyboardNav.ts     # Roving tabindex & keyboard shortcuts
├── useVirtualWindow.ts   # Manual virtualization for large lists
└── history.css           # CSS variables & responsive styles
```

### Key Features

#### 1. **Semantic Search**
- Debounced search (280ms) to avoid excessive queries
- Streaming results via Chrome runtime Port
- Progressive rendering of search chunks
- 10-second timeout with retry capability

#### 2. **Filters**
- **Date Range**: Presets (Today, 7d, 30d, All) + custom range
- **Domain Filter**: Multi-select with dynamic chips
- Active filter display with clear-all option

#### 3. **Privacy Controls**
- Pause/resume collection toggle with persistent state
- Clear index with confirmation modal
- Visual banners for paused state & model readiness

#### 4. **Keyboard Navigation** (WCAG AA)
- `↑/↓`: Navigate items
- `←/→`: Collapse/expand groups
- `Enter`: Open focused item (Shift = current tab, Ctrl = background)
- `Home/End`: Jump to first/last
- `Esc`: Clear focus
- `/`: Focus search (reserved)

#### 5. **Accessibility**
- Full ARIA labels, roles, and live regions
- Roving tabindex for keyboard navigation
- High contrast mode support
- Screen reader announcements for state changes
- Focus management (auto-focus first result after search)

#### 6. **Performance**
- Virtual scrolling for 5000+ groups
- Manual windowing (12-20 groups in DOM)
- Memoized components & callbacks
- Lazy expansion (show top 3 items, expand on demand)

#### 7. **Theming**
- CSS variables for light/dark mode
- `prefers-color-scheme` detection
- Brand colors from main `style.css`
- Consistent spacing, typography, shadows

## Component API

### `<HistoryPage />`
Main container integrating all hooks and components.

**State:**
- `query`, `dateRange`, `domains`: Filter state
- `groupsWithExpansion`: Groups with local expansion state
- `toasts`: Notification queue

**Hooks:**
- `useSettings()`: Model readiness, pause state, clear index
- `useHistorySearch()`: Port connection, debounced search, streaming
- `useKeyboardNav()`: Roving focus, keyboard shortcuts
- `useVirtualWindow()`: Virtualized rendering

---

### Hooks

#### `useSettings()`
Manages settings via `chrome.runtime.sendMessage`.

**Returns:**
```ts
{
  modelReady: boolean;
  paused: boolean;
  domainAllowlist: string[];
  domainDenylist: string[];
  loading: boolean;
  error: string | null;
  setPaused(paused: boolean): Promise<void>;
  clearIndex(): Promise<void>;
  updateFilters(allowlist?, denylist?): Promise<void>;
  refresh(): Promise<void>;
}
```

**Messages:**
- `GET_SETTINGS` → `SETTINGS {data}`
- `SET_PAUSED {paused}` → `CLEAR_OK` | `ERROR`
- `CLEAR_INDEX` → `CLEAR_OK` | `ERROR`

---

#### `useHistorySearch(options)`
Connects to `history-search` Port, sends debounced queries.

**Options:**
```ts
{
  query: string;
  dateRange: { start: number | null; end: number | null };
  domains: string[];
  limit?: number;
  offset?: number;
}
```

**Returns:**
```ts
{
  groups: HistoryResultGroup[];
  total: number;
  isSearching: boolean;
  error: string | null;
  refresh(): void;
}
```

**Port Messages:**
- Send: `{ type: 'SEARCH', payload: SearchFilters }`
- Receive:
  - `{ type: 'SEARCH_RESULT', chunk: Group[], total: number, final?: boolean }`
  - `{ type: 'SEARCH_DONE' }`
  - `{ type: 'SEARCH_ERROR', message: string }`

---

#### `useKeyboardNav(options)`
Manages focus state and keyboard event handling.

**Options:**
```ts
{
  groups: HistoryResultGroup[];
  onOpenItem(url, newTab?, background?): void;
  onOpenGroup(groupIndex): void;
  onToggleExpand(groupIndex): void;
  enabled?: boolean;
}
```

**Returns:**
```ts
{
  focusedGroupIndex: number;
  focusedItemIndex: number;
  setFocusedGroupIndex(index): void;
  setFocusedItemIndex(index): void;
  resetFocus(): void;
  handleKeyDown(e: React.KeyboardEvent): void;
}
```

---

#### `useVirtualWindow(options)`
Manual virtualization for large result lists.

**Options:**
```ts
{
  groups: HistoryResultGroup[];
  containerHeight: number;
  itemHeight: number; // Average height per group
  overscan?: number;
}
```

**Returns:**
```ts
{
  virtualItems: VirtualItem[]; // { index, group, offsetTop }
  totalHeight: number;
  scrollToIndex(index): void;
  measurementRef: RefObject<HTMLDivElement>;
}
```

---

### Components

#### `<HeaderBar title>`
Sticky header with title and children (search, filters, controls).

#### `<SearchInput value onChange onSubmit? placeholder? disabled?>`
Text input with clear button, debounced handling, ARIA labels.

#### `<FiltersBar dateRange domains onDateChange onDomainsChange disabled?>`
Container for date and domain filters with accessible labels.

#### `<DateFilter dateRange onChange disabled?>`
Date preset buttons (Today, 7d, 30d, All). Custom range TBD.

#### `<DomainFilter domains onChange suggestions? disabled?>`
Chip list + input for adding domains. Accessible removal.

#### `<PrivacyControls paused onPauseToggle onClearIndex disabled?>`
Toggle switch for pause/resume; button for clear index with modal.

#### `<ResultsSummary total groupCount activeFilters onClearFilters>`
Live region showing result count and active filters.

#### `<ResultGroup group groupIndex focusedItemIndex onToggleExpand onOpenGroup onItemClick onItemFocus>`
Expandable group with header (domain, count, open-all) and item list.

#### `<ResultItem item focused onClick onFocus>`
Single result with title, snippet, URL; roving tabindex.

#### `<EmptyState type onResume?>`
Contextual empty states: `no-results`, `model-not-ready`, `paused`, `no-query`.

#### `<ToastContainer toasts onClose>`
Fixed bottom-right toast stack with slide-in animation.

#### `<Banner type message action?>`
Full-width alert banner (info, warning, error) with optional action button.

#### `<LoadingSkeleton count?>`
Shimmer placeholders for loading state.

---

## Messaging Contracts

### Settings Messages
**Request:**
```ts
{ type: 'GET_SETTINGS' }
{ type: 'SET_PAUSED', paused: boolean }
{ type: 'CLEAR_INDEX' }
{ type: 'UPDATE_FILTERS', allowlist?: string[], denylist?: string[] }
```

**Response:**
```ts
{ type: 'SETTINGS', data: HistorySettings }
{ type: 'CLEAR_OK' }
{ type: 'ERROR', code: string, message: string }
```

### Search Port (history-search)
**Client → Background:**
```ts
{
  type: 'SEARCH',
  payload: {
    query: string;
    dateRange: { start: number | null; end: number | null };
    domains: string[];
    limit: number;
    offset: number;
  }
}
```

**Background → Client (streaming):**
```ts
{ type: 'SEARCH_RESULT', chunk: HistoryResultGroup[], total: number, final?: boolean }
{ type: 'SEARCH_DONE' }
{ type: 'SEARCH_ERROR', message: string }
```

---

## Styling

### CSS Variables (light/dark auto-switch)
```css
--history-bg, --history-surface, --history-border
--history-text-primary, --history-text-secondary, --history-text-tertiary
--history-accent, --history-accent-hover, --history-accent-light
--history-focus-ring
--history-error, --history-warning, --history-success, --history-info
--history-space-{xs,sm,md,lg,xl}
--history-font-size-{xs,sm,base,lg,xl}
--history-radius-{sm,md,lg}
--history-shadow-{sm,md,lg}
--history-transition-{fast,base}
```

### Responsive Breakpoints
- **Mobile (<768px)**: Stack filters, full-width toast, compact padding

### High Contrast Mode
Uses `prefers-contrast: high` to enforce stronger borders and focus rings.

---

## Accessibility Checklist

- ✅ **Keyboard Navigation**: Tab order, arrow keys, Enter, Esc
- ✅ **Focus Indicators**: 2px accent outline on all interactive elements
- ✅ **ARIA Roles**: `banner`, `main`, `navigation`, `list`, `listitem`, `dialog`, `alert`
- ✅ **ARIA Labels**: All inputs, buttons, groups have descriptive labels
- ✅ **Live Regions**: `aria-live="polite"` for result counts, toasts, banners
- ✅ **Contrast**: Variables meet 4.5:1 for text, 3:1 for UI components
- ✅ **Focus Management**: Auto-focus first result, return focus on clear
- ✅ **Screen Reader**: Hidden instructions, `.sr-only` utility class

---

## Performance Notes

- **Debounce**: 280ms on query input
- **Virtualization**: Active when >20 groups; keeps ~15 in DOM
- **Memoization**: `useMemo` for filters object, `useCallback` for handlers
- **Lazy Expansion**: Groups default to 3 items; expand on demand
- **Port Streaming**: Progressive render as chunks arrive
- **Timeout**: 10s with error fallback

---

## Usage Example

### Integrate into Extension
In your extension's `manifest.json` (or via Plasmo config):
```json
{
  "chrome_url_overrides": {
    "newtab": "history.html"
  }
}
```

Or open as a standalone page:
```ts
chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
```

### Background Service Worker Setup
You need to handle these messages in `background.ts`:

```ts
// Settings
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SETTINGS') {
    // Return { type: 'SETTINGS', data: {...} }
  }
  if (msg.type === 'SET_PAUSED') {
    // Update paused state, return { type: 'CLEAR_OK' }
  }
  if (msg.type === 'CLEAR_INDEX') {
    // Clear IndexedDB, return { type: 'CLEAR_OK' }
  }
});

// Search Port
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'history-search') {
    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'SEARCH') {
        // Query IndexedDB/MiniSearch, stream results:
        // port.postMessage({ type: 'SEARCH_RESULT', chunk: [...], total: N });
        // port.postMessage({ type: 'SEARCH_DONE' });
      }
    });
  }
});
```

---

## Testing

### Manual Testing
1. **Search**: Type query, verify debounce, check results
2. **Filters**: Toggle date presets, add/remove domains
3. **Keyboard**: Arrow keys, Enter, Home/End, Esc
4. **Pause**: Toggle pause, verify banner and persistence
5. **Clear**: Confirm modal, verify index cleared
6. **Accessibility**: Tab through, use screen reader (NVDA/JAWS)
7. **Theming**: Toggle system dark mode, check contrast
8. **Responsive**: Resize to mobile, verify layout

### Unit Tests (TBD)
- `useSettings`: Mock `chrome.runtime.sendMessage`
- `useHistorySearch`: Mock Port, test debounce
- `useKeyboardNav`: Simulate key events, verify focus state
- `useVirtualWindow`: Test scroll calculations
- Components: Render, interaction, ARIA attributes

---

## Future Enhancements

- [ ] Custom date range picker (calendar UI)
- [ ] Domain suggestions from existing index
- [ ] Export search results (CSV/JSON)
- [ ] Bookmarking search queries
- [ ] Visual thumbnails/screenshots in results
- [ ] Multi-language snippet highlighting
- [ ] Voice search input
- [ ] Offline indicator
- [ ] Dark mode manual toggle (override system)
- [ ] Keyboard shortcuts help modal (`?`)

---

## License

Part of the Chrome AI Hackathon 2025 project. See root LICENSE for details.
