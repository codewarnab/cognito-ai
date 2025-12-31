TThis is inspired from the code of dev-inspector-mcp extension which is a similar extension that allows you to inspect the code of a website and edit the code of a website.
it is still cloned in the repo as a reference and will be removed later.

### Code Mode (Local CLI Agent) — Detailed Implementation Plan (Self‑Contained)

This document is a **precise** implementation plan for adding a new **“Code” mode** to the Cognito Chrome extension so that:

- The user can **pick a DOM element / component** from the active page.
- The user can send an **edit instruction**.
- A **local coding agent CLI** installed on the user’s machine (e.g., **Gemini CLI**, **Claude Code**, **Codex CLI**, etc.) performs the **repo changes**.
- The **agent’s streamed response** and the **proposed code edits (diff)** are shown inside the **side panel**.
- The user can **approve / deny / apply** changes from the side panel.

This plan intentionally avoids relying on any external repo being present. It includes the relevant patterns as copy‑pastable code templates.

---

### How to use this plan (keep it updated as you implement)

This is written **phase-by-phase**. Keep it as a living doc:

- **When you start a phase**: mark it **🟡 In progress** in the tracker below.
- **When you finish a phase**: mark it **✅ Done** and add **1–2 short notes** under “Notes (future)” if you noticed follow-ups (keep them tiny).
- **If you skip/deferring**: mark it **⏭️ Deferred** and write a 1-line reason.

#### Progress tracker

Update this table as you go:

| Phase | Status | Notes (future, 1–2 bullets max) |
|------:|:------:|----------------------------------|
| 0 | ⬜ Not started | - |
| 1 | ✅ Done | - `ToolsMode` includes `'code'` in `types/settings.ts` |
| 2 | ✅ Done | - Element picker in `code-picker.content.ts`, `CodeModeElementContext` in shared, `codeModeStore` created |
| 3 | ✅ Done | - Bridge package `@cognito/code-bridge` created, extension integration complete, AI routing added |
| 4 | ✅ Done | - `PatchProposalCard`, `DiffViewer` components; `usePatchProposalTool` hook; patch tracking in store |
| 5 | ✅ Done | - Added VSCode/Cursor editor buttons in `PatchProposalCard`; `repoCwd` stored from bridge `/health` |

**Status legend**:
- ⬜ Not started
- 🟡 In progress
- ✅ Done
- ⏭️ Deferred

---

### What “Code Mode” means (scope + non‑goals)

- **Goal**: Modify the **local project source code** (files on disk) and show a diff in the side panel.
- **Non‑goal (MVP)**: Perfect mapping from any DOM element → exact source file/line for every framework/site. In practice, you’ll start with **heuristics + user context**, then optionally add build‑time instrumentation later.
- **Non‑goal (MVP)**: The local agent autonomously controlling the browser. In MVP, the **user** picks elements; the agent gets structured context and edits code.

---

### Key constraint (why we need a local “Bridge”)

Chrome extensions **cannot spawn local processes**. So they cannot directly run `gemini`, `claude`, `codex`, etc.

Therefore, “Code Mode” requires a **local companion process** (a small server the user runs on `localhost`) that:

- spawns the local agent CLI via a standard protocol (recommended: **ACP**)
- returns streamed results + structured patch proposals back to the extension
- applies patches only after explicit approval

Analogy:
- The extension is the **remote control** and **display**.
- The local bridge is the **computer you’re controlling**.

---

### Architecture overview

**Components**

- **Side Panel UI (extension page)**:
  - Mode switch includes **Code**
  - “Pick element” control near input
  - Agent selector (Gemini CLI / Claude Code / Codex CLI…)
  - Chat stream + patch/diff viewer + Apply / Deny buttons

- **Content Script (in tab)**:
  - “Element picker” overlay (crosshair, highlight on hover, click to select)
  - Extracts safe element context and sends it back to side panel

- **Local Bridge (user runs on their machine)**:
  - HTTP API (localhost only)
  - Spawns chosen CLI agent using **ACP**
  - Produces **patch proposals** as a **unified diff** (or a structured file list)
  - Applies patches only when extension sends “apply”

**Data flow**

1) User selects **Code** mode  
2) User clicks **Pick element** → selects element on page  
3) Extension sends: (chat messages + selected element context + agent selection) → Local Bridge  
4) Local Bridge streams assistant output and emits `propose_patch` events  
5) Side panel renders:
   - streaming text
   - a diff viewer
   - Apply / Deny controls  
6) If user approves: extension requests patch apply → Local Bridge applies → returns status + optional “reload page” hint  

---

### Phase plan (deliverables and order)

#### Phase 0 — Prerequisites (1–2 days)

- **Bridge CLI** must be installable and runnable:
  - `npx cognito-bridge --port 8787` (example)
  - Or `pnpm dev:bridge` (monorepo dev)
- Bridge must run from a **project root** (this is how the agent gets filesystem access).
- Bridge must implement **pairing** so the extension can’t talk to a random local server.

Deliverable: “bridge health + pairing token + hello streaming endpoint”.

#### Phase 1 — Add “Code” to the mode selector (0.5 day)

Add a new mode value:

- `ToolsMode`: add `'code'`
- Tools popover “ModeSelector” shows **Code** button.

Behavior:
- Switching to Code mode **does NOT** have to change the enabled tool list for MVP.
- But it **must** switch the chat transport to “local bridge chat”.

Deliverable: UI can enter Code mode and the rest of the UI reacts (shows agent selector + pick element UI).

#### Phase 2 — Element Picker (1–2 days)

Add a picker that returns a **safe element context payload**:

- tagName
- id, class list (truncated)
- text preview (truncated)
- bounding box
- CSS selector (best-effort)
- computed styles subset (optional)
- outerHTML snippet (sanitized + truncated)

Important:
- **Never capture sensitive input values** (password/cc fields).
- Prefer capturing **labels / placeholders**, not `value`.

Deliverable: Side panel receives selected element context and shows it as an “attachment” above the input.

#### Phase 3 — Local Bridge Chat streaming (ACP) (2–4 days)

Implement a local HTTP API that:
- accepts chat messages + context
- runs a chosen local agent CLI in ACP mode
- streams the assistant response back to the extension

Deliverable: Code mode chat works end‑to‑end and responses stream in side panel.

#### Phase 4 — Patch proposal + diff viewer + apply/deny (2–4 days)

Implement a patch lifecycle:

1) Agent proposes patch as unified diff via a structured “tool call” event (`propose_patch`)
2) Side panel renders diff
3) User clicks Apply → bridge applies patch to disk

Deliverable: “Agent proposes patch → user applies → files updated”.

#### Phase 5 — Polish + safety + iteration (ongoing)

- Repo selection UX (if user has multiple projects)
- Better mapping DOM→source via optional build instrumentation (Vite/Next plugin)  
- Add “Open file in editor” deep links (Cursor/VSCode) if desired
- Add “Run tests” / “Run dev server” optional tools (still via bridge)

---

### Deep dive: implementing the Local Bridge (monorepo + “how to build it”)

This section expands Phase 0/3/4 into **very concrete** steps: how to create the bridge package, how to run it, how it authenticates, how it spawns the local CLI agent, how it stores and applies patches, and how you can distribute it.

The bridge is intentionally designed as a **small Node.js HTTP server**:

- **Runs locally** on `127.0.0.1` (never remote).
- **Runs inside a repo root** (so file edits are local and predictable).
- **Speaks HTTP** to the extension.
- **Speaks ACP** to the agent CLI.

#### Local Bridge: where it lives in this pnpm monorepo

Add a new workspace package (example name: `@cognito/code-bridge`):

```text
cognito-ai/
  packages/
    code-bridge/
      package.json
      tsconfig.json
      src/
        cli.ts
        server.ts
        http/
          cors.ts
          json.ts
          auth.ts
        pairing/
          pairing.ts
          tokenStore.ts
        patch/
          patchStore.ts
          diffSafety.ts
          gitApply.ts
        acp/
          createProvider.ts
```

Why a **separate package**:
- The extension is browser code. The bridge is Node code. Keeping them separate avoids bundler confusion and makes publishing easier.

#### Local Bridge: `package.json` template (copy‑paste)

Use the same dev tooling pattern as other Node packages in this repo (`tsx watch` + `tsc` build).

```json
{
  "name": "@cognito/code-bridge",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist/cli.js",
  "bin": {
    "cognito-bridge": "dist/cli.js"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "dev": "tsx watch src/cli.ts",
    "build": "tsc",
    "start": "node dist/cli.js",
    "type:check": "tsc --noEmit"
  },
  "dependencies": {
    "ai": "catalog:",
    "zod": "catalog:",
    "@mcpc-tech/acp-ai-provider": "^0.2.2"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

Notes:
- `@mcpc-tech/acp-ai-provider` is an **ACP ↔ AI SDK bridge** library. It prevents you from implementing ACP low-level framing yourself.
- If you later want to publish publicly, you’ll set `"private": false` (see “Publishing” section below).

#### Local Bridge: `tsconfig.json` template (copy‑paste)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

#### Local Bridge: CLI entrypoint (`src/cli.ts`) — parse args + start server

This CLI:
- default bind: `127.0.0.1:8787`
- default cwd: `process.cwd()`
- prints pairing instructions at startup

```ts
import { startBridgeServer } from "./server";

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    console.log(`
Usage:
  cognito-bridge [--port 8787] [--host 127.0.0.1] [--cwd <path>]
`);
    process.exit(0);
  }

  const port = Number(getArg("--port") || "8787");
  const host = getArg("--host") || "127.0.0.1";
  const cwd = getArg("--cwd") || process.cwd();

  await startBridgeServer({ host, port, cwd });
}

main().catch((err) => {
  console.error("[cognito-bridge] fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

#### Local Bridge: CORS middleware (`src/http/cors.ts`)

Your extension requests originate from `chrome-extension://<extension-id>`.

For MVP:
- allow `chrome-extension://*`
- allow `http://localhost:*` for debugging
- reflect the exact origin

```ts
import type http from "node:http";

function isAllowedOrigin(origin: string): boolean {
  if (origin.startsWith("chrome-extension://")) return true;
  if (origin.startsWith("http://localhost")) return true;
  if (origin.startsWith("http://127.0.0.1")) return true;
  return false;
}

export function handleCors(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }

  return false;
}
```

#### Local Bridge: JSON body parser (`src/http/json.ts`)

```ts
import type http from "node:http";

export async function readJson(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) return {};
  return JSON.parse(raw);
}
```

#### Local Bridge: pairing + token storage (detailed)

**Pairing goal**: ensure a random webpage can’t silently talk to the bridge.

**MVP pairing design**
- Bridge prints a short-lived code on startup.
- User copies code into extension.
- Extension exchanges code → token (`/pair/confirm`).
- Bridge persists token hashes in `~/.cognito/bridge/tokens.json`.

```ts
// src/pairing/tokenStore.ts
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TOKENS_PATH = path.join(os.homedir(), ".cognito", "bridge", "tokens.json");

export interface StoredToken {
  tokenHash: string;
  createdAt: number;
  lastUsedAt?: number;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hashToken(token: string): string {
  return sha256(token);
}

async function ensureDir() {
  await fs.mkdir(path.dirname(TOKENS_PATH), { recursive: true });
}

export async function loadTokens(): Promise<StoredToken[]> {
  try {
    const raw = await fs.readFile(TOKENS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveTokens(tokens: StoredToken[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2) + "\n", "utf-8");
}
```

#### Local Bridge: auth middleware (`src/http/auth.ts`)

Require `Authorization: Bearer <token>` for all endpoints except `/health` and `/pair/confirm`.

```ts
import type http from "node:http";
import { hashToken } from "../pairing/tokenStore";
import { loadTokens, saveTokens } from "../pairing/tokenStore";

export async function requireAuth(req: http.IncomingMessage, res: http.ServerResponse): Promise<
  { ok: true; tokenHash: string } | { ok: false }
> {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Missing Authorization header" }));
    return { ok: false };
  }

  const token = match[1];
  const tokenHash = hashToken(token);
  const tokens = await loadTokens();
  const found = tokens.find((t) => t.tokenHash === tokenHash);
  if (!found) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Invalid token" }));
    return { ok: false };
  }

  found.lastUsedAt = Date.now();
  await saveTokens(tokens);
  return { ok: true, tokenHash };
}
```

#### Local Bridge: ACP provider adapter (concrete)

```ts
// src/acp/createProvider.ts
import { createACPProvider } from "@mcpc-tech/acp-ai-provider";

export function createAcpProviderAdapter(params: {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
}) {
  const provider = createACPProvider({
    command: params.command,
    args: params.args,
    env: params.env,
    session: { cwd: params.cwd, mcpServers: [] },
  });

  return {
    tools: provider.tools,
    initSession: () => provider.initSession(),
    setMode: (mode: string) => provider.setMode(mode),
    setModel: (model: string) => provider.setModel(model),
    languageModel: () => provider.languageModel(),
    cleanup: () => provider.cleanup(),
  };
}
```

#### Local Bridge: patch store + apply (very concrete)

Store patches in memory (fast) and bind to tokenHash:

```ts
// src/patch/patchStore.ts
export interface StoredPatch {
  patchId: string;
  unifiedDiff: string;
  summary?: string;
  createdAt: number;
  tokenHash: string;
}

export function createPatchStore() {
  const store = new Map<string, StoredPatch>();
  return {
    save(p: StoredPatch) { store.set(p.patchId, p); },
    get(patchId: string, tokenHash: string) {
      const p = store.get(patchId);
      if (!p) return null;
      if (p.tokenHash !== tokenHash) return null;
      return p;
    },
  };
}
```

Apply patches with `git apply` (Windows-friendly). Always do `--check` first.

```ts
// src/patch/gitApply.ts
import { spawn } from "node:child_process";

export function extractPatchedFiles(unifiedDiff: string): string[] {
  const files = new Set<string>();
  const re = /^diff --git a\/(.+?) b\/(.+)$/gm;
  for (const m of unifiedDiff.matchAll(re)) {
    if (m[1]) files.add(m[1]);
    if (m[2]) files.add(m[2]);
  }
  return Array.from(files);
}

export function assertSafeDiff(unifiedDiff: string) {
  const bytes = Buffer.byteLength(unifiedDiff, "utf-8");
  if (bytes > 2_000_000) throw new Error("Diff too large");
  for (const p of extractPatchedFiles(unifiedDiff)) {
    if (p.startsWith("/") || p.includes("..")) throw new Error(`Unsafe path in diff: ${p}`);
  }
}

function runGitApply(args: string[], cwd: string, unifiedDiff: string): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("git", ["apply", ...args, "-"], { cwd, stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString("utf-8")));
    child.on("close", (code) => resolve({ ok: code === 0, stderr }));
    child.stdin.write(unifiedDiff, "utf-8");
    child.stdin.end();
  });
}

export async function applyWithGit(opts: { cwd: string; unifiedDiff: string }) {
  assertSafeDiff(opts.unifiedDiff);
  const filesChanged = extractPatchedFiles(opts.unifiedDiff);

  const check = await runGitApply(["--check"], opts.cwd, opts.unifiedDiff);
  if (!check.ok) return { applied: false, filesChanged, error: check.stderr };

  const apply = await runGitApply([], opts.cwd, opts.unifiedDiff);
  if (!apply.ok) return { applied: false, filesChanged, error: apply.stderr };

  return { applied: true, filesChanged };
}
```

#### Publishing / distribution (detailed)

**Option A (fastest, monorepo only)**:
- Add a root script:
  - `"dev:bridge": "pnpm --filter @cognito/code-bridge dev"`
- Users run: `pnpm dev:bridge`

**Option B (publish to npm)**:
1) set `"private": false` in the bridge package
2) ensure `bin` points to built JS (`dist/cli.js`)
3) run:
   - `pnpm --filter @cognito/code-bridge build`
   - `pnpm --filter @cognito/code-bridge publish --access public`

---

### Data contracts (TypeScript interfaces)

Use these payload shapes across extension ↔ bridge. Keep them stable.

```ts
// A single element the user selected in the page
export interface CodeModeElementContext {
  url: string;                 // active tab URL
  title?: string;              // document.title
  selector?: string;           // best-effort CSS selector

  tagName: string;
  id?: string;
  classList: string[];

  textPreview?: string;        // truncated visible text
  outerHtmlPreview?: string;   // sanitized + truncated

  boundingBox?: { top: number; left: number; width: number; height: number };

  // Optional: minimal computed style subset for UI debugging
  computedStyle?: {
    display?: string;
    position?: string;
    zIndex?: string;
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontFamily?: string;
  };

  // Optional: screenshot data URL (expensive; MVP can skip)
  screenshotDataUrl?: string;

  // Optional: if you later add build-time instrumentation
  sourceHint?: {
    filePath?: string;
    line?: number;
    column?: number;
    componentName?: string;
  };
}

export interface CodeModeChatRequest {
  // AI SDK v6 UI message array (or your simplified equivalent)
  messages: Array<{
    role: "user" | "assistant";
    content: Array<{ type: "text"; text: string }>;
  }>;

  elementContext?: CodeModeElementContext;

  agent: {
    name: string;
    command: string;
    args: string[];
    // Optional: mode/model knobs when supported by the agent
    acpMode?: string;
    acpModel?: string;
  };

  // Pairing token issued by the bridge
  auth: { token: string };

  // Optional session ID so multiple requests share context
  sessionId?: string;
}

export interface PatchProposal {
  id: string;                 // stable id for approval/apply
  unifiedDiff: string;        // standard unified diff
  summary?: string;           // short explanation shown in UI
}
```

---

### Local Bridge server: API surface (minimal)

**Endpoints**

- `GET /health`
  - returns `{ ok: true, version: "…" }`

- `POST /pair/start`
  - returns `{ code: "123-456", expiresAt: number }`

- `POST /pair/confirm`
  - input: `{ code: string }`
  - returns `{ token: "…" }`

- `POST /code/chat`
  - input: `CodeModeChatRequest`
  - returns: **AI SDK UI message stream** (text deltas + tool parts)

- `POST /code/patch/apply`
  - input: `{ token: string, patchId: string }`
  - returns: `{ applied: true, filesChanged: number }`

---

### Local Bridge server: ACP streaming pattern (copy‑pastable template)

This is a simplified Node handler showing the core pattern:

1) Convert incoming UI messages → model messages  
2) Create ACP provider (spawns the agent CLI)  
3) `streamText()` using the ACP provider as the “model”  
4) Return `toUIMessageStreamResponse()` to the extension

```ts
import http from "node:http";
import { streamText, convertToModelMessages } from "ai";
import { z } from "zod";

// You will implement or adopt a small ACP wrapper that provides:
// - languageModel(): AI SDK compatible model
// - tools: tool definitions exposed by the agent
// - initSession(), setMode(), setModel(), cleanup()
//
// In production, enforce timeouts and always cleanup child processes.
function createAcpProvider(params: {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
}) {
  // TODO: implement ACP client wrapper or use an ACP provider library.
  // Must return:
  // {
  //   initSession(): Promise<void>
  //   setMode(mode: string): Promise<void>
  //   setModel(model: string): Promise<void>
  //   cleanup(): void
  //   languageModel(): any
  //   tools: Record<string, any>
  // }
  throw new Error("Not implemented");
}

// Tool schema for patch proposals (model must call this when ready)
const proposePatchSchema = z.object({
  patchId: z.string().min(1),
  unifiedDiff: z.string().min(1),
  summary: z.string().optional(),
});

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString("utf-8")));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export function handleCodeChat(req: http.IncomingMessage, res: http.ServerResponse) {
  (async () => {
    const body = await readJsonBody(req);

    // TODO: validate token, rate-limit, etc.
    const { messages, agent, elementContext } = body;

    const provider = createAcpProvider({
      command: agent.command,
      args: agent.args,
      cwd: process.cwd(),
      env: process.env as Record<string, string | undefined>,
    });

    // Cleanup on disconnect
    req.on("close", () => {
      try { provider.cleanup(); } catch {}
    });

    await provider.initSession();
    if (agent.acpMode) await provider.setMode(agent.acpMode);
    if (agent.acpModel) await provider.setModel(agent.acpModel);

    const systemPrompt = [
      "You are a coding agent operating on a local repository on disk.",
      "You MUST propose changes as a unified diff by calling propose_patch when ready.",
      "Do NOT apply changes yourself unless explicitly instructed.",
      elementContext
        ? `Selected element context:\\n${JSON.stringify(elementContext, null, 2)}`
        : "No element context was provided.",
    ].join("\\n\\n");

    const result = streamText({
      model: provider.languageModel(),
      includeRawChunks: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...convertToModelMessages(messages),
      ],
      tools: {
        ...provider.tools,
        propose_patch: {
          description: "Propose a patch as a unified diff. The UI will show it to the user for approval.",
          inputSchema: proposePatchSchema,
          execute: async (args) => {
            // Store proposal server-side so /code/patch/apply can apply it later
            // Example storage: in-memory Map<patchId, unifiedDiff>
            return { ok: true };
          },
        },
      },
    });

    const response = result.toUIMessageStreamResponse({
      onError: (err) => (err instanceof Error ? err.message : String(err)),
    });

    // Copy headers + stream
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.statusCode = response.status;

    if (!response.body) {
      res.end();
      return;
    }

    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      res.end();
      provider.cleanup();
    }
  })().catch((e) => {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
  });
}
```

---

### Agent definitions (what the side panel should show)

The extension should present a curated list of agents. Each agent is described by:
- `name`
- `command` and `args` to start ACP mode
- optional required env vars (for UX hints only)

Example list (adapt as needed):

```ts
export const CODE_MODE_AGENTS = [
  {
    name: "Gemini CLI",
    command: "gemini",
    args: ["--experimental-acp"],
    envHints: ["GEMINI_API_KEY"],
  },
  {
    name: "Claude Code",
    command: "npx",
    args: ["-y", "@zed-industries/claude-code-acp"],
    envHints: ["ANTHROPIC_API_KEY"],
  },
  {
    name: "Codex CLI",
    command: "npx",
    args: ["-y", "@zed-industries/codex-acp"],
    envHints: ["OPENAI_API_KEY"],
  },
];
```

Bridge should also expose `GET /agents` so the UI can show:
- whether `command` is found on PATH
- optional agent capabilities (supports mode/model selection or not)

---

### Element Picker: content-script implementation template (copy‑pastable)

This is a minimal picker pattern that:
- shows crosshair cursor
- highlights element under cursor
- on click, extracts a safe context payload
- cleans up listeners + injected DOM

```ts
type PickResult = {
  ok: true;
  context: {
    url: string;
    title?: string;
    selector?: string;
    tagName: string;
    id?: string;
    classList: string[];
    textPreview?: string;
    outerHtmlPreview?: string;
    boundingBox?: { top: number; left: number; width: number; height: number };
  };
} | { ok: false; error: string };

function isSensitiveInput(el: Element): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  const type = (el instanceof HTMLInputElement ? el.type : "").toLowerCase();
  const ac = (el.getAttribute("autocomplete") || "").toLowerCase();
  const name = (el.getAttribute("name") || "").toLowerCase();
  const id = (el.getAttribute("id") || "").toLowerCase();

  if (type === "password") return true;
  if (["cc-number", "cc-exp", "cc-csc", "current-password", "new-password"].includes(ac)) return true;
  if (/password|card|cvv|csc|ssn|secret|pin/.test(name) || /password|card|cvv|csc|ssn|secret|pin/.test(id)) return true;
  return false;
}

function buildSelector(el: Element): string | undefined {
  // Best-effort: prefer ID, else tag + first safe class, else tag
  const id = (el as HTMLElement).id;
  if (id) return `#${CSS.escape(id)}`;

  const classList = Array.from((el as HTMLElement).classList || []).filter(Boolean);
  const safe = classList.find((c) => {
    try { document.querySelectorAll(`.${CSS.escape(c)}`); return true; } catch { return false; }
  });
  if (safe) return `${el.tagName.toLowerCase()}.${CSS.escape(safe)}`;
  return el.tagName.toLowerCase();
}

export function startElementPicker(): Promise<PickResult> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "bottom:0",
      "pointer-events:none",
      "z-index:2147483647",
    ].join(";");

    const box = document.createElement("div");
    box.style.cssText = [
      "position:absolute",
      "border:2px solid rgba(59,130,246,0.9)",
      "background:rgba(59,130,246,0.08)",
      "box-sizing:border-box",
      "border-radius:6px",
    ].join(";");

    overlay.appendChild(box);
    document.documentElement.appendChild(overlay);

    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "crosshair";

    const cleanup = () => {
      document.body.style.cursor = prevCursor;
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
    };

    let lastTarget: Element | null = null;

    const onMove = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || !(target instanceof Element)) return;
      lastTarget = target;
      const r = target.getBoundingClientRect();
      box.style.transform = `translate(${Math.round(r.left)}px, ${Math.round(r.top)}px)`;
      box.style.width = `${Math.round(r.width)}px`;
      box.style.height = `${Math.round(r.height)}px`;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
        resolve({ ok: false, error: "cancelled" });
      }
    };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const el = lastTarget;
      if (!el) {
        cleanup();
        resolve({ ok: false, error: "no-target" });
        return;
      }

      // SECURITY: never capture values from sensitive inputs
      if (isSensitiveInput(el)) {
        cleanup();
        resolve({ ok: false, error: "sensitive-element" });
        return;
      }

      const rect = el.getBoundingClientRect();
      const text = (el as HTMLElement).innerText || (el as HTMLElement).textContent || "";
      const textPreview = text.trim().slice(0, 200) || undefined;
      const outer = (el as HTMLElement).outerHTML || "";
      const outerHtmlPreview = outer.slice(0, 2000) || undefined;

      const ctx = {
        url: location.href,
        title: document.title,
        selector: buildSelector(el),
        tagName: el.tagName.toLowerCase(),
        id: (el as HTMLElement).id || undefined,
        classList: Array.from((el as HTMLElement).classList || []).slice(0, 20),
        textPreview,
        outerHtmlPreview,
        boundingBox: {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };

      cleanup();
      resolve({ ok: true, context: ctx });
    };

    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown, true);
  });
}
```

**Integration detail**: the content script should expose an RPC-like handler:
- Side panel → background → content script: “start picker”
- Content script → background → side panel: “picker result”

---

### Side panel UI behavior (precise)

When ToolsMode = `code`:

- Replace/augment the composer toolbar with:
  - **Agent selector** dropdown (Gemini/Claude/Codex)
  - **Pick element** button (crosshair icon)
  - **Bridge status** indicator (connected / needs pairing / offline)

- The input send action should:
  - include `elementContext` (if present)
  - include `agent` selection
  - include pairing token
  - send to `POST /code/chat` on localhost

- The message stream renderer should:
  - render text deltas normally
  - render `propose_patch` tool call with a **diff viewer**
  - show “Apply patch” button next to that diff

---

### Patch safety model (recommended)

**Do not let the agent apply changes directly to the real repo in MVP.**

Preferred MVP approach:

1) Agent produces patch via `propose_patch` tool call  
2) Bridge stores patch in memory (`Map<patchId, unifiedDiff>`)  
3) UI shows patch for approval  
4) Only when user clicks **Apply** does the bridge apply it (e.g., `git apply`)  

Enhancement:
- Apply into a new git branch or a git worktree, then merge after approval.

---

### Security checklist (MVP)

- **Localhost only**: Bridge binds to `127.0.0.1`, not `0.0.0.0`.
- **Pairing token**: Side panel must obtain a token via pairing and store it in extension storage.
- **Token required on every request**.
- **Rate limit** `/code/chat` per token.
- **Never** accept requests from arbitrary network interfaces.
- **Never** log secrets, patch contents, or full file contents to console by default.

---

### Testing plan (manual MVP)

- **Happy path**
  - start bridge
  - pair
  - switch to Code mode
  - pick element on a local dev page
  - request “Change this button label to X”
  - receive `propose_patch`
  - apply patch
  - refresh dev page and confirm change

- **Failure modes**
  - bridge not running → show “offline” with instructions
  - pairing expired → prompt re-pair
  - agent command missing → show error and suggest install command
  - patch apply fails → show error + keep patch visible for manual copy

---

### Optional (later): Better DOM → source mapping

To achieve “click element → exact file/line” reliably, add a **dev‑only build plugin** for Vite/Next/etc. that injects source metadata (file/line/component) into the rendered output. The picker then reads that metadata into `sourceHint`.

This is an enhancement layer; the MVP can succeed without it.

---

### Deep dive: extension-side wiring (how Code Mode works in the side panel)

This section is the “how to wire it” for the extension. It is written as steps + code patterns (not “edit file X” instructions) so it stays valid even if the repo moves.

#### Step 1: Add a new mode value (`code`)

You currently have a “mode selector” that toggles between tool presets. Add a new mode option:

- label: **Code**
- meaning: **route chat to Local Bridge** + show element picker + show agent selector

**Important design choice**:
- In Code mode, **the “model” is not the normal remote/BYOK model**. The “model” is the local ACP agent.
- So switching to Code mode should change the chat transport, not only the tool list.

#### Step 2: Add Code Mode UI controls (what appears near the input)

When Code mode is active, show a compact “Code Mode strip” near the composer:

- **Bridge status**
  - `● Connected` (green) when `/health` succeeds
  - `● Needs pairing` (yellow) when `/health` works but no token stored
  - `● Offline` (red) when fetch to `/health` fails

- **Pair button**
  - Opens a small modal: “Enter pairing code”
  - Calls `POST /pair/confirm`
  - Stores returned token

- **Agent selector**
  - Dropdown with agents (Gemini CLI / Claude Code / Codex CLI)
  - Optional “Model” dropdown (only if agent supports models)

- **Pick element button**
  - Triggers the content-script picker
  - Stores `elementContext` in UI state (display as an “attachment chip”)

#### Step 3: Bridge settings storage (minimal)

You need to persist three things:

- `bridgeBaseUrl` (default `http://127.0.0.1:8787`)
- `bridgeAuthToken` (from pairing)
- `selectedAgentName`

Example storage shape:

```ts
export interface CodeModeBridgeSettings {
  baseUrl: string;              // e.g. http://127.0.0.1:8787
  token?: string;               // Authorization token
  selectedAgentName?: string;   // "Gemini CLI"
}
```

#### Step 4: Bridge health check (polling)

Poll `/health` every ~3–5 seconds while the side panel is open in Code mode.

```ts
export async function checkBridgeHealth(baseUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/health`, { method: "GET" });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
```

#### Step 5: Pairing UI flow (copy‑paste pattern)

```ts
export async function pairWithBridge(baseUrl: string, code: string): Promise<{ token: string }> {
  const res = await fetch(`${baseUrl}/pair/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`Pairing failed (${res.status})`);
  return await res.json();
}
```

#### Step 6: Element picker messaging (side panel ↔ content script)

You need an RPC-like “start picker” message:

- Side panel → active tab content script: `code/picker/start`
- Content script returns: `{ ok: true, context } | { ok: false, error }`

Side panel “call picker” pattern:

```ts
export async function startPickerOnActiveTab(): Promise<any> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab");

  return await chrome.tabs.sendMessage(tab.id, { type: "code/picker/start" });
}
```

Content script handler pattern:

```ts
// In your content script entrypoint:
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "code/picker/start") return false;

  startElementPicker()
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }));

  return true; // async
});
```

#### Step 7: Code-mode chat request (how to talk to the bridge)

Your extension should call:
- `POST /code/chat`
- include `Authorization: Bearer <token>`
- include `messages`, `agent`, and `elementContext`

```ts
export async function postCodeChatStream(params: {
  baseUrl: string;
  token: string;
  payload: CodeModeChatRequest;
}): Promise<Response> {
  return await fetch(`${params.baseUrl}/code/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${params.token}`,
    },
    body: JSON.stringify(params.payload),
  });
}
```

**How the response streams**

If the bridge uses `toUIMessageStreamResponse()`, the HTTP response body is an **AI SDK UI message stream** (chunks describing text deltas + tool parts).

Implementation options:

- **Option A (recommended if you want fastest integration)**: Use the AI SDK React hook (`useChat`) with a transport that calls your bridge endpoint and streams UI message parts.
- **Option B (more control)**: Write a small stream parser that converts the UI stream into your internal message store format.

For MVP, Option A is usually faster.

#### Step 8: Patch proposal rendering (how the diff appears in side panel)

Your bridge will expose a tool named `propose_patch`. The tool call arguments contain:
- `patchId`
- `unifiedDiff`
- optional `summary`

In the side panel message renderer:
- detect tool call parts with `toolName === "propose_patch"`
- render a “PatchCard” UI with:
  - summary
  - file list (parse diff headers)
  - expandable diff text
  - Apply button

Diff file extraction helper (re-usable in UI):

```ts
export function extractFilesFromUnifiedDiff(diff: string): string[] {
  const files = new Set<string>();
  const re = /^diff --git a\/(.+?) b\/(.+)$/gm;
  for (const m of diff.matchAll(re)) {
    if (m[1]) files.add(m[1]);
    if (m[2]) files.add(m[2]);
  }
  return Array.from(files);
}
```

#### Step 9: Apply button (how to apply the patch)

```ts
export async function applyPatch(params: {
  baseUrl: string;
  token: string;
  patchId: string;
}): Promise<{ applied: boolean; filesChanged: string[]; error?: string }> {
  const res = await fetch(`${params.baseUrl}/code/patch/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${params.token}`,
    },
    body: JSON.stringify({ patchId: params.patchId }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { applied: false, filesChanged: json.filesChanged || [], error: json.error || `HTTP ${res.status}` };
  }
  return json;
}
```

After apply success:
- show a small “Applied patch” message in the chat
- optionally show “Reload tab” suggestion if the user is on a local dev page

---

### Very granular implementation checklist (tasks to add)

This is the “do this in order” checklist. It’s intentionally verbose so you can track progress.

#### Bridge package tasks

- **Create package**
  - [ ] Create `packages/code-bridge/`
  - [ ] Add `package.json` with `bin` entry (`cognito-bridge`)
  - [ ] Add `tsconfig.json`
  - [ ] Add `src/cli.ts` (parse args)
  - [ ] Add `src/server.ts` (http server)

- **Security**
  - [ ] Implement CORS allowlist for `chrome-extension://*`
  - [ ] Generate pairing code at startup
  - [ ] Implement `/pair/confirm`
  - [ ] Implement token store on disk (`~/.cognito/bridge/tokens.json`)
  - [ ] Require `Authorization: Bearer` on all code endpoints
  - [ ] Add in-memory rate limit per token for `/code/chat`

- **ACP integration**
  - [ ] Implement ACP provider adapter (spawn agent CLI)
  - [ ] Add agent capability detection (optional: list models/modes)
  - [ ] Add hard timeout + cleanup on disconnect

- **Patch lifecycle**
  - [ ] Implement `propose_patch` tool (store patch in memory)
  - [ ] Implement `/code/patch/apply`
  - [ ] Apply patch via `git apply --check` then `git apply`
  - [ ] Return `filesChanged` for UI display

- **Developer UX**
  - [ ] Print bridge URL + pairing code on startup
  - [ ] Provide `--cwd` option
  - [ ] Provide `--port` and `--host` options

#### Extension tasks

- **Mode**
  - [ ] Add `code` option to mode selector UI
  - [ ] Ensure switching to Code mode changes the “chat transport” to local bridge

- **Bridge settings + pairing**
  - [ ] Add storage for `bridgeBaseUrl` and `bridgeToken`
  - [ ] Add UI to input pairing code
  - [ ] Call `/pair/confirm` and store token
  - [ ] Add `/health` polling and status indicator

- **Element selection**
  - [ ] Implement content-script picker (crosshair + highlight)
  - [ ] Add messaging: `code/picker/start`
  - [ ] Store selected `elementContext` in state and show it above input

- **Chat streaming**
  - [ ] Implement code-mode chat POST to `/code/chat` with Authorization header
  - [ ] Stream UI response into side panel messages

- **Patch UI**
  - [ ] Detect `propose_patch` tool call parts
  - [ ] Render diff card with file list + expandable unified diff
  - [ ] Apply button calls `/code/patch/apply`
  - [ ] Show apply success/failure in chat

#### Optional enhancements (post-MVP)

- [ ] Add “Open in VSCode/Cursor” buttons (bridge can generate editor links)
- [ ] Add “apply to git worktree” preview flow (safer than direct apply)
- [ ] Add bundler plugin for DOM → source mapping (Vite/Next)


