# Adaptive Mode Architecture

This document provides comprehensive documentation for the Adaptive Mode system, which enables on-demand tool discovery and execution through a sandboxed iframe architecture.

## Table of Contents

1. [Overview](#overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Core Components](#core-components)
4. [Execution Flow](#execution-flow)
5. [Sandbox Architecture](#sandbox-architecture)
6. [Meta-Tools](#meta-tools)
7. [Security Layer](#security-layer)
8. [Data Flow Diagrams](#data-flow-diagrams)
9. [Sequence Diagrams](#sequence-diagrams)
10. [File Structure](#file-structure)

---

## Overview

Adaptive Mode is a context-efficient tool execution paradigm that differs from Chat and Agent modes by **not loading all tool definitions** into the LLM context. Instead, it provides:

1. **Lightweight Tool Index** - A compact list of tool names and descriptions
2. **On-Demand Discovery** - `discoverTools` meta-tool to search for specific tools
3. **Orchestrated Execution** - `executeTools` meta-tool to run JavaScript code that calls multiple tools

### Key Benefits

| Feature | Chat/Agent Mode | Adaptive Mode |
|---------|-----------------|---------------|
| Context Usage | High (all tool schemas) | Low (index + discovered) |
| Tool Access | Pre-defined subset | All available tools |
| Multi-step Tasks | Sequential tool calls | Single orchestration |
| Flexibility | Fixed tool set | Dynamic discovery |

### Mode Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TOOL MODE COMPARISON                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌────────────────────────────────┐  │
│   │  CHAT MODE  │    │ AGENT MODE  │    │        ADAPTIVE MODE           │  │
│   │             │    │             │    │                                │  │
│   │  ~7 tools   │    │ ~30 tools   │    │  5 tools + discovery           │  │
│   │             │    │             │    │                                │  │
│   │ • readPage  │    │ • navigate  │    │ • discoverTools                │  │
│   │ • screenshot│    │ • click     │    │ • executeTools                 │  │
│   │ • getTab    │    │ • type      │    │ • readPageContent              │  │
│   │ • switchTab │    │ • scroll    │    │ • takeScreenshot               │  │
│   │ • ...       │    │ • ...       │    │ • getActiveTab                 │  │
│   │             │    │             │    │                                │  │
│   │  Fixed      │    │  Fixed      │    │  Dynamic (all tools            │  │
│   │  subset     │    │  subset     │    │  via discovery)                │  │
│   └─────────────┘    └─────────────┘    └────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ADAPTIVE MODE ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      USER INPUT / LLM RESPONSE                       │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        AI LAYER (Side Panel)                         │   │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │   │
│   │  │ Adaptive System │  │   Tool Index    │  │   buildAdaptive     │  │   │
│   │  │     Prompt      │  │  (name + desc)  │  │   SystemPrompt()    │  │   │
│   │  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │                                       │
│                     ┌────────────────┼────────────────┐                     │
│                     ▼                ▼                ▼                     │
│   ┌──────────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│   │    discoverTools     │  │   executeTools   │  │  Pre-loaded Tools  │   │
│   │    (Meta-Tool)       │  │   (Meta-Tool)    │  │  (Direct Access)   │   │
│   │                      │  │                  │  │                    │   │
│   │  • Search by keyword │  │  • Validate code │  │  • readPageContent │   │
│   │  • Return tool list  │  │  • Send to       │  │  • takeScreenshot  │   │
│   │  • Include schemas   │  │    sandbox       │  │  • getActiveTab    │   │
│   │                      │  │  • Proxy tools   │  │                    │   │
│   └──────────────────────┘  └────────┬─────────┘  └────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        SECURITY LAYER                                │   │
│   │  ┌──────────────────────────────────────────────────────────────┐   │   │
│   │  │                    validateCode (AST)                         │   │   │
│   │  │                                                               │   │   │
│   │  │  ✗ Block: require, import, eval, Function, chrome, window    │   │   │
│   │  │  ✗ Block: fetch, XMLHttpRequest, WebSocket, setTimeout       │   │   │
│   │  │  ✗ Block: while loops, do-while loops                        │   │   │
│   │  │  ✗ Block: constructor.constructor chains                     │   │   │
│   │  │  ✓ Allow: tools.*, for loops, Promise.all, console           │   │   │
│   │  │                                                               │   │   │
│   │  └──────────────────────────────────────────────────────────────┘   │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    SANDBOX EXECUTION LAYER                           │   │
│   │  ┌────────────────────────┐       ┌─────────────────────────────┐   │   │
│   │  │    Main Extension      │◄─────►│   Sandboxed Iframe          │   │   │
│   │  │    (SandboxBridge)     │ post  │   (sandbox-executor)        │   │   │
│   │  │                        │Message│                             │   │   │
│   │  │  • createToolsProxy()  │       │  • No chrome.* APIs         │   │   │
│   │  │  • handleToolRequest() │       │  • new Function() allowed   │   │   │
│   │  │  • sendToolResult()    │       │  • Isolated execution       │   │   │
│   │  └────────────────────────┘       └─────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. System Prompt Builder (`adaptivePrompt.ts`)

Constructs the adaptive mode system prompt dynamically:

```typescript
async function buildAdaptiveSystemPrompt(): Promise<string>
```

**Sections Generated:**
- Core identity and workflow instructions
- Meta guidelines (refusal policy, obey user, etc.)
- Error recovery strategies
- Current date/time
- Behavior guidelines
- **Tool Index** (name + description for all available tools)
- Pre-loaded tools information

### 2. Meta-Tools (`src/ai/tools/meta/`)

| Tool | Purpose | Input | Output |
|------|---------|-------|--------|
| `discoverTools` | Search for tools by keyword | `{ query: string, includeSchema?: boolean }` | List of matching tools |
| `executeTools` | Execute JavaScript orchestration code (sandboxed) | `{ code: string }` | `{ output, success, error?, toolCalls? }` |

**Supporting modules (HITL + live rendering):**
- `executeToolsApproval.ts`: Approval promise bridge used to pause/resume sandbox tool calls
- `executeToolsLiveStore.ts`: Zustand store for live sub-tool call updates while `executeTools` is still running
- `types.ts`: `TrackedToolCall.state` includes `'pending-approval'` for paused tool calls

### 3. SandboxBridge (`SandboxBridge/SandboxBridge.ts`)

Singleton class managing iframe communication:

```typescript
class SandboxBridge {
    // Initialization
    async initialize(): Promise<void>
    
    // Code execution
    async executeCode(code, availableTools, toolExecutor, options): Promise<ExecutionResult>
    
    // Health monitoring
    getHealthStatus(): HealthStatus
    startHealthCheck(): void
    
    // Cleanup
    destroy(): void
}
```

**Key behaviors (Adaptive Mode):**
- **Tool call tracking**: records `TrackedToolCall[]` and returns them as `ExecutionResult.toolCalls`
- **Live streaming to UI**: pushes tool call updates into `useExecuteToolsLiveStore` so the UI can render sub-calls before `executeTools` completes
- **Human-in-the-loop approvals**: pauses sensitive tool calls (`pending-approval`) until the user approves/denies, then resumes execution

### 4. Sandbox Executor (`sandbox-executor/executor.ts`)

Runs in isolated iframe, handles:
- Receiving `EXECUTE_CODE` messages
- Creating tools proxy for code execution
- Sending `TOOL_REQUEST` for each tool call
- Returning `EXECUTE_RESULT` with output

### 5. Code Validator (`validateCode.ts`)

AST-based security analysis using `acorn`:

```typescript
function validateCode(code: string): ValidationResult {
    // Parse code into AST
    // Walk tree to check for forbidden patterns
    // Return { isValid: boolean, errors: string[] }
}
```

---

## Execution Flow

### Complete Adaptive Mode Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ADAPTIVE MODE EXECUTION FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

  User Request: "Navigate to Google and search for weather"
         │
         ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  Step 1: LLM checks Tool Index in system prompt                          │
  │                                                                          │
  │  Tool Index shows:                                                       │
  │  - navigateTo: Navigate to a URL                                         │
  │  - typeInField: Type text into an input field                            │
  │  - clickByText: Click element by text content                            │
  │  - readPageContent: Read current page text                               │
  └────────────────────────────────────────────────────────────────┬─────────┘
                                                                   │
         ┌─────────────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  Step 2: LLM calls discoverTools("navigate search type")                 │
  │                                                                          │
  │  Returns detailed information:                                           │
  │  {                                                                       │
  │    tools: [                                                              │
  │      { name: "navigateTo", description: "...", inputSchemaPreview: ...} │
  │      { name: "typeInField", description: "...", inputSchemaPreview: ...}│
  │    ]                                                                     │
  │  }                                                                       │
  └────────────────────────────────────────────────────────────────┬─────────┘
                                                                   │
         ┌─────────────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  Step 3: LLM writes orchestration code and calls executeTools            │
  │                                                                          │
  │  executeTools({                                                          │
  │    code: `                                                               │
  │      await tools.navigateTo({ url: "https://google.com" });              │
  │      await tools.typeInField({                                           │
  │        selector: 'input[name="q"]',                                      │
  │        text: "weather"                                                   │
  │      });                                                                 │
  │      await tools.clickByText({ text: "Google Search" });                 │
  │      return await tools.readPageContent({});                             │
  │    `                                                                     │
  │  })                                                                      │
  └────────────────────────────────────────────────────────────────┬─────────┘
                                                                   │
         ┌─────────────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  Step 4: executeTools internal processing                                │
  │                                                                          │
  │  4a. validateCode(code)  ───► Check AST for security violations          │
  │  4b. Gather all tools    ───► Extension + MCP + WebMCP tools            │
  │  4c. executeInSandbox()  ───► Send code to iframe                        │
  └────────────────────────────────────────────────────────────────┬─────────┘
                                                                   │
         ┌─────────────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  Step 5: Sandbox executes code with tool proxy                           │
  │                                                                          │
  │  For each tools.* call:                                                  │
  │    Sandbox ──TOOL_REQUEST──► Main Thread                                 │
  │    Main Thread executes tool                                             │
  │    Main Thread ──TOOL_RESULT──► Sandbox                                  │
  │                                                                          │
  │  Final result returned to executeTools                                   │
  └────────────────────────────────────────────────────────────────┬─────────┘
                                                                   │
         ▼
  LLM receives result and responds to user
```

---

## Sandbox Architecture

### Why Sandboxed Iframe?

Chrome Extension Manifest V3 CSP blocks `new Function()` and `eval()` in extension pages. The sandbox provides:

1. **Relaxed CSP** - Allows dynamic code execution
2. **Isolation** - No access to `chrome.*` APIs
3. **Security** - Code validated before execution

### Sandbox Communication Protocol

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SANDBOX MESSAGE PROTOCOL                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   MAIN EXTENSION                              SANDBOXED IFRAME               │
│   (Side Panel)                                (sandbox-executor.html)        │
│   ─────────────                               ───────────────────────        │
│                                                                              │
│   ┌──────────────────┐                        ┌──────────────────────┐       │
│   │  SandboxBridge   │                        │   executor.ts        │       │
│   │                  │                        │                      │       │
│   │  On Init:        │                        │  On Load:            │       │
│   │  - Create iframe │ ───src="...html"────►  │  - Setup listeners   │       │
│   │  - Listen msgs   │                        │  - Security check    │       │
│   │                  │ ◄─SANDBOX_READY──────  │  - Send ready        │       │
│   │                  │                        │                      │       │
│   │  On Execute:     │                        │                      │       │
│   │                  │ ──EXECUTE_CODE───────► │  - Create tools proxy│       │
│   │                  │   { requestId,         │  - new Function(code)│       │
│   │                  │     code,              │  - Execute async     │       │
│   │                  │     availableTools }   │                      │       │
│   │                  │                        │                      │       │
│   │  On Tool Call:   │ ◄─TOOL_REQUEST──────  │  For each tools.x(): │       │
│   │  - Execute tool  │   { requestId,         │  - Send request      │       │
│   │  - Serialize     │     callId,            │  - Wait for result   │       │
│   │    result        │     toolName,          │                      │       │
│   │                  │     args }             │                      │       │
│   │                  │ ──TOOL_RESULT────────► │  - Resolve promise   │       │
│   │                  │   { callId,            │  - Continue code     │       │
│   │                  │     result|error }     │                      │       │
│   │                  │                        │                      │       │
│   │  On Complete:    │ ◄─EXECUTE_RESULT─────  │  Return final result │       │
│   │  - Return to AI  │   { requestId,         │                      │       │
│   │                  │     success,           │                      │       │
│   │                  │     result|error }     │                      │       │
│   └──────────────────┘                        └──────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Message Types

```typescript
// Main → Sandbox
interface ExecuteCodeMessage {
    type: 'EXECUTE_CODE';
    requestId: string;
    code: string;
    availableTools: string[];
}

interface ToolResultMessage {
    type: 'TOOL_RESULT';
    callId: string;
    result?: unknown;
    error?: string;
}

// Sandbox → Main
interface SandboxReadyMessage {
    type: 'SANDBOX_READY';
}

interface ToolRequestMessage {
    type: 'TOOL_REQUEST';
    requestId: string;
    callId: string;
    toolName: string;
    args: unknown[];
}

interface ExecuteResultMessage {
    type: 'EXECUTE_RESULT';
    requestId: string;
    success: boolean;
    result?: unknown;
    error?: string;
    errorDetails?: { type: string; stack?: string };
}
```

---

## Meta-Tools

### discoverTools

**Purpose:** Search for available tools without loading full schemas into context.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        discoverTools FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Input: { query: "navigate", includeSchema: true }                         │
│          │                                                                   │
│          ▼                                                                   │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │                    Tool Sources Aggregation                       │      │
│   │                                                                   │      │
│   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │      │
│   │   │  Extension   │  │    MCP       │  │     WebMCP           │  │      │
│   │   │    Tools     │  │   Tools      │  │     Tools            │  │      │
│   │   │  (registry)  │  │  (servers)   │  │   (active tab)       │  │      │
│   │   └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │      │
│   │          │                 │                      │              │      │
│   │          └─────────────────┼──────────────────────┘              │      │
│   │                            ▼                                     │      │
│   │                    Combine All Tools                             │      │
│   └────────────────────────────┬─────────────────────────────────────┘      │
│                                │                                             │
│                                ▼                                             │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │                    Regex Search                                   │      │
│   │                                                                   │      │
│   │   Match query "navigate" against:                                │      │
│   │   - Tool names                                                   │      │
│   │   - Tool descriptions                                            │      │
│   │   - Schema property names                                        │      │
│   └────────────────────────────┬─────────────────────────────────────┘      │
│                                │                                             │
│                                ▼                                             │
│   Output: {                                                                  │
│     message: "Found 2 tools matching 'navigate'",                           │
│     tools: [                                                                 │
│       { name: "navigateTo", description: "...", inputSchemaPreview: "..." } │
│       { name: "navigateBack", description: "...", inputSchemaPreview: "..." }│
│     ],                                                                       │
│     totalAvailable: 45                                                       │
│   }                                                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### executeTools

**Purpose:** Execute JavaScript code that orchestrates multiple tool calls.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        executeTools FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Input: {                                                                   │
│     code: `                                                                  │
│       const tabs = await tools.getAllTabs({});                               │
│       return tabs.filter(t => t.title.includes("Google"));                  │
│     `                                                                        │
│   }                                                                          │
│          │                                                                   │
│          ▼                                                                   │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  Step 1: AST Validation (validateCode)                           │      │
│   │                                                                   │      │
│   │  Parse with acorn → Walk AST → Check for:                        │      │
│   │  ✗ FORBIDDEN_IDENTIFIERS (require, eval, chrome, etc.)          │      │
│   │  ✗ Unauthorized globals (only ALLOWED_GLOBALS permitted)         │      │
│   │  ✗ Infinite loop patterns (while, do-while)                      │      │
│   │  ✗ Constructor chains (obj.constructor.constructor)             │      │
│   │                                                                   │      │
│   │  If invalid → Return error immediately                           │      │
│   └────────────────────────────────────────────────────────┬─────────┘      │
│                                                            │                 │
│                                                            ▼                 │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  Step 2: Gather Available Tools                                  │      │
│   │                                                                   │      │
│   │  allTools = { ...extensionTools, ...mcpTools, ...webmcpTools }  │      │
│   │  availableToolNames = Object.keys(allTools)                      │      │
│   └────────────────────────────────────────────────────────┬─────────┘      │
│                                                            │                 │
│                                                            ▼                 │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  Step 3: Create Tool Executor Callback                           │      │
│   │                                                                   │      │
│   │  toolExecutor = async (toolName, args) => {                      │      │
│   │    // MCP tools: execute is stripped (HITL) → use stored executor │      │
│   │    if (isMcpToolFromRegistry(toolName))                           │      │
│   │      return await getMcpToolExecutor(toolName)(args[0]);          │      │
│   │    // WebMCP tools: execute is stripped (HITL) → use stored exec  │      │
│   │    if (toolName.startsWith('webmcp_'))                            │      │
│   │      return await getWebmcpToolExecutor(toolName)(args[0] ?? {}); │      │
│   │    // Built-in / extension tools                                  │      │
│   │    const tool = allTools[toolName];                               │      │
│   │    return await tool.execute(...args);                             │      │
│   │  }                                                                │      │
│   └────────────────────────────────────────────────────────┬─────────┘      │
│                                                            │                 │
│                                                            ▼                 │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  Step 4: Execute in Sandbox                                      │      │
│   │                                                                   │      │
│   │  executeInSandbox(code, availableToolNames, toolExecutor)        │      │
│   │    │                                                              │      │
│   │    ├─► Initialize sandbox if needed                              │      │
│   │    ├─► Send EXECUTE_CODE message                                 │      │
│   │    ├─► Handle TOOL_REQUEST messages (may pause for approval)     │      │
│   │    ├─► Send TOOL_RESULT back to sandbox                          │      │
│   │    └─► Receive EXECUTE_RESULT when complete                      │      │
│   └────────────────────────────────────────────────────────┬─────────┘      │
│                                                            │                 │
│                                                            ▼                 │
│   Output: {                                                                  │
│     output: "[{title: 'Google', url: '...'}]",                              │
│     success: true,                                                           │
│     toolCalls: [ /* TrackedToolCall[] */ ]                                    │
│   }                                                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Tool Execution Routing (Built-in vs MCP vs WebMCP)

In Adaptive Mode, **MCP** and **WebMCP** tool objects are intentionally exposed without an `.execute` function (because execution is gated by approvals). `executeTools` therefore routes execution via stored executors:

- **MCP tools**: `@/utils/mcp/toolMetadataStore` → `getMcpToolExecutor(toolName)`
- **WebMCP tools**: `src/ai/tools/webmcpTools` → `getWebmcpToolExecutor(toolName)`
- **Built-in / extension tools**: `tool.execute(...)` as usual

This fixes the root issue where sandbox tool execution previously assumed every tool had `tool.execute`.

#### Human-in-the-Loop Approval for Sandbox Tool Calls

When sandboxed code calls `tools.<name>()`, the sandbox sends a `TOOL_REQUEST`. The main thread (`SandboxBridge`) decides whether to pause for approval:

- **Approval required for:**
  - WebMCP tools: `toolName.startsWith('webmcp_')`
  - MCP tools: `isMcpTool(toolName)` from the tool metadata registry
  - Built-in sensitive tools: `TOOLS_REQUIRING_APPROVAL`

**Flow inside `SandboxBridge` (on each `TOOL_REQUEST`):**
1. Create a `TrackedToolCall` with `state: 'pending-approval'` (or `'loading'` for safe tools)
2. Push live updates to `useExecuteToolsLiveStore` (so UI can render immediately)
3. If approval is required, await `waitForSandboxToolApproval(callId, abortSignal?)`
4. On approve → switch to `'loading'`, execute the tool, then `'success'`
5. On deny → send `TOOL_RESULT` back to the sandbox with `error`, and mark the tracked call as `'error'`

**Approval bridge API (`executeToolsApproval.ts`):**
- `waitForSandboxToolApproval(callId, abortSignal?)`
- `approveSandboxToolCall(callId)`
- `denySandboxToolCall(callId, reason?)`

#### Live Sub-Tool Call UI (while `executeTools` is still running)

Unlike normal tool calls (which render directly as their own tool cards), `executeTools` can contain **multiple** sub-tool calls. To keep the UI responsive:

- `executeToolsLiveStore.ts` exposes `useExecuteToolsLiveStore` with:
  - `startExecution(requestId)` – clears previous live calls
  - `updateToolCalls(requestId, toolCalls)` – publishes live updates
  - `clear()` – resets store
- `ExecuteToolsRenderer.tsx` renders `useExecuteToolsLiveStore().toolCalls` while `executeTools` is still in its loading state.
- `ExecuteToolsRenderer.tsx` uses an internal `ExecuteToolsToolCallCard` that mirrors `CompactToolRenderer` approval UX and resolves sandbox approvals via `approveSandboxToolCall(callId)` / `denySandboxToolCall(callId)`.
- When any sub-call is `pending-approval`, the header switches from **"Executing code..."** to **"Waiting for approval..."** to reflect the paused state.

#### Loading Indicator Behavior (avoid “Analyzing…” under approvals)

The chat-level loading shimmer (“Thinking… / Analyzing…”) is only shown when the last assistant message has **no renderable parts**. To prevent noisy UI while `executeTools` is paused:

- In `src/components/features/chat/components/display/ChatMessages/ChatMessages.tsx`, we treat AI SDK v6 tool parts (`tool-input-available`, `tool-output-available`, `tool-*`, `dynamic-tool`) as message content.
- Result: while a tool approval card is visible, the global loading indicator stays hidden (matching the non-adaptive approval experience).

---

## Security Layer

### AST-Based Code Validation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SECURITY VALIDATION LAYERS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Layer 1: FORBIDDEN IDENTIFIERS (Blocklist)                                │
│   ─────────────────────────────────────────                                  │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  require   │  import    │  eval     │  Function   │  process       │    │
│   │  global    │  globalThis│  __dirname│  module     │  exports       │    │
│   │  setTimeout│  setInterval│  chrome   │  window     │  document     │    │
│   │  fetch     │  XMLHttpRequest│  WebSocket│            │               │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   Layer 2: ALLOWED GLOBALS (Allowlist)                                       │
│   ────────────────────────────────────                                       │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  Array     │  Boolean   │  Date     │  Error      │  JSON          │    │
│   │  Math      │  Number    │  Object   │  String     │  RegExp        │    │
│   │  Map       │  Set       │  Promise  │  parseInt   │  parseFloat    │    │
│   │  isNaN     │  isFinite  │  undefined│  NaN        │  Infinity      │    │
│   │  console   │  tools     │           │             │                │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   Layer 3: PATTERN DETECTION                                                 │
│   ──────────────────────────                                                 │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  • Import/Export statements                                        │    │
│   │  • Constructor chain access (obj.constructor.constructor)          │    │
│   │  • while/do-while loops (infinite loop risk)                       │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   Layer 4: SANDBOX ISOLATION                                                 │
│   ──────────────────────────                                                 │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  • Runs in iframe with separate origin                             │    │
│   │  • No chrome.* API access (verified on load)                       │    │
│   │  • Communication only via postMessage                              │    │
│   │  • Tool calls proxied through main extension                       │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Validation Process

```typescript
// Pseudo-code for validation flow
function validateCode(code: string): ValidationResult {
    // 1. Parse code into AST
    const ast = acorn.parse(`(async () => {\n${code}\n})()`);
    
    // 2. First pass: collect all declared variables
    collectDeclarations(ast);  // const, let, var, function params, etc.
    
    // 3. Second pass: validate
    walk(ast, {
        Identifier: (node) => {
            // Check forbidden identifiers
            if (FORBIDDEN_IDENTIFIERS.has(node.name)) {
                errors.push(`Forbidden: ${node.name}`);
            }
            // Check global access is allowed
            if (!declaredVariables.has(node.name) && 
                !ALLOWED_GLOBALS.has(node.name)) {
                errors.push(`Unauthorized global: ${node.name}`);
            }
        },
        WhileStatement: () => errors.push('while loops not allowed'),
        MemberExpression: (node) => {
            // Check for constructor.constructor chains
        }
    });
    
    return { isValid: errors.length === 0, errors };
}
```

---

## Data Flow Diagrams

### Tool Collection and Filtering

> **Note:** In Adaptive mode, **remote/stdio MCP tools are excluded** from the upfront tool index to keep the system prompt lightweight. They remain fully accessible via `discoverTools` and `executeTools`. WebMCP tools (page-specific) are included in the index because they're contextual to the current page.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TOOL AGGREGATION FOR ADAPTIVE MODE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │                         Tool Sources                                │    │
│   │                                                                     │    │
│   │   ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐  │    │
│   │   │  Extension   │   │  Remote MCP  │   │      WebMCP          │  │    │
│   │   │    Tools     │   │    Tools     │   │      Tools           │  │    │
│   │   │              │   │              │   │                      │  │    │
│   │   │ getAllTools()│   │getMCPTools() │   │getWebMCPTools()      │  │    │
│   │   │              │   │  (Notion,    │   │   From Active        │  │    │
│   │   │ ~45 tools    │   │   etc.)      │   │      Tab             │  │    │
│   │   └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘  │    │
│   │          │                  │                       │              │    │
│   └──────────┼──────────────────┼───────────────────────┼──────────────┘    │
│              │                  │                       │                    │
│   ───────────┴──────────────────┴───────────────────────┴──────────────────  │
│                                 │                                            │
│   ┌─────────────────────────────┼─────────────────────────────────────────┐  │
│   │                             │                                         │  │
│   │  ┌──────────────────────────▼─────────────────────────────────────┐  │  │
│   │  │               discoverToolsInMemory()                           │  │  │
│   │  │                                                                 │  │  │
│   │  │   ✓ Extension Tools    ✓ MCP Tools    ✓ WebMCP Tools           │  │  │
│   │  │                                                                 │  │  │
│   │  │   Used by discoverTools to search ALL available tools          │  │  │
│   │  └─────────────────────────────────────────────────────────────────┘  │  │
│   │                                                                       │  │
│   │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│   │  │                   getToolIndex()                                 │  │  │
│   │  │                                                                  │  │  │
│   │  │   ✓ Extension Tools    ✗ MCP Tools    ✓ WebMCP Tools            │  │  │
│   │  │                       (EXCLUDED)      (page-specific)           │  │  │
│   │  │                                                                  │  │  │
│   │  │   Used to build lightweight system prompt tool index             │  │  │
│   │  └─────────────────────────────────────────────────────────────────┘  │  │
│   │                                                                       │  │
│   └───────────────────────────────────────────────────────────────────────┘  │
│                                 │                                            │
│                                 ▼                                            │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │                    System Prompt Construction                       │    │
│   │                                                                     │    │
│   │   ## Available Tools Index (~45 tools, excludes remote MCP)         │    │
│   │   Use discoverTools("keyword") to get full details:                │    │
│   │                                                                     │    │
│   │   - **addMemory**: Add information to long-term memory             │    │
│   │   - **readPageContent**: Extract page content with modes...        │    │
│   │   - **applyTabGroups**: Group browser tabs...                      │    │
│   │   - ...                                                             │    │
│   │                                                                     │    │
│   │   Note: Remote MCP tools (Notion, etc.) can be discovered          │    │
│   │   on-demand via discoverTools("notion")                            │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```


### Sandbox Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SANDBOX LIFECYCLE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   App Startup                                                                │
│       │                                                                      │
│       ▼                                                                      │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │                    useSandbox Hook                                  │    │
│   │                                                                     │    │
│   │   useEffect(() => {                                                 │    │
│   │     initializeSandbox();  // Lazy init on component mount          │    │
│   │   }, []);                                                           │    │
│   └────────────────────┬───────────────────────────────────────────────┘    │
│                        │                                                     │
│                        ▼                                                     │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │                 SandboxBridge.initialize()                          │    │
│   │                                                                     │    │
│   │   1. Create hidden iframe                                           │    │
│   │      - src = chrome.runtime.getURL('sandbox-executor.html')        │    │
│   │      - style = display:none, position:absolute, top:-9999px         │    │
│   │                                                                     │    │
│   │   2. Add to document.body                                           │    │
│   │                                                                     │    │
│   │   3. Setup message listener                                         │    │
│   │                                                                     │    │
│   │   4. Wait for SANDBOX_READY (timeout: 5s)                          │    │
│   └────────────────────┬───────────────────────────────────────────────┘    │
│                        │                                                     │
│                        ▼                                                     │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │                    Sandbox Ready State                              │    │
│   │                                                                     │    │
│   │   isReady = true                                                    │    │
│   │   Start health check interval (10s)                                │    │
│   │   Ready for executeCode() calls                                    │    │
│   └────────────────────┬───────────────────────────────────────────────┘    │
│                        │                                                     │
│            ┌───────────┴───────────┐                                        │
│            ▼                       ▼                                        │
│   ┌─────────────────┐    ┌──────────────────────────────────────────┐       │
│   │  Normal Flow    │    │         Error Recovery                    │       │
│   │                 │    │                                           │       │
│   │  executeCode()  │    │  • consecutiveFailures >= 3              │       │
│   │  → EXECUTE_CODE │    │    → Automatic restart                   │       │
│   │  → TOOL_REQUEST │    │                                           │       │
│   │  → TOOL_RESULT  │    │  • Timeout (30s default)                 │       │
│   │  → EXECUTE_RESULT│   │    → Return error to caller              │       │
│   │                 │    │                                           │       │
│   │  Success:       │    │  • Sandbox crashed                       │       │
│   │  Reset failures │    │    → Detected via health check           │       │
│   │                 │    │    → Automatic restart                   │       │
│   └─────────────────┘    └──────────────────────────────────────────┘       │
│                                                                              │
│   App Shutdown                                                               │
│       │                                                                      │
│       ▼                                                                      │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │                  SandboxBridge.destroy()                            │    │
│   │                                                                     │    │
│   │   1. Stop health check interval                                    │    │
│   │   2. Remove message listener                                        │    │
│   │   3. Remove iframe from DOM                                         │    │
│   │   4. Reject all pending requests                                    │    │
│   │   5. Reset singleton instance                                       │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sequence Diagrams

### 1. Complete Adaptive Mode Interaction

```
┌──────┐     ┌──────┐     ┌───────────────┐     ┌─────────────┐     ┌─────────┐
│ User │     │ LLM  │     │ discoverTools │     │executeTools │     │ Sandbox │
└──┬───┘     └──┬───┘     └───────┬───────┘     └──────┬──────┘     └────┬────┘
   │            │                 │                     │                 │
   │ "Search    │                 │                     │                 │
   │  weather"  │                 │                     │                 │
   │───────────►│                 │                     │                 │
   │            │                 │                     │                 │
   │            │ Check tool index│                     │                 │
   │            │─────────┐       │                     │                 │
   │            │◄────────┘       │                     │                 │
   │            │                 │                     │                 │
   │            │ discoverTools   │                     │                 │
   │            │ ("navigate      │                     │                 │
   │            │  search")       │                     │                 │
   │            │────────────────►│                     │                 │
   │            │                 │                     │                 │
   │            │                 │ Search all tools    │                 │
   │            │                 │─────────┐          │                 │
   │            │                 │◄────────┘          │                 │
   │            │                 │                     │                 │
   │            │ Tool details    │                     │                 │
   │            │◄────────────────│                     │                 │
   │            │                 │                     │                 │
   │            │ executeTools    │                     │                 │
   │            │ ({ code: "..."})│                     │                 │
   │            │─────────────────────────────────────►│                 │
   │            │                 │                     │                 │
   │            │                 │                     │ validateCode()  │
   │            │                 │                     │─────────┐       │
   │            │                 │                     │◄────────┘       │
   │            │                 │                     │                 │
   │            │                 │                     │ EXECUTE_CODE    │
   │            │                 │                     │────────────────►│
   │            │                 │                     │                 │
   │            │                 │                     │                 │ For each
   │            │                 │                     │◄─TOOL_REQUEST───│ tool call
   │            │                 │                     │                 │
   │            │                 │                     │ Wait approval   │
   │            │                 │                     │ then execute    │
   │            │                 │                     │─────────┐       │
   │            │                 │                     │◄────────┘       │
   │            │                 │                     │                 │
   │            │                 │                     │─TOOL_RESULT────►│
   │            │                 │                     │                 │
   │            │                 │                     │◄─EXECUTE_RESULT─│
   │            │                 │                     │                 │
   │            │ Result          │                     │                 │
   │            │◄─────────────────────────────────────│                 │
   │            │                 │                     │                 │
   │ Response   │                 │                     │                 │
   │◄───────────│                 │                     │                 │
   │            │                 │                     │                 │
```

### 2. Sandbox Tool Proxy Mechanism

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     TOOL PROXY INSIDE SANDBOX                               │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Sandbox receives: { code, availableTools: ['navigateTo', 'clickByText'] }│
│                                                                             │
│   Step 1: Create Tools Proxy                                                │
│   ─────────────────────────                                                 │
│                                                                             │
│   const tools = createToolsProxy(['navigateTo', 'clickByText'], requestId);│
│   // tools = {                                                              │
│   //   navigateTo: async (...args) => { /* postMessage & wait */ },        │
│   //   clickByText: async (...args) => { /* postMessage & wait */ }        │
│   // }                                                                      │
│                                                                             │
│   Step 2: Execute Code with Proxy                                           │
│   ───────────────────────────────                                           │
│                                                                             │
│   const asyncFunc = new Function('tools', `                                 │
│     return (async () => {                                                   │
│       ${code}                                                               │
│     })();                                                                   │
│   `);                                                                       │
│   const result = await asyncFunc(tools);                                    │
│                                                                             │
│   Step 3: Each tools.* Call                                                 │
│   ─────────────────────────                                                 │
│                                                                             │
│   await tools.navigateTo({ url: "..." })                                    │
│        │                                                                    │
│        ▼                                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  1. Generate callId: "req-123-1"                                    │  │
│   │  2. Store pending: pendingToolCalls.set(callId, { resolve, reject })│  │
│   │  3. Send: parent.postMessage({                                      │  │
│   │       type: 'TOOL_REQUEST',                                         │  │
│   │       requestId: 'req-123',                                         │  │
│   │       callId: 'req-123-1',                                          │  │
│   │       toolName: 'navigateTo',                                       │  │
│   │       args: [{ url: "..." }]                                        │  │
│   │     })                                                               │  │
│   │  4. Return promise (awaiting TOOL_RESULT)                           │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│        │                                                                    │
│        ▼                                                                    │
│   Main extension receives TOOL_REQUEST (HITL may pause), then sends back:   │
│   { type: 'TOOL_RESULT', callId: 'req-123-1', result?: ..., error?: ... }  │
│        │                                                                    │
│        ▼                                                                    │
│   Sandbox receives:                                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  1. Find pending: pendingToolCalls.get('req-123-1')                 │  │
│   │  2. Resolve or reject promise                                       │  │
│   │  3. Code continues execution                                        │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
apps/extension/src/
├── ai/
│   ├── prompts/
│   │   └── templates/
│   │       └── adaptivePrompt.ts      # System prompt builder
│   │
│   └── tools/
│       ├── meta/                       # Adaptive mode meta-tools
│       │   ├── index.ts               # Exports discoverTools, executeTools
│       │   ├── discoverTools.ts       # Tool search functionality
│       │   ├── executeTools.ts        # Code orchestration
│       │   ├── executeToolsApproval.ts # HITL approval bridge for sandbox calls
│       │   ├── executeToolsLiveStore.ts # Live sub-tool call store (UI streaming)
│       │   ├── types.ts               # Tool call tracking types (TrackedToolCall)
│       │   ├── validateCode.ts        # AST security validation
│       │   ├── serializationUtils.ts  # Safe JSON serialization
│       │   └── SandboxBridge/
│       │       ├── SandboxBridge.ts   # Iframe communication + HITL gating
│       │       ├── constants.ts       # Sandbox timeouts
│       │       └── types.ts           # postMessage protocol types
│       │
│       └── registryUtils.ts           # getAllTools() for extension tools
│
├── actions/
│   └── meta/
│       └── ExecuteToolsRenderer.tsx   # Renders live executeTools sub-calls + approval UI
│
├── entrypoints/
│   └── sandbox-executor/
│       ├── index.html                 # Sandbox iframe HTML
│       └── executor.ts                # Sandbox execution script
│
├── hooks/
│   └── sandbox/
│       └── useSandbox.ts              # React hook for sandbox init
│
└── components/
    └── features/
        └── chat/
            └── components/
                └── modals/
                    └── ToolPopover/
                        ├── constants.ts          # ADAPTIVE_MODE_TOOLS
                        ├── useToolsPopover.ts    # Mode switching logic
                        └── components/
                            └── ModeSelector.tsx  # UI mode buttons
```

---

## Configuration

### Adaptive Mode Tools (`constants.ts`)

```typescript
export const ADAPTIVE_MODE_TOOLS: string[] = [
    // Meta-tools for on-demand discovery and execution
    'discoverTools',
    'executeTools',
    // Pre-loaded popular tools (cold start optimization)
    'readPageContent',
    'takeScreenshot',
    'getActiveTab',
];

export const ADAPTIVE_ONLY_TOOLS: string[] = [
    'discoverTools',
    'executeTools',
];
```

### Sandbox Configuration (timeouts)

```typescript
// src/ai/tools/meta/SandboxBridge/constants.ts
const DEFAULT_TIMEOUT_MS = 150_000;          // Default code execution timeout
const SANDBOX_READY_TIMEOUT_MS = 5_000;      // Init timeout
const HEALTH_CHECK_INTERVAL_MS = 10_000;     // Health monitoring
const MAX_CONSECUTIVE_FAILURES = 3;          // Before auto-restart
const TOOL_EXECUTION_TIMEOUT_MS = 120_000;   // Per-tool execution timeout (after approval)

// src/ai/tools/meta/executeTools.ts
const EXECUTE_TOOLS_SANDBOX_TIMEOUT_MS = 15 * 60_000; // Extra time for HITL approvals

// src/entrypoints/sandbox-executor/executor.ts
const TOOL_CALL_TIMEOUT_MS = 15 * 60_000;    // Sandbox waits this long for TOOL_RESULT
```

---

## Error Handling

### Error Codes (`SandboxErrorCode`)

| Code | Description |
|------|-------------|
| `SANDBOX_INIT_FAILED` | Sandbox failed to initialize |
| `SANDBOX_UNRESPONSIVE` | Sandbox became unresponsive |
| `SANDBOX_TIMEOUT` | Execution timed out |
| `SANDBOX_IFRAME_UNAVAILABLE` | Iframe not available |
| `SANDBOX_ABORTED` | Execution was aborted |
| `SANDBOX_SERIALIZATION_ERROR` | Result serialization failed |
| `SANDBOX_EXECUTION_ERROR` | Code execution error |
| `SANDBOX_TOOL_ERROR` | Tool execution error |

### Recovery Strategies

1. **Timeout Recovery**: Return detailed error with context
2. **Consecutive Failures**: Auto-restart sandbox after 3 failures
3. **Health Monitoring**: Periodic checks detect unresponsive state
4. **Abort Support**: Clean cancellation via AbortSignal

---

## Summary

Adaptive Mode provides a powerful, context-efficient approach to tool usage by:

1. **Reducing Context Overhead** - Only tool names/descriptions in prompt
2. **Enabling Dynamic Discovery** - `discoverTools` for on-demand lookup
3. **Supporting Multi-Step Orchestration** - `executeTools` for complex flows
4. **Maintaining Security** - AST validation + sandboxed execution
5. **Ensuring Reliability** - Health monitoring and auto-recovery

This architecture allows the AI to access the full tool library without the context cost of loading all tool schemas upfront.
