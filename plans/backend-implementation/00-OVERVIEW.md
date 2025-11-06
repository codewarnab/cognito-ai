# Backend Implementation Plan - Overview

## 🎯 Project Goal

Implement a NestJS backend that serves as the default AI provider for the Chrome extension, while maintaining BYOK (Bring Your Own Key) mode as an alternative option.

---

## 📐 Architecture Overview

### Current Architecture
```
┌─────────────────────────────────────────────────────┐
│           Chrome Extension (Frontend)               │
│                                                     │
│  ┌──────────────┐         ┌──────────────────────┐ │
│  │   UI Layer   │         │   AI Logic Layer     │ │
│  │  (useChat)   │────────>│   (aiLogic.ts)      │ │
│  └──────────────┘         └──────────┬───────────┘ │
│                                      │             │
│                            ┌─────────┴──────────┐  │
│                            │                    │  │
│                     ┌──────▼─────┐      ┌──────▼─────┐
│                     │   Local    │      │   Remote   │
│                     │  (Gemini   │      │  (Gemini   │
│                     │   Nano)    │      │  API with  │
│                     │            │      │  user key) │
│                     └────────────┘      └────────────┘
└─────────────────────────────────────────────────────┘
```

### New Architecture (Target)
```
┌─────────────────────────────────────────────────────┐
│           Chrome Extension (Frontend)               │
│                                                     │
│  ┌──────────────┐         ┌──────────────────────┐ │
│  │   UI Layer   │         │   AI Logic Layer     │ │
│  │  (useChat)   │────────>│   (aiLogic.ts)      │ │
│  └──────────────┘         └──────────┬───────────┘ │
│                                      │             │
│                            ┌─────────┴──────────┐  │
│                            │                    │  │
│                     ┌──────▼─────┐      ┌──────▼─────┐
│                     │  Backend   │      │   BYOK     │
│                     │   Mode     │      │  (Remote   │
│                     │ (Default)  │      │  w/ user   │
│                     │            │      │   key)     │
│                     └──────┬─────┘      └────────────┘
│                            │                          │
└────────────────────────────┼──────────────────────────┘
                             │
                  ┌──────────▼──────────┐
                  │  NestJS Backend     │
                  │  (Vercel)           │
                  │                     │
                  │  - AI Orchestration │
                  │  - Tool Schemas     │
                  │  - Extension Auth   │
                  │  - Streaming        │
                  └──────────┬──────────┘
                             │
                  ┌──────────▼──────────┐
                  │   Google Gemini API │
                  │   (Your API Keys)   │
                  └─────────────────────┘
```

---

## 🔑 Key Design Decisions

### 1. **Tool Execution Architecture**

**Problem**: Backend cannot directly execute Chrome extension tools (browser APIs).

**Solution**: Hybrid Tool Execution Pattern
- Backend defines tool schemas (without `execute` function)
- Extension receives tool calls in stream
- Extension executes tools locally
- Extension sends tool results back to backend
- Backend continues generation with results

**Flow**:
```
Extension → Backend (messages)
    ↓
Backend → Gemini (streamText with tool schemas)
    ↓
Backend ← Gemini (response + tool calls)
    ↓
Extension ← Backend (stream with tool calls)
    ↓
Extension executes tools locally
    ↓
Extension → Backend (messages + tool results)
    ↓
Backend → Gemini (continue with tool results)
    ↓
Extension ← Backend (final response)
```

### 2. **Mode System**

```typescript
// Old system
type AIMode = 'local' | 'remote';

// New system
type AIMode = 'backend' | 'byok';
```

- **backend**: Default, uses NestJS backend with your API keys
- **byok**: User provides their own API key (current "remote" mode, works exactly the same)

### 3. **Authentication**

- Use Chrome extension ID as authentication
- Sent in `X-Extension-ID` header
- No user accounts or login required
- Simple and secure

### 4. **Transport Configuration**

Using AI SDK's `DefaultChatTransport` with custom configuration:
```typescript
const transport = new DefaultChatTransport({
  api: 'https://your-backend.vercel.app/api/chat',
  headers: {
    'X-Extension-ID': chrome.runtime.id,
    'X-Extension-Version': chrome.runtime.getManifest().version
  }
});
```

### 5. **Shared Code**

Backend will live in `backend/` folder within the repo:
```
chrome-ai/
├── src/              # Extension code
├── backend/          # NestJS backend
│   ├── src/
│   ├── package.json
│   └── vercel.json
└── shared/           # Shared types/utils
    ├── types/
    └── utils/
```

---

## 📊 Implementation Phases

Each phase is designed to be small, focused, and independently deployable:

### **Phase 1: Foundation & Project Setup**
- Create NestJS project structure
- Setup shared types folder
- Configure basic backend scaffolding
- Create deployment configuration

### **Phase 2: Backend Mode Infrastructure**
- Rename "local"/"remote" to "backend"/"byok"
- Update UI components
- Update type definitions
- Maintain backward compatibility

### **Phase 3: Basic Backend API**
- Implement `/api/chat` endpoint
- Extension ID authentication
- Basic streaming response
- Error handling

### **Phase 4: Tool Schema Sync**
- Create shared tool type definitions
- Backend endpoint to receive tool schemas
- Extension sends tool schemas on startup
- Backend stores and uses schemas

### **Phase 5: Tool Execution Flow**
- Backend returns tool calls (not executed)
- Extension receives and executes tools
- Extension sends tool results back
- Backend continues with results

### **Phase 6: Model Selection**
- Support Gemini 2.5 Pro and Flash
- Model selection in extension UI
- Backend model routing
- Cost optimization logic

### **Phase 7: MCP Integration**
- MCP tools in backend mode
- Separate MCP tools from extension tools
- Backend-side MCP execution for non-browser tools
- Extension-side MCP execution for browser tools

### **Phase 8: Workflow Support**
- Workflow mode with backend
- Custom prompts and tool filtering
- Workflow session management

### **Phase 9: Production Hardening**
- Error handling improvements
- Retry logic
- Logging and monitoring
- Performance optimization

### **Phase 10: BYOK Migration Path**
- Clear UI for mode selection
- Migration helpers for existing users
- Documentation and help text
- Fallback mechanisms

---

## 🛠️ Technology Stack

### Backend
- **Framework**: NestJS (TypeScript)
- **AI SDK**: Vercel AI SDK v5
- **Provider**: `@ai-sdk/google`
- **Deployment**: Vercel
- **Runtime**: Node.js 20

### Extension Changes
- **Transport**: `DefaultChatTransport` with custom config
- **Shared Types**: Import from `shared/` folder
- **Mode Management**: Updated type system

---

## 📝 File Structure

```
backend/
├── src/
│   ├── main.ts                    # Bootstrap
│   ├── app.module.ts              # Root module
│   ├── chat/
│   │   ├── chat.module.ts
│   │   ├── chat.controller.ts     # /api/chat endpoint
│   │   ├── chat.service.ts        # AI logic
│   │   └── dto/
│   │       ├── chat-request.dto.ts
│   │       └── chat-response.dto.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── extension-auth.guard.ts # Validate extension ID
│   │   └── auth.service.ts
│   ├── tools/
│   │   ├── tools.module.ts
│   │   ├── tools.service.ts       # Tool schema management
│   │   └── dto/
│   │       └── tool-schema.dto.ts
│   └── config/
│       ├── gemini.config.ts       # Gemini API config
│       └── app.config.ts          # App config
├── package.json
├── tsconfig.json
├── nest-cli.json
└── vercel.json                     # Vercel deployment

shared/
├── types/
│   ├── ai-mode.types.ts           # AIMode definitions
│   ├── tool.types.ts              # Tool type definitions
│   └── message.types.ts           # Message types
└── utils/
    └── validation.utils.ts        # Shared validation
```

---

## ⚡ Quick Start Guide

### Prerequisites
- Node.js 20+
- pnpm (or npm)
- Chrome extension already working
- Google AI Studio API key

### Phase-by-Phase Implementation
Each phase has its own detailed document:
1. Read `01-PHASE-*.md`
2. Follow step-by-step instructions
3. Test after each phase
4. Move to next phase

### Testing Strategy
- **Unit Tests**: Backend services and guards
- **Integration Tests**: API endpoints
- **E2E Tests**: Extension ↔ Backend flow
- **Manual Tests**: Full user journey

---

## 🎯 Success Criteria

### Phase Completion Checklist
- [ ] All code changes implemented
- [ ] Tests passing
- [ ] No regressions in existing features
- [ ] Documentation updated
- [ ] Ready for next phase

### Final Success Criteria
- [ ] Backend mode works as default
- [ ] BYOK mode still works exactly as before
- [ ] All tools execute correctly
- [ ] MCP integration works
- [ ] Workflows function properly
- [ ] No breaking changes for existing users
- [ ] Deployed to Vercel successfully

---

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Vercel AI SDK v5](https://ai-sdk.dev/)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)

---

## 🚦 Next Steps

1. Review this overview
2. Start with Phase 1: Foundation & Project Setup
3. Complete each phase sequentially
4. Test thoroughly after each phase
5. Deploy to Vercel after Phase 9

**Ready to begin? Open `01-PHASE-1-FOUNDATION.md`**
