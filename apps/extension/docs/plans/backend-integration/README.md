# Backend Integration Plan

## Overview

This document outlines a multi-phase approach to add backend AI chat support to Cognito AI. Currently, the extension uses a **BYOK (Bring Your Own Key)** model where all AI API calls happen directly in the browser. This plan adds an alternative **Backend Mode** where AI calls go through our Vercel backend using our API keys.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       COGNITO AI EXTENSION                              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Mode Toggle (Composer Toolbar)               │   │
│  │              [ BYOK Mode ]   |   [ Backend Mode ]                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                     │                     │
│           ┌──────────────────┘                     └──────────────────┐  │
│           ▼                                                          ▼  │
│  ┌─────────────────────────┐                 ┌─────────────────────────┐│
│  │      BYOK MODE          │                 │      BACKEND MODE       ││
│  │  (Current behavior)     │                 │  (New implementation)   ││
│  │                         │                 │                         ││
│  │  • API key in browser   │                 │  • No API key needed    ││
│  │  • Direct AI SDK call   │                 │  • HTTP to Vercel       ││
│  │  • User pays API costs  │                 │  • We pay, rate limited ││
│  │  • Full functionality   │                 │  • Progressive features ││
│  └─────────────────────────┘                 └────────────┬────────────┘│
└───────────────────────────────────────────────────────────│─────────────┘
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    VERCEL BACKEND (packages/backend-vercel)             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  /api/ai/chat (Phase 1)                                           │  │
│  │  • Our API keys in Vercel secrets                                 │  │
│  │  • AI SDK streamText                                              │  │
│  │  • Rate limiting per user                                         │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  /api/ai/chat-with-tools (Phase 2)                                │  │
│  │  • Frontend tools pattern (tools called in browser)               │  │
│  │  • Tool schemas sent to backend, execution in frontend            │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  Additional Features (Phase 3+)                                   │  │
│  │  • WebMCP support, streaming improvements, analytics              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Mode Comparison

| Feature | BYOK Mode | Backend Mode |
|---------|-----------|--------------|
| **API Key** | User provides their own | Not required |
| **API Calls** | Direct from browser | Via Vercel backend |
| **Cost** | User pays | Cognito pays (rate limited) |
| **Privacy** | Key stays on device | No key exposure at all |
| **Backend Tools (Phase 1)** | ✅ webSearch, deepResearch, retrieve | ✅ Same (already uses backend) |
| **Browser Tools (Phase 2)** | ✅ Full tools | ❌ → ✅ After Phase 2 |
| **Rate Limits** | Provider limits | Our limits + provider |
| **Offline** | Works with valid key | Requires internet |

## Implementation Phases

| Phase | Document | Status | Description |
|-------|----------|--------|-------------|
| 1 | [PHASE-1-SIMPLE-CHAT.md](./PHASE-1-SIMPLE-CHAT.md) | 📋 Planned | Simple chat via backend, no tools |
| 2 | [PHASE-2-FRONTEND-TOOLS.md](./PHASE-2-FRONTEND-TOOLS.md) | 📋 Planned | Frontend tools pattern |
| 3 | [PHASE-3-ADVANCED-FEATURES.md](./PHASE-3-ADVANCED-FEATURES.md) | 📋 Planned | WebMCP, analytics, optimizations |
| 5 | [PHASE-5-CONTENT-SCRIPT-FEATURES.md](./PHASE-5-CONTENT-SCRIPT-FEATURES.md) | 📋 Planned | Writer, Rewriter, Summarizer |
| 6 | [PHASE-6-GEMINI-TOOLS.md](./PHASE-6-GEMINI-TOOLS.md) | 📋 Planned | URL context, Google Search grounding |
| 7 | [PHASE-7-SUGGESTIONS.md](./PHASE-7-SUGGESTIONS.md) | 📋 Planned | Contextual AI suggestions |

## Key Design Decisions

### 1. Mode Toggle Location
The mode toggle will be placed in the **Composer Toolbar**, beside the model selector icon. This provides easy access during chat while keeping it discoverable.

### 2. BYOK Mode Unchanged
The existing BYOK mode remains exactly as-is. All current API calls continue to happen directly in the browser. Backend mode is purely additive.

### 3. Vercel Backend
We use the existing Vercel backend (`packages/backend-vercel`) for consistency with existing infrastructure (YouTube transcripts, web search, etc.).

### 4. Progressive Feature Addition
Backend mode starts simple (chat only) and progressively gains features in each phase:
- Phase 1: Text chat only
- Phase 2: Full tool support via frontend tools pattern
- Phase 3: WebMCP, MCP servers, and advanced features

### 5. Rate Limiting
Backend mode will have rate limiting to control API costs:
- Per-user/session limits
- Daily/monthly quotas
- Graceful degradation with clear messaging

## Files to be Modified/Created

### Extension (apps/extension/)
```
src/
├── ai/
│   ├── core/
│   │   └── aiLogic.ts               # Add backend mode branching
│   ├── backend/                     # NEW: Backend integration
│   │   ├── backendChat.ts           # Backend chat implementation
│   │   ├── backendTransport.ts      # HTTP transport for backend
│   │   └── index.ts                 # Exports
│   └── types/
│       └── backend.ts               # Backend-specific types
├── components/
│   └── features/chat/components/composer/
│       └── sections/
│           └── ComposerToolbar.tsx  # Add mode toggle
├── stores/
│   └── settingsStore.ts             # Add backend mode setting
└── utils/
    └── settings/
        └── backendSettings.ts       # Backend mode utilities
```

### Backend (packages/backend-vercel/)
```
src/
├── config/
│   └── config.ts                # Typed environment configuration
├── types/
│   └── index.ts                 # Type definitions for all APIs
├── middleware/
│   ├── rateLimit.ts             # Redis + in-memory rate limiting
│   └── logging.ts               # Request logging middleware
├── services/
│   ├── youtube.ts               # YouTube video info & transcripts
│   └── ai.ts                    # AI SDK module loader
├── routes/
│   ├── ai.ts                    # Phase 1 & 2: AI chat endpoints
│   ├── health.ts                # Health and debug endpoints
│   ├── metadata.ts              # Metadata extraction
│   ├── retrieve.ts              # URL content retrieval
│   ├── search.ts                # Web search
│   └── transcript.ts            # YouTube transcripts
└── index.ts                     # Express app entry point
```

## Getting Started

1. Read [PHASE-1-SIMPLE-CHAT.md](./PHASE-1-SIMPLE-CHAT.md) for the first implementation phase
2. Each phase document contains:
   - Detailed requirements
   - File changes with code snippets
   - Testing checklist
   - Success criteria

## Related Documentation

- [MONOREPO.md](../../../MONOREPO.md) - Monorepo architecture
- [packages/backend-vercel/GEMINI.md](../../../../packages/backend-vercel/GEMINI.md) - Backend context
- [apps/extension/GEMINI.md](../../GEMINI.md) - Extension context
