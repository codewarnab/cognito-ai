# Docs Revamp Inventory

> **Rule**: All legacy docs are treated as **inputs**, not sources of truth. All claims must be verified against the current codebase.

## Inventory Schema

| Column | Description |
|--------|-------------|
| **Source path** | Original file location |
| **Source type** | `docs-app` \| `extension-doc` \| `root-doc` \| `root-guide` |
| **Audience** | `user` \| `contributor` \| `internal` |
| **Action** | `keep` \| `rewrite` \| `split` \| `merge` \| `archive` \| `delete` |
| **New canonical path** | Target location in new IA (or "internal-only") |
| **Verification status** | `unverified` \| `needs_verification` \| `verified` |
| **Claims to verify** | Specific items needing code confirmation |
| **Diagrams needed** | Mermaid diagram IDs to add |
| **Notes** | Additional context |

---

## Docs App Content (`apps/docs/content/docs/`)

| Source path | Source type | Audience | Action | New canonical path | Verification status | Claims to verify | Diagrams needed | Notes |
|---|---|---|---|---|---|---|---|---|
| `index.mdx` | docs-app | user | rewrite | `index.mdx` | unverified | Product description, feature list | - | Current is minimal placeholder |
| `meta.json` | docs-app | - | rewrite | `meta.json` | - | - | - | Update sidebar structure |
| **getting-started/** | | | | | | | | |
| `getting-started/index.mdx` | docs-app | user | rewrite | `getting-started/quickstart.mdx` + `installation.mdx` | unverified | Install steps, dev commands | - | Dev-focused only, needs user install path |
| `getting-started/meta.json` | docs-app | - | rewrite | `getting-started/meta.json` | - | - | - | |
| **architecture/** | | | | | | | | |
| `architecture/index.mdx` | docs-app | contributor | rewrite | `architecture/index.mdx` | unverified | Package paths | - | Placeholder only |
| `architecture/meta.json` | docs-app | - | rewrite | `architecture/meta.json` | - | - | - | |
| `architecture/remote-mcp-integration.mdx` | docs-app | contributor | split | `integrations/remote-mcp.mdx` + `architecture/mcp-client.mdx` | needs_verification | OAuth endpoints, transport protocols, message types, file paths in `src/mcp/`, `src/background/mcp/` | `mcp.architecture`, `mcp.oauth-flow`, `mcp.tool-execution` | 1050 lines, has ASCII diagrams |
| `architecture/webmcp-integration.mdx` | docs-app | contributor | split | `integrations/webmcp.mdx` + `architecture/webmcp-architecture.mdx` | needs_verification | Content script path (`src/contents/webmcp-proxy.ts` → should be `src/entrypoints/webmcp-proxy.content.ts`), message types, hook paths | `webmcp.architecture`, `webmcp.discovery`, `webmcp.execution` | 587 lines, stale file paths, ASCII diagrams |
| `architecture/supermemory-integration.mdx` | docs-app | contributor | rewrite | `integrations/supermemory.mdx` | needs_verification | API endpoints, integration flow | - | |
| `architecture/web-search-integration.mdx` | docs-app | user+contributor | split | `using-cognito/web-search.mdx` + `integrations/backends.mdx` | needs_verification | Tavily/Jina API usage, backend endpoints | - | |
| `architecture/content-features/index.mdx` | docs-app | contributor | rewrite | `architecture/ai-system.mdx` | needs_verification | Feature architecture | - | |
| `architecture/content-features/writer.mdx` | docs-app | contributor | merge | `architecture/ai-system.mdx` | needs_verification | Writer implementation | - | |
| `architecture/content-features/rewriter.mdx` | docs-app | contributor | merge | `architecture/ai-system.mdx` | needs_verification | Rewriter implementation | - | |
| `architecture/content-features/summarizer.mdx` | docs-app | contributor | merge | `architecture/ai-system.mdx` | needs_verification | Summarizer implementation | - | |
| **guides/** | | | | | | | | |
| `guides/index.mdx` | docs-app | contributor | delete | - | - | - | - | Placeholder, content moves to contributing |
| `guides/meta.json` | docs-app | - | delete | - | - | - | - | |
| `guides/adding-tools.mdx` | docs-app | contributor | rewrite | `contributing/adding-tools.mdx` | needs_verification | Tool registration API, file paths | - | Needs verification |
| `guides/adding-mcp-server.mdx` | docs-app | contributor | rewrite | `contributing/adding-mcp-server.mdx` | needs_verification | MCP server config format | - | |
| **contributing/** | | | | | | | | |
| `contributing/index.mdx` | docs-app | contributor | rewrite | `contributing/index.mdx` | unverified | Overview | - | |
| `contributing/meta.json` | docs-app | - | rewrite | `contributing/meta.json` | - | - | - | |
| `contributing/development.mdx` | docs-app | contributor | rewrite | `contributing/dev-setup.mdx` | needs_verification | Dev commands, monorepo setup | - | |
| `contributing/coding-standards/index.mdx` | docs-app | contributor | keep | `contributing/coding-standards.mdx` | needs_verification | Standards accuracy | - | |
| `contributing/coding-standards/extension.mdx` | docs-app | contributor | merge | `contributing/coding-standards.mdx` | needs_verification | Extension patterns | - | |
| `contributing/coding-standards/react.mdx` | docs-app | contributor | merge | `contributing/coding-standards.mdx` | needs_verification | React 19 patterns | - | |
| `contributing/coding-standards/typescript.mdx` | docs-app | contributor | merge | `contributing/coding-standards.mdx` | needs_verification | TS patterns | - | |
| `contributing/coding-standards/reliability.mdx` | docs-app | contributor | merge | `contributing/coding-standards.mdx` | needs_verification | Reliability patterns | - | |

---

## Extension Docs (`apps/extension/docs/`)

| Source path | Source type | Audience | Action | New canonical path | Verification status | Claims to verify | Diagrams needed | Notes |
|---|---|---|---|---|---|---|---|---|
| `TOOL_APPROVAL_SYSTEM.md` | extension-doc | contributor+user | split | `architecture/tools-and-approval.mdx` + `security/threat-model.mdx` | needs_verification | Tool list, approval flow, store paths | `approval.flow`, `approval.states` | 530 lines, well-structured |
| `SERVER_TOOLS_ARCHITECTURE.md` | extension-doc | contributor | rewrite | `architecture/ai-system.mdx` | needs_verification | Backend tools pattern | - | |
| `REMOTE_MCP_INTEGRATION.md` | extension-doc | contributor | merge | `architecture/mcp-client.mdx` | needs_verification | Overlap with docs-app version | - | Check for unique content |
| `WEBMCP_INTEGRATION.md` | extension-doc | contributor | merge | `architecture/webmcp-architecture.mdx` | needs_verification | Overlap with docs-app version | - | |
| `ADAPTIVE_MODE_ARCHITECTURE.md` | extension-doc | contributor | rewrite | `architecture/ai-system.mdx` | needs_verification | Adaptive mode implementation | - | |
| `MCP_STDIO_ARCHITECTURE.md` | extension-doc | contributor | rewrite | `architecture/mcp-client.mdx` | needs_verification | Stdio transport | - | |
| `MODEL_CONFIGURATION_SYNC.md` | extension-doc | contributor | rewrite | `configuration/modes-and-feature-flags.mdx` | needs_verification | Model sync logic | - | |
| `TYPE_SAFE_MESSAGING.md` | extension-doc | contributor | rewrite | `architecture/extension-architecture.mdx` | needs_verification | Messaging types | - | |
| `TECHNICAL_DOCUMENTATION.md` | extension-doc | contributor | split | Multiple targets | needs_verification | Many topics | - | Large file, needs triage |
| `CODING_STANDARDS.md` | extension-doc | contributor | merge | `contributing/coding-standards.mdx` | needs_verification | Overlap with existing | - | |
| `GEMINI_WRITER_REWRITER_ARCHITECTURE.md` | extension-doc | contributor | merge | `architecture/ai-system.mdx` | needs_verification | Writer/rewriter flow | - | |
| `SUMMARIZER_ARCHITECTURE.md` | extension-doc | contributor | merge | `architecture/ai-system.mdx` | needs_verification | Summarizer flow | - | |
| `WEB_SEARCH_INTEGRATION.md` | extension-doc | contributor | merge | `integrations/backends.mdx` | needs_verification | Web search implementation | - | |
| `WEBMCP_AISDK_INTEGRATION_REPORT.md` | extension-doc | internal | archive | internal-only | - | - | - | Investigation notes |
| `WEBSITE_CONFIGS_GUIDE.md` | extension-doc | contributor | rewrite | `configuration/settings-overview.mdx` | needs_verification | Website configs | - | |
| `CONTENT_TO_CHAT_API_PLAN.md` | extension-doc | internal | archive | internal-only | - | - | - | Implementation plan |
| `CSS_TO_TAILWIND_MIGRATION.md` | extension-doc | internal | archive | internal-only | - | - | - | Migration notes |
| `TOOL_ERROR_FEEDBACK_LOOP.md` | extension-doc | internal | archive | internal-only | - | - | - | Design notes |
| `TOOL_POPOVER_ARCHITECTURE.md` | extension-doc | internal | archive | internal-only | - | - | - | UI implementation |
| `ADAPTIVE_TOOL_UI_OPTION_A.md` | extension-doc | internal | archive | internal-only | - | - | - | Design option |
| `ADAPTIVE_TOOL_UI_OPTION_B.md` | extension-doc | internal | archive | internal-only | - | - | - | Design option |
| `RESEARCH_WORKFLOW_*.md` (4 files) | extension-doc | internal | archive | internal-only | - | - | - | Workflow notes |
| `supermemory-integration.md` | extension-doc | contributor | merge | `integrations/supermemory.mdx` | needs_verification | Supermemory integration | - | |
| `youtube-to-notion-analysis.md` | extension-doc | internal | archive | internal-only | - | - | - | Analysis notes |
| `issues.md` | extension-doc | internal | archive | internal-only | - | - | - | Issue tracking |
| **plans/** (6 files) | extension-doc | internal | archive | internal-only | - | - | - | Implementation plans |
| **bugs/** (1 file) | extension-doc | internal | archive | internal-only | - | - | - | Bug notes |

---

## Root Docs (`docs/`)

| Source path | Source type | Audience | Action | New canonical path | Verification status | Claims to verify | Diagrams needed | Notes |
|---|---|---|---|---|---|---|---|---|
| `MODEL_SELECTOR_SYNC.md` | root-doc | contributor | summarize | `configuration/modes-and-feature-flags.mdx` | needs_verification | Model selector logic | - | |
| `CENTRALIZED_LOGGING.md` | root-doc | contributor | summarize | `troubleshooting/debugging.mdx` | needs_verification | Logger setup | - | |
| `LOGGER_SUBCATEGORIES_GUIDE.md` | root-doc | contributor | merge | `troubleshooting/debugging.mdx` | needs_verification | Logger categories | - | |
| `AI_SDK_GEMINI_TOOL_NAME_ISSUE.md` | root-doc | internal | archive | internal-only | - | - | - | Investigation |
| `AWESOME_MCP_SERVERS.md` | root-doc | user | extract | `integrations/mcp-overview.mdx` | needs_verification | Server list | - | |
| `CROSS_PROVIDER_IMPLEMENTATION.md` | root-doc | internal | archive | internal-only | - | - | - | Design notes |
| `GOOGLE_MAPS_MCP_IMPLEMENTATION_PLAN.md` | root-doc | internal | archive | internal-only | - | - | - | Plan |
| `PLANE_MCP_IMPLEMENTATION_PLAN.md` | root-doc | internal | archive | internal-only | - | - | - | Plan |
| `xai_integration_plan.md` | root-doc | internal | archive | internal-only | - | - | - | Plan |

---

## Root Guides

| Source path | Source type | Audience | Action | New canonical path | Verification status | Claims to verify | Diagrams needed | Notes |
|---|---|---|---|---|---|---|---|---|
| `README.md` | root-guide | user+contributor | keep | - | needs_verification | Extension description, links | - | Entry point |
| `SETUP.md` | root-guide | contributor | rewrite | `contributing/dev-setup.mdx` | needs_verification | Old file paths (`src/` vs `entrypoints/`), commands | - | **STALE** - contains old paths |
| `MONOREPO.md` | root-guide | contributor | rewrite | `architecture/monorepo.mdx` | needs_verification | Package structure | - | Good overview but verify |
| `CONTRIBUTING.md` | root-guide | contributor | rewrite | `contributing/index.mdx` | needs_verification | Contribution workflow | - | |
| `GEMINI.md` | root-guide | internal | keep | - | - | - | - | Agent context |
| `CLAUDE.md` | root-guide | internal | keep | - | - | - | - | Agent context |
| `AGENTS.md` | root-guide | internal | keep | - | - | - | - | Agent navigation |
| `TODO_REPORT.md` | root-guide | internal | archive | internal-only | - | - | - | Status report |
| `implemention.md` | root-guide | internal | archive | internal-only | - | - | - | Typo in name, likely stale |

---

## Summary Statistics

| Category | Total Files | To Rewrite | To Merge | To Archive | To Delete |
|----------|-------------|------------|----------|------------|-----------|
| Docs App | 28 | 15 | 8 | 0 | 2 |
| Extension Docs | 34 | 8 | 8 | 18 | 0 |
| Root Docs | 9 | 0 | 2 | 7 | 0 |
| Root Guides | 9 | 4 | 0 | 2 | 0 |
| **Total** | **80** | **27** | **18** | **27** | **2** |

---

## High-Priority Verification Hotspots

These items have high risk of staleness and should be verified first:

1. **File path references** - Many docs reference `src/contents/` or `src/background/` which should be `src/entrypoints/` in WXT
2. **WebMCP docs** - `webmcp-integration.mdx` has hardcoded stale paths
3. **Remote MCP docs** - Large file with many message types and endpoints to verify
4. **SETUP.md** - Contains old extension file structure
5. **Tool approval system** - Verify `TOOLS_REQUIRING_APPROVAL` list matches code
