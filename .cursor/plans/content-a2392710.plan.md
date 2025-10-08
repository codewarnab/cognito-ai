<!-- a2392710-7e17-417e-89db-8141e309c8bc 266e14e4-1a3d-4022-8546-6b04c0b6f585 -->
# Content Script: src/contents/extract.ts

## Scope

Implement a MV3 content script that runs on <all_urls> at document_idle. It:

- Gathers url, title, meta description
- Extracts limited body text (50–150KB) using a readability heuristic
- Derives image captions (alt/figcaption/nearby text) without fetching images
- Enforces privacy gates (global pause, per-domain allow/deny)
- Handles SPAs with route-change detection and throttled re-extract
- Posts a minimal `PageSeen` message to background; heavier capture sent only when background explicitly requests it

## Manifest & Registration

- Ensure content script is configured in manifest (Plasmo or MV3 equivalent) with `matches: ["<all_urls>"]`, `runAt: "document_idle"`.

## Privacy Gates

- Read from `chrome.storage.local`:
  - `paused: boolean`
  - `domainAllowlist: string[]`
  - `domainDenylist: string[]`
- Decision: if `paused === true` → no-op; if host in denylist → no-op; if allowlist defined and host not in it → no-op.
- Never collect from inputs/forms/contenteditable; never traverse inside `form`, `input`, `textarea`, `[contenteditable]`, `select`, `iframe`, `script`, `style`, `noscript`.
- Redact obvious secrets by skipping nodes whose closest ancestor has attributes suggesting sensitive content: `[type=password]`, `[autocomplete=password]`, `[name*="password" i]`, `[name*="secret" i]`, `[data-private]`, `[data-sensitive]`.

## DOM Selection & Readability Heuristic

- Candidate roots (preference order): `article`, `main`, `[role="main"]`, `#content`, `.article`, `.post`, else `document.body`.
- Build a filtered clone for text extraction:
  - Drop nodes by selector: `script, style, noscript, svg, canvas, video, audio, iframe, form, input, textarea, select, button, nav, aside, footer, header, menu, [aria-hidden="true"], [hidden], template`.
  - Drop ads/utility blocks: `[class*="ad-" i], [id*="ad-" i], .comment, .comments, .sidebar, .share, .subscribe, .cookie, .banner` (best-effort, non-exhaustive).
  - Exclude nodes inside `[contenteditable]`.
- Scoring: compute text density per block (text length / descendant block count); keep top-N blocks until reaching byte budget.
- Limits: byte budget 100KB target (min 50KB, max 150KB). Use `TextEncoder().encode(text).length` to enforce.
- Normalize whitespace; keep paragraph breaks; keep headings `h1..h3` as lines.

## Image Captions (No Fetches)

- For each `img` within candidate roots (bounded to first 50 images to cap work):
  - Prefer `alt` if non-empty and not purely decorative (skip if `role="presentation"` or empty/whitespace or alt==="").
  - Else if wrapped in `figure` with `figcaption`, use caption text.
  - Else derive "nearby" caption: previous/next sibling text nodes; or closest header/label/aria-label/title; clamp to ~160 chars.
- Store minimal tuple: `{src: resolvedURL, caption: string}`; no data URIs, skip `src` starting with `data:`.

## Throttling & SPA Handling

- Initial run at `document_idle` with debounce (e.g., 2s) to let late content settle.
- Observe DOM for route/content changes via `MutationObserver` with lightweight heuristics:
  - Detect SPA navigations via changes to `location.href` (hook `history.pushState`, `history.replaceState`, listen to `popstate`).
  - On URL change or significant DOM mutations (added text > 10KB), schedule a debounced re-extract (e.g., 3–5s trailing debounce, max once per 30s).
- Backoff: do not run more than once per 30s per tab unless background explicitly requests.

## Message Flow

- After extraction, post minimal `PageSeen` to background:
  - Contains core metadata and small signals; excludes full text by default.
- If background later sends `RequestPageCapture` for this tab, respond with full limited body text + image captions via `PageCapture` message.

## Message Payload Schemas

- PageSeen (content → background):
```json
{
  "type": "PageSeen",
  "url": "string",
  "title": "string",
  "description": "string | null",
  "ts": 0,
  "textSizeBytes": 0,
  "imageCaptionCount": 0,
  "spa": true,
  "host": "string"
}
```

- RequestPageCapture (background → content):
```json
{ "type": "RequestPageCapture", "reason": "queue|user|retry" }
```

- PageCapture (content → background):
```json
{
  "type": "PageCapture",
  "url": "string",
  "title": "string",
  "description": "string | null",
  "ts": 0,
  "text": "string",            // limited, normalized
  "textSizeBytes": 0,
  "images": [ { "src": "string", "caption": "string" } ],
  "version": 1
}
```


## Security & Privacy Considerations

- No image/network fetches; derive captions locally.
- Do not traverse into `iframe` for cross-origin; skip altogether to avoid leaks.
- Exclude forms/inputs/contenteditable; skip elements marked hidden/aria-hidden.
- Enforce byte budgets; never exceed 150KB to limit unintended data collection.
- Strip emails, phone numbers optionally by regex if required later (out of current scope; can be added as post-filter in background).
- Robust against XSS: do not execute inline scripts; only read textContent/attributes.

## Essential Snippets (illustrative)

- Debounced scheduler and background post:
```typescript
const debounce = (fn: () => void, ms: number) => { let t: number|undefined; return () => { clearTimeout(t); t = setTimeout(fn, ms) as unknown as number; }; };
const post = (msg: unknown) => chrome.runtime.sendMessage(msg);
```

- SPA URL change hook:
```typescript
(function hookHistory(){
  const push = history.pushState; const replace = history.replaceState;
  const notify = () => onUrlPotentiallyChanged();
  history.pushState = function(...a){ const r = push.apply(this, a as any); notify(); return r; } as any;
  history.replaceState = function(...a){ const r = replace.apply(this, a as any); notify(); return r; } as any;
  window.addEventListener('popstate', notify);
})();
```


## Acceptance Tests

- Initial load extracts metadata and posts `PageSeen` once within 5s of idle.
- Respects `paused=true`: no messages sent.
- Denylisted domain: no messages; allowlist present and host not in it: no messages.
- Byte budget respected: `textSizeBytes <= 150_000`.
- Excludes sensitive fields: inputs/forms/contenteditable skipped; no occurrences of known password field markers.
- Image captions collected without any network requests; skips `data:` URLs; max 50 images.
- SPA navigation: pushing a new state triggers one additional `PageSeen` after debounce; no more than one every 30s.
- Background `RequestPageCapture` elicits a `PageCapture` with text+images; otherwise not sent.
- Cross-origin iframes ignored; no errors thrown.
- Heavy pages: extraction completes under 1s for 1MB DOM (after filters) on mid-range machine.

## Deliverables

- `src/contents/extract.ts` implementing above behavior
- Tests:
  - Unit tests in `src/contents/__tests__/extract.spec.ts` (jsdom + Vitest)
  - E2E smoke via Playwright covering SPA route-change and privacy gates

### To-dos

- [ ] Implement storage-based privacy gates and host checks
- [ ] Implement filtered DOM clone and text-density-based extraction with byte budget
- [ ] Collect image captions from alt/figcaption/nearby text (no fetches)
- [ ] Add SPA URL hooks, mutation observer, and throttled scheduling
- [ ] Implement PageSeen/PageCapture message handlers and flow
- [ ] Add unit tests for extraction, limits, privacy gates
- [ ] Add Playwright e2e tests for SPA updates and background request flow