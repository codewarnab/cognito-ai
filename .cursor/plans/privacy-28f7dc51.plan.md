<!-- 28f7dc51-c67f-4b7b-8ecc-e7e082cc7f17 ebeb7fb6-f0f6-4856-b0fe-1869d1370b74 -->
# Privacy Controls & Data Wipe — Implementation Plan

#### Scope

- Add a robust privacy layer: global pause, per-domain allow/deny lists, and full data wipe with confirm/undo. Enforce rules in content extraction and background scheduling. UX lives in `src/pages/history.tsx`.

#### Data Model & Storage

- Settings in IndexedDB `settings` store and mirrored small flags in `chrome.storage.local` (for quick guards):
```ts
// src/db/index.ts (settings shape)
export type Settings = {
  modelVersion: string | null
  paused: boolean
  domainAllowlist: string[]
  domainDenylist: string[]
  lastMiniSearchPersistAt?: number
};
```

- Persist settings in IndexedDB (`settings` key: "current") and sync minimal mirror to `chrome.storage.local`:
```ts
// keys in chrome.storage.local
{ paused: boolean, domainAllowlist: string[], domainDenylist: string[] }
```

- User data locations to clear:
  - IndexedDB stores: `pages`, `chunks`, `images`, `miniSearchIndex`, `settings` (reset to defaults after wipe)
  - Cache Storage: optional model cache under `model/<version>/...` (behind checkbox)

#### Guard Checks (Enforcement)

- Content script (`src/contents/extract.ts`): before any extraction/postMessage
```ts
const { paused, domainAllowlist, domainDenylist } = await chrome.storage.local.get(["paused","domainAllowlist","domainDenylist"])
const host = location.hostname
const blocked = paused || (domainDenylist?.includes(host)) || (domainAllowlist?.length && !domainAllowlist.includes(host))
if (blocked) return // no extraction
```

- Background queue (`src/background.ts`): on receipt of `PageSeen`, and before enqueue + before dispatch to offscreen
```ts
const s = await chrome.storage.local.get(["paused","domainAllowlist","domainDenylist"]) 
if (s.paused || isHostBlocked(url, s)) return
// also check again in scheduler tick before sending batch
```

- Offscreen/worker: no special guard if upstream guarantees; still accept a `paused` gate to early-abort batches.

#### UI (History Page `src/pages/history.tsx`)

- Controls section at top:
  - Global pause: toggle with clear label and helper text respecting AA contrast and brand tokens [[memory:7430718]].
  - Per-domain lists: two tokenized input fields (allow and deny). Normalize hosts to punycode/lowercase; dedupe.
  - Delete all data: primary destructive button → confirm modal with checkbox “Also remove downloaded model files (~MB)” → final confirm.
  - Undo: after success toast with “Undo” for 10s. Implementation: schedule wipe via background message with `delayMs=10000`. If user presses Undo, cancel scheduled alarm. For immediate privacy, we soft-pause and hide results instantly.
- Result list must react to `paused` by showing an empty-state banner and offering “Resume capturing”.

#### Wiring & Messages

- Add background handlers:
```ts
// messages: { type: "settings:update", payload: Partial<Settings> }
//           { type: "privacy:wipe", alsoRemoveModel?: boolean, delayMs?: number }
//           { type: "privacy:wipe:cancel" }
```

- Background implements: schedule wipe via `chrome.alarms.create("wipe", { when: Date.now()+delayMs })`; on fire, stop scheduler, close offscreen, clear stores and caches, re-init empty settings, clear mirrors, broadcast `privacy:wipe:done`.

#### Delete All Data – Exact Steps

1. Set `paused=true` immediately and broadcast UI update to hide results.
2. Stop processing: drain/stop queue; cancel in-flight batches safely.
3. If `delayMs` provided: set `pendingWipe=true` (local only), create alarm; otherwise proceed immediately.
4. Perform wipe atomically:

   - Delete all IndexedDB stores (`pages`, `chunks`, `images`, `miniSearchIndex`, `settings`), then recreate empty schema default settings `{ paused:false, domainAllowlist:[], domainDenylist:[] }`.
   - Optionally delete Cache Storage `model/<version>`. Then set `modelVersion=null`.
   - Clear `chrome.storage.local` mirrors.

5. Broadcast `privacy:wipe:done` and show completion toast.

#### Confirmation & Undo Patterns

- Modal: secondary confirm text (“This removes all stored pages, chunks, images, and search index. This cannot be undone after 10s.”)
- Checkbox: “Also remove downloaded model files (~MB)”
- Undo toast: visible 10s; on click → send `privacy:wipe:cancel` → cancel alarm and resume.

#### Acceptance Tests (Manual + Automated where feasible)

- Settings guards:
  - With `paused=true`, visit pages → no new `pages/chunks` entries, no background jobs.
  - With allowlist set to `example.com`, only that host is captured; with denylist containing `example.com`, it’s never captured.
- UI state:
  - Toggling pause updates `chrome.storage.local` and IndexedDB, banner appears/disappears.
  - Adding/removing domains reflects instantly; normalized hosts, no duplicates.
- Wipe (without model removal):
  - Trigger wipe with delay; results are hidden immediately; press Undo → nothing deleted; resume possible.
  - Trigger wipe immediate; confirm all IndexedDB stores empty; `chrome.storage.local` keys removed; Cache Storage model untouched; app re-initializes with defaults.
- Wipe (with model removal):
  - Cache Storage `model/<version>` is gone; `modelVersion` becomes null; first embedding attempt forces re-download flow.
- No residual artifacts:
  - After wipe, querying shows empty results; reloading the extension shows clean state.

#### Essential Snippets (illustrative)

```ts
// src/background.ts
chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg.type === "settings:update") return updateSettings(msg.payload).then(()=>sendResponse(true)), true
  if (msg.type === "privacy:wipe") return scheduleWipe(msg.alsoRemoveModel, msg.delayMs ?? 0).then(()=>sendResponse(true)), true
  if (msg.type === "privacy:wipe:cancel") return cancelWipe().then(()=>sendResponse(true)), true
})
```



```ts

// src/pages/history.tsx (handlers)

await chrome.runtime.sendMessage({ type: "settings:update", payload: { paused: next } })

await chrome.runtime.sendMessage({ type: "settings:update", payload: { domainAllowlist } })

await chrome.runtime.sendMessage({ type: "privacy:wipe", alsoRemoveModel, delayMs: 10000 })

```

#### Accessibility & Branding

- Use CSS variables for brand colors and maintain WCAG AA contrast; ensure focus states and keyboard operation for modal and tokens [[memory:7430718]].

### To-dos

- [ ] Define `Settings` schema and defaults in `src/db/index.ts`
- [ ] Mirror pause and domain lists to chrome.storage.local
- [ ] Enforce pause/allow/deny in content extraction entrypoint
- [ ] Enforce pause/allow/deny in background queue and scheduler
- [ ] Add UI in history page: pause toggle, lists, delete button
- [ ] Implement delayed wipe, cancel, and full data deletion
- [ ] Broadcast settings/wipe updates to UI and stop/resume worker
- [ ] Run acceptance tests for guards, UI, and data wipe flows