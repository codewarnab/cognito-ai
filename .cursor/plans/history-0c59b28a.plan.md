<!-- 0c59b28a-a3e1-4079-aadf-5b0fff0e93c5 014947f8-6862-4d8b-a636-2349b43ebc44 -->
# History Search Page (src/pages/history.tsx)

## Goal

Build a performant, accessible, on-device history search UI with search, filters, privacy controls, and grouped results. It talks to background → offscreen → worker without any network.

## Component Structure

- `HistoryPage`
  - `HeaderBar`
    - `SearchInput` (with submit, clear)
    - `FiltersBar`
      - `DomainFilter` (multi-select chips + input with suggestions)
      - `DateFilter` (preset: Today/7d/30d/All + custom range)
    - `PrivacyControls`
      - Pause collection toggle
      - Clear index button (confirm modal)
  - `ResultsSummary` (counts, active filters, clear filters)
  - `ResultsListVirtualized` (windowed list of grouped results)
    - `ResultGroup` (favicon, title, domain, open all)
      - `ResultItem` (snippet, open link)
  - `EmptyState` (model-not-ready, paused, or no results)
  - `Toasts` (non-blocking notifications)

## State & Data Hooks

- `useSettings()`
  - Loads `{modelReady, paused, domainAllowlist, domainDenylist}` via `chrome.runtime.sendMessage({type:"GET_SETTINGS"})`
  - Actions: `setPaused(bool)`, `clearIndex()`, `updateFilters()`
- `useHistorySearch()`
  - Inputs: `{query, dateRange, domains, limit, offset}`
  - Debounced query (250–300ms)
  - Sends `chrome.runtime.connect({name:"history-search"})` Port; posts `{type:"SEARCH", payload}`
  - Receives `{type:"SEARCH_RESULT", resultsChunk|final}` to support progressive streaming
  - Exposes `{groups, total, isSearching, error}`
- `useKeyboardNav()`
  - Manages roving tabindex across groups/items; arrow keys, Home/End, Enter to open, Ctrl/Enter to open in background
- `useVirtualWindow()`
  - Calculates visible window for groups based on scroll container; keeps ~12–20 groups in DOM; memoizes items per group

## Messaging Contracts

- Requests from page:
  - `GET_SETTINGS`
  - `SET_PAUSED {paused}`
  - `CLEAR_INDEX`
  - Port `history-search`: `{type:"SEARCH", payload:{q, domains, dateStart, dateEnd, limit, offset}}`
- Responses:
  - `SETTINGS {modelReady, paused, ...}`
  - Search stream: `{type:"SEARCH_RESULT", chunk:[Group], total}` and `{type:"SEARCH_DONE"}`
  - `CLEAR_OK` or `ERROR {code, message}`

## Rendering & Performance

- Virtualize groups (manual windowing) to avoid heavy deps
- Group header sticky within viewport section for context
- Memoize group rendering and snippet highlights
- Keep result item count per group capped (e.g., top 3) with “Show more” expansion per group
- Progressive render as chunks arrive

## Styling & Theming

- Use CSS variables from `src/style.css` per brand guidelines (no hardcoded colors)
- Support light/dark; prefers-color-scheme
- High-contrast focus rings; large hit targets on buttons/chips

## Accessibility (WCAG AA)

- Landmarks: `header`, `main`, `nav` for filters, `section` for results
- Labels: `aria-label`/`aria-labelledby` for inputs/filters; associate inputs with `<label>`
- Keyboard:
  - Tab order: search → filters → results
  - Arrow keys within results list (roving tabindex)
  - `Enter` to open; `Ctrl+Enter` open in background; `Shift+Enter` open group top hit
  - `Esc` clears search or closes modal
- Roles:
  - `role="list"`/`role="listitem"` for results; groups as `group` with `aria-label` title
  - Live region `aria-live="polite"` for results count updates
- Focus management:
  - Move focus to first result after search
  - Return focus to search on clear
- Contrast: Ensure tokens meet 4.5:1; rely on brand CSS vars
- Announce actions (pause toggled, index cleared) via `aria-live`

## UX States

- Model not ready: info panel with progress indicator and guidance; disable search
- Paused: banner with resume button; search allowed on existing index
- Empty query: tips and recent domains
- No results: suggest filter updates
- Searching: skeleton placeholders in virtual list
- Error: retry with diagnostic code
- Clear index: confirm modal with irreversible warning

## Minimal, Essential Snippets (illustrative)

```tsx
// HistoryPage shell
export default function HistoryPage() {
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState({start: null, end: null});
  const [domains, setDomains] = useState<string[]>([]);
  const { modelReady, paused, setPaused, clearIndex } = useSettings();
  const { groups, total, isSearching } = useHistorySearch({ query, dateRange, domains, limit: 200 });
  // ... render header, filters, virtualized results
}
```



```tsx

// Port wiring (inside useHistorySearch)

const portRef = useRef<chrome.runtime.Port | null>(null);

useEffect(() => {

const port = chrome.runtime.connect({ name: "history-search" });

portRef.current = port;

return () => port.disconnect();

}, []);

```

## Keyboard Map

- Global: `/` focuses search; `Ctrl+K` toggles search focus
- Results: `↑/↓` move item focus, `←/→` collapse/expand group, `Home/End` jump
- Activation: `Enter` open, `Ctrl+Enter` open background, `Alt+Enter` open all in group

## Error Handling

- Graceful timeouts if no port response within N seconds; show retry
- Guard all actions when `modelReady === false`
- Disable Clear while searching

## Acceptance Tests

- Settings
  - Pausing toggles state and banner; persists across reloads
  - Clear index prompts, empties results, announces via live region
- Search
  - Debounce calls; doesn’t fire on every keystroke
  - Domain/date filters constrain results
  - Progressive results render; counts update
- Accessibility
  - All controls reachable via keyboard; focus order logical
  - Live region announces result count and major actions
  - Contrast ratios meet AA (snapshot test with CSS vars)
- Navigation
  - Enter opens focused item; Ctrl+Enter opens background tab
  - Group expand/collapse via keyboard and mouse
- Performance
  - Rendering remains smooth with 5k+ groups (virtualization active)
  - Memory stays bounded when streaming large results

## Risks & Mitigations

- Large result sets → manual windowing + chunked updates
- Port disconnects → retry with backoff; surface toast
- Model not ready on cold start → disable search and show guidance

### To-dos

- [ ] Create `HistoryPage` shell with header, filters, list areas
- [ ] Implement `useSettings` messaging: GET/SET paused, clear index
- [ ] Implement `useHistorySearch` with Port, debounce, streaming
- [ ] Add manual virtualized list for grouped results
- [ ] Implement roving tabindex and keyboard handlers
- [ ] Build `SearchInput`, `FiltersBar`, `ResultGroup`, `ResultItem`, `EmptyState`
- [ ] Add roles, labels, live regions, focus management to AA
- [ ] Wire brand CSS variables, focus rings, light/dark
- [ ] Write acceptance tests for states, a11y, performance