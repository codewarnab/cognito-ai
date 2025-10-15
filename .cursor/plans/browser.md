# Browser Actions Implementation Plan

## Scope

Implement modular, MV3-safe browser actions: selectors/interactions, forms+file upload, smart navigation, clipboard R/W, screenshots (tab/element) + OCR (WASM), Downloads API, network rules/capture via debugger, and debugger attach helpers.

## Target Files

- `src/actions/interactions.tsx` (extend: selectors, input, scroll)
- `src/actions/selection.tsx` (extend: role/text queries)
- `src/actions/tabs.tsx` (extend: smart navigation + reuse)
- `src/actions/primitives.tsx` (shared timeouts, retries, idempotency)
- `src/actions/network.ts` (NEW: rules + capture)
- `src/actions/downloads.ts` (NEW: start/track/move)
- `src/actions/clipboard.ts` (NEW: read/write)
- `src/actions/media.ts` (NEW: tab/element screenshots, OCR)
- `src/actions/debugger.ts` (NEW: attach, eval, DOM snapshots)
- `src/background.ts` (ensure alarm ticks + event wiring for downloads/debugger)
- `src/styles/*` (none; no UI changes required here)

## Permissions/Manifest Prereqs (already in global plan)

- permissions: `downloads`, `downloads.shelf`, `debugger`, `declarativeNetRequestWithHostAccess`, `clipboardRead`, `clipboardWrite`, `notifications`, `cookies`
- optional_permissions: `tabCapture`, `desktopCapture`
- host_permissions: `<all_urls>`

## Design Principles

- MV3-friendly: use `chrome.scripting`, `chrome.debugger`, alarms; avoid long-lived loops.
- Idempotent actions via `useActionDeduper` and action keys (URL+selector+op).
- Timeouts and retries: exponential backoff; guard clauses.
- Return structured results with artifacts (screenshots, OCR text, HAR-lite).

## APIs (Type Signatures)

- Selectors/Interactions (extend `interactions.tsx`):
- `waitForSelector(tabId, selector, {timeout, visible}): Promise<{found: boolean}>`
- `click(tabId, selector|roleQuery, {clickCount, delay}): Promise<void>`
- `typeText(tabId, selector, text, {clearFirst}): Promise<void>`
- `scrollIntoView(tabId, selector, {block}): Promise<void>`
- Forms/File Upload (extend/new helpers):
- `fillByLabel(tabId, label, value): Promise<void>`
- `fillByPlaceholder(tabId, placeholder, value): Promise<void>`
- `uploadFile(tabId, selector, fileBlob|path): Promise<void>`
- Smart Navigation (`tabs.tsx`):
- `ensureAtUrl(tabId, url, {reuse:true, wait: 'networkidle'|'load', retries}): Promise<{navigated:boolean}>`
- `goAndWait(pattern|url, opts): Promise<{finalUrl:string}>`
- Clipboard (`clipboard.ts`):
- `readClipboard(tabId, {type:'text'|'html'}): Promise<{text?:string, html?:string}>`
- `writeClipboard(tabId, data: {text?:string, html?:string}): Promise<void>`
- Media + OCR (`media.ts`):
- `captureTab(tabId, {format:'png'|'jpeg', quality}): Promise<{dataUrl:string}>`
- `captureElement(tabId, selector): Promise<{dataUrl:string}>`
- `ocrImage(dataUrl|blob, {lang}): Promise<{text:string, confidence:number}>`
- Downloads (`downloads.ts`):
- `startDownload(url|blob, {filename}): Promise<{downloadId:number}>`
- `trackDownload(downloadId): Promise<{state:'in_progress'|'complete'|'interrupted', filePath?:string}>`
- `moveToArtifacts(downloadId|filePath, {artifactKey}): Promise<{artifactId:string}>`
- Network Rules/Capture (`network.ts`):
- `applyRuleset(tabId, rules): Promise<void>`
- `captureTraffic(tabId, {patterns}): Promise<{entries:HarEntryLite[]}>`
- Debugger (`debugger.ts`):
- `withDebugger(tabId, fn): Promise<T>` (ensures attach/detach)
- `evaluate(tabId, expression, {returnByValue}): Promise<any>`
- `snapshotDOM(tabId, {selector?}): Promise<{markup:string, screenshot?:string}>`

## Implementation Steps

1) Utilities

- Add `retry(fn, {retries, backoffMs})` and `withTimeout(p, ms)` in `primitives.tsx`.
- Export `injectContent<T>(tabId, fn, args)` via `chrome.scripting.executeScript`.

2) Selectors & Interactions

- Implement robust `queryByText/role` in `selection.tsx` (ARIA roles, textContent, case-insensitive).
- Actions call content-side helpers to interact (click/type/scroll) with visibility checks and bounding box clicks when needed.

3) Forms & Upload

- Map labels→inputs using `for`/`aria-labelledby` fallback; set value and dispatch `input`/`change` events.
- For upload: set `files` via `DataTransfer` when possible; fallback to debugger `DOM.setFileInputFiles` if blocked.

4) Smart Navigation

- Reuse existing tab if same origin; otherwise create new or update URL.
- Wait strategies: `load`, `networkidle` via debugger `Network.loadingFinished` debounce.
- Implement retries for redirects/offline; return final URL.

5) Clipboard

- Prefer `navigator.clipboard` in page context; fallback to background `chrome.clipboard` types for text/html.
- Permission prompts handled via optional flows; wrap in try/catch and return capability flags.

6) Media + OCR

- `tabCapture` for full tab bitmap (PNG/JPEG) using `chrome.tabs.captureVisibleTab`.
- Element capture: measure rect in page, use `captureVisibleTab` + crop in a worker (OffscreenCanvas).
- OCR: Load Tesseract WASM lazily from `public/wasm/`; expose `ocrImage` with progress disabled.

7) Downloads API

- Start via `chrome.downloads.download`; listen to `onChanged` in background; resolve when complete.
- Provide helper to move file to artifacts dir (managed by job engine) and return artifact id.

8) Network Rules & Capture

- Apply `declarativeNetRequest` session rules scoped by tabId (block/allow/modify headers).
- For capture: use `chrome.debugger` to attach and consume `Network.*` events; build HAR-lite entries.

9) Debugger Helpers

- Implement `withDebugger` to attach, enable `Page`, `DOM`, `Network`, run ops, then detach safely (finally block).
- DOM snapshot via `Page.captureScreenshot` and `DOM.getDocument`/`DOM.getOuterHTML` (selector optional).

10) Testing & Telemetry Hooks

- Add lightweight unit tests for query utilities and retry logic.
- Emit audit entries on each action with inputs/outputs (integrate later with job engine).

## Risks & Mitigations

- Debugger conflicts: serialize `withDebugger` per tab with a mutex.
- MV3 worker sleep: keep operations short, use alarms for long captures.
- Permissions prompts: degrade gracefully, surface `capabilities` in results.