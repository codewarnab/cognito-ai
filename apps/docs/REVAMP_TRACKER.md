# Docs Revamp Tracker

<!-- TEMP_CONTENT: tracker will be updated as pages progress through phases -->

This tracker shows the status of all **new IA pages** (the target structure). Each row represents a page in the revamped documentation.

## Status Legend

| Status | Description |
|--------|-------------|
| `planned` | Page identified in IA, not yet created |
| `stubbed` | Skeleton page created with placeholders |
| `drafting` | Content being written |
| `needs_verification` | Content written, requires code verification |
| `verified` | Verified against codebase |
| `shipped` | Ready for production |

---

## Get Started

| Page | Owner | Status | Blockers | Source Docs |
|------|-------|--------|----------|-------------|
| `getting-started/index.mdx` | - | planned | - | - |
| `getting-started/installation.mdx` | - | planned | Install path decision | `getting-started/index.mdx` |
| `getting-started/quickstart.mdx` | - | planned | - | `getting-started/index.mdx` |
| `getting-started/provider-setup.mdx` | - | planned | Verify BYOK vs Backend UI | - |

## Using Cognito

| Page | Owner | Status | Blockers | Source Docs |
|------|-------|--------|----------|-------------|
| `using-cognito/index.mdx` | - | planned | - | - |
| `using-cognito/sidepanel-basics.mdx` | - | planned | - | - |
| `using-cognito/browser-automation.mdx` | - | planned | Verify tool list | `TOOL_APPROVAL_SYSTEM.md` |
| `using-cognito/voice-mode.mdx` | - | planned | Feature status check | - |
| `using-cognito/memory.mdx` | - | planned | Verify Dexie storage | - |
| `using-cognito/web-search.mdx` | - | planned | - | `web-search-integration.mdx` |
| `using-cognito/youtube.mdx` | - | planned | - | - |
| `using-cognito/reminders.mdx` | - | planned | Verify webapp location | - |

## Integrations

| Page | Owner | Status | Blockers | Source Docs |
|------|-------|--------|----------|-------------|
| `integrations/index.mdx` | - | planned | - | - |
| `integrations/mcp-overview.mdx` | - | planned | - | `AWESOME_MCP_SERVERS.md` |
| `integrations/remote-mcp.mdx` | - | planned | Auth flow verification | `remote-mcp-integration.mdx`, `REMOTE_MCP_INTEGRATION.md` |
| `integrations/webmcp.mdx` | - | planned | Path verification | `webmcp-integration.mdx`, `WEBMCP_INTEGRATION.md` |
| `integrations/supermemory.mdx` | - | planned | - | `supermemory-integration.mdx`, `supermemory-integration.md` |
| `integrations/backends.mdx` | - | planned | - | `web-search-integration.mdx` |

## Configuration

| Page | Owner | Status | Blockers | Source Docs |
|------|-------|--------|----------|-------------|
| `configuration/index.mdx` | - | planned | - | - |
| `configuration/settings-overview.mdx` | - | planned | Verify extension vs webapp | `WEBSITE_CONFIGS_GUIDE.md` |
| `configuration/env-vars.mdx` | - | planned | Verify env var names | - |
| `configuration/modes-and-feature-flags.mdx` | - | planned | 4 mode types | `MODEL_CONFIGURATION_SYNC.md`, `MODEL_SELECTOR_SYNC.md` |
| `configuration/permissions.mdx` | - | planned | Verify manifest | - |

## Architecture

| Page | Owner | Status | Blockers | Source Docs |
|------|-------|--------|----------|-------------|
| `architecture/index.mdx` | - | planned | - | - |
| `architecture/monorepo.mdx` | - | planned | - | `MONOREPO.md` |
| `architecture/extension-architecture.mdx` | - | planned | WXT structure | `TYPE_SAFE_MESSAGING.md`, `TECHNICAL_DOCUMENTATION.md` |
| `architecture/ai-system.mdx` | - | planned | - | `content-features/*.mdx`, `ADAPTIVE_MODE_ARCHITECTURE.md`, `SERVER_TOOLS_ARCHITECTURE.md` |
| `architecture/tools-and-approval.mdx` | - | planned | - | `TOOL_APPROVAL_SYSTEM.md` |
| `architecture/mcp-client.mdx` | - | planned | - | `remote-mcp-integration.mdx`, `MCP_STDIO_ARCHITECTURE.md` |
| `architecture/webmcp-architecture.mdx` | - | planned | - | `webmcp-integration.mdx` |

## Security

| Page | Owner | Status | Blockers | Source Docs |
|------|-------|--------|----------|-------------|
| `security/index.mdx` | - | planned | - | - |
| `security/privacy-model.mdx` | - | planned | Verify data flow | - |
| `security/secrets-and-keys.mdx` | - | planned | Storage verification | - |
| `security/threat-model.mdx` | - | planned | - | `TOOL_APPROVAL_SYSTEM.md` |

## Troubleshooting

| Page | Owner | Status | Blockers | Source Docs |
|------|-------|--------|----------|-------------|
| `troubleshooting/index.mdx` | - | planned | - | - |
| `troubleshooting/install.mdx` | - | planned | - | - |
| `troubleshooting/extension.mdx` | - | planned | - | - |
| `troubleshooting/mcp.mdx` | - | planned | - | - |
| `troubleshooting/webmcp.mdx` | - | planned | - | - |
| `troubleshooting/voice.mdx` | - | planned | - | - |
| `troubleshooting/debugging.mdx` | - | planned | - | `CENTRALIZED_LOGGING.md`, `LOGGER_SUBCATEGORIES_GUIDE.md` |

## FAQ

| Page | Owner | Status | Blockers | Source Docs |
|------|-------|--------|----------|-------------|
| `faq/index.mdx` | - | planned | - | - |

## Contributing

| Page | Owner | Status | Blockers | Source Docs |
|------|-------|--------|----------|-------------|
| `contributing/index.mdx` | - | planned | - | `CONTRIBUTING.md` |
| `contributing/dev-setup.mdx` | - | planned | Verify commands | `SETUP.md`, `development.mdx` |
| `contributing/repo-tour.mdx` | - | planned | - | `MONOREPO.md` |
| `contributing/coding-standards.mdx` | - | planned | - | `coding-standards/*.mdx`, `CODING_STANDARDS.md` |
| `contributing/adding-tools.mdx` | - | planned | - | `guides/adding-tools.mdx` |
| `contributing/adding-mcp-server.mdx` | - | planned | - | `guides/adding-mcp-server.mdx` |

## Reference

| Page | Owner | Status | Blockers | Source Docs |
|------|-------|--------|----------|-------------|
| `reference/index.mdx` | - | planned | - | - |
| `reference/glossary.mdx` | - | planned | - | - |
| `reference/env-vars.mdx` | - | planned | - | - |
| `reference/message-types.mdx` | - | planned | Verify types | - |

---

## Summary

| Section | Pages | Planned | Stubbed | Drafting | Verified | Shipped |
|---------|-------|---------|---------|----------|----------|---------|
| Get Started | 4 | 4 | 0 | 0 | 0 | 0 |
| Using Cognito | 8 | 8 | 0 | 0 | 0 | 0 |
| Integrations | 6 | 6 | 0 | 0 | 0 | 0 |
| Configuration | 5 | 5 | 0 | 0 | 0 | 0 |
| Architecture | 7 | 7 | 0 | 0 | 0 | 0 |
| Security | 4 | 4 | 0 | 0 | 0 | 0 |
| Troubleshooting | 7 | 7 | 0 | 0 | 0 | 0 |
| FAQ | 1 | 1 | 0 | 0 | 0 | 0 |
| Contributing | 6 | 6 | 0 | 0 | 0 | 0 |
| Reference | 4 | 4 | 0 | 0 | 0 | 0 |
| **Total** | **52** | **52** | **0** | **0** | **0** | **0** |
