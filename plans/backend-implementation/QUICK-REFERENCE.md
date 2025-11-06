# Quick Reference Guide

This document provides quick reference information for implementing the backend.

---

## 📁 Project Structure Reference

```
chrome-ai/
├── backend/                          # NestJS backend (NEW)
│   ├── src/
│   │   ├── main.ts                   # Bootstrap
│   │   ├── app.module.ts             # Root module
│   │   ├── chat/                     # Chat functionality
│   │   │   ├── chat.controller.ts    # /api/chat endpoint
│   │   │   ├── chat.service.ts       # AI logic with SDK
│   │   │   └── dto/
│   │   ├── tools/                    # Tool management
│   │   │   ├── tools.controller.ts   # /api/tools/sync
│   │   │   ├── tools.service.ts      # Schema storage
│   │   │   └── dto/
│   │   ├── auth/                     # Extension auth
│   │   │   ├── extension-auth.guard.ts
│   │   │   └── auth.module.ts
│   │   └── config/                   # Configuration
│   │       ├── app.config.ts
│   │       └── gemini.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── vercel.json                   # Vercel deployment config
├── shared/                           # Shared types (NEW)
│   ├── types/
│   │   ├── ai-mode.types.ts          # AIMode = 'backend' | 'byok'
│   │   ├── tool.types.ts             # Tool schemas
│   │   ├── message.types.ts          # Message types
│   │   └── index.ts                  # Barrel export
│   └── utils/
└── src/                              # Extension code (MODIFIED)
    ├── ai/
    │   ├── core/
    │   │   └── aiLogic.ts            # Updated for backend mode
    │   ├── transport/                # NEW
    │   │   └── backendTransport.ts   # Backend communication
    │   ├── tools/                    # MODIFIED
    │   │   ├── schemaExtractor.ts    # NEW - Extract schemas
    │   │   └── toolSync.ts           # NEW - Sync with backend
    │   └── prompts/templates/
    │       ├── backend.ts            # Renamed from local.ts
    │       └── byok.ts               # Renamed from remote.ts
    ├── utils/
    │   ├── modeMigration.ts          # NEW - Mode migration
    │   └── modelSettings.ts          # MODIFIED - Support new modes
    └── components/
        └── shared/
            └── dialogs/
                └── GeminiApiKeyDialog.tsx  # MODIFIED - BYOK branding
```

---

## 🔄 Data Flow Diagrams

### Backend Mode Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Extension                                 │
│  ┌──────────────┐         ┌──────────────────────────────────┐ │
│  │   UI Layer   │────────>│   Backend Transport              │ │
│  │  (useChat)   │         │   (DefaultChatTransport)         │ │
│  └──────────────┘         └────────────┬─────────────────────┘ │
└───────────────────────────────────────┼───────────────────────┘
                                        │
                                        │ POST /api/chat
                                        │ X-Extension-ID: abc...
                                        │ messages: [...]
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NestJS Backend                              │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │  Auth Guard      │───>│  Chat Controller │                  │
│  │  (validate ID)   │    │  (/api/chat)     │                  │
│  └──────────────────┘    └────────┬─────────┘                  │
│                                   │                              │
│                          ┌────────▼─────────┐                   │
│                          │  Chat Service    │                   │
│                          │  (AI SDK)        │                   │
│                          └────────┬─────────┘                   │
│                                   │                              │
│                          ┌────────▼─────────┐                   │
│                          │  Tools Service   │                   │
│                          │  (get schemas)   │                   │
│                          └────────┬─────────┘                   │
└───────────────────────────────────┼───────────────────────────┘
                                    │
                                    │ streamText({ tools })
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │   Google Gemini API   │
                        │   (Your API Key)      │
                        └───────────────────────┘
```

### BYOK Mode Flow (Unchanged)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Extension                                 │
│  ┌──────────────┐         ┌──────────────────────────────────┐ │
│  │   UI Layer   │────────>│   AI Logic                       │ │
│  │  (useChat)   │         │   (Direct AI SDK)                │ │
│  └──────────────┘         └────────────┬─────────────────────┘ │
└───────────────────────────────────────┼───────────────────────┘
                                        │
                                        │ streamText({ tools })
                                        │ API Key: user's key
                                        │
                                        ▼
                        ┌───────────────────────┐
                        │   Google Gemini API   │
                        │   (User's API Key)    │
                        └───────────────────────┘
```

---

## 🔑 Environment Variables

### Backend `.env`

```bash
# Required
GEMINI_API_KEY=your_google_ai_studio_api_key_here

# Optional (has defaults)
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=chrome-extension://*
```

### Get API Key

1. Visit: https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key (starts with "AIza...")
5. Add to backend `.env` file

---

## 🚀 Quick Start Commands

### Backend Development

```bash
# First time setup
cd backend
pnpm install
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Start development server
pnpm run start:dev

# Build for production
pnpm run build

# Run tests
pnpm run test
```

### Extension Development

```bash
# In project root
pnpm install

# Start extension in dev mode
pnpm run dev

# Build extension
pnpm run build
```

---

## 📡 API Endpoints

### Health Check
```
GET /health
Response: { status: 'ok', timestamp: '...', service: '...', version: '...' }
```

### Chat (Streaming)
```
POST /api/chat
Headers:
  Content-Type: application/json
  X-Extension-ID: [32-char extension ID]
  X-Extension-Version: [version string]
Body:
  {
    "messages": UIMessage[],
    "model": "gemini-2.5-flash" | "gemini-2.5-pro",
    "workflowId": string?,
    "threadId": string?,
    "initialPageContext": string?
  }
Response: Server-Sent Events stream
```

### Tool Sync
```
POST /api/tools/sync
Headers:
  Content-Type: application/json
  X-Extension-ID: [32-char extension ID]
Body:
  {
    "extensionId": string,
    "version": string,
    "timestamp": number,
    "schemas": CategorizedToolSchema[]
  }
Response:
  {
    "success": boolean,
    "message": string,
    "receivedCount": number,
    "storedCount": number
  }
```

---

## 🧪 Testing Checklist

### After Each Phase

- [ ] TypeScript compiles without errors
- [ ] Backend server starts successfully
- [ ] Extension builds without errors
- [ ] No console errors in extension
- [ ] Backend logs show expected output
- [ ] API endpoints return correct responses
- [ ] Integration tests pass

### Manual Testing

1. **Backend Mode**:
   - Switch to backend mode in UI
   - Send simple message
   - Verify streaming response
   - Check backend logs

2. **BYOK Mode**:
   - Switch to BYOK mode
   - Enter API key
   - Send message
   - Verify it still works as before

3. **Tool Execution** (Phase 5+):
   - Ask AI to navigate to a URL
   - Verify tool call received
   - Verify tool executed
   - Verify result sent back
   - Verify final response

---

## 🐛 Common Issues & Solutions

### Issue: Backend won't start
**Solution**: Check `.env` file has `GEMINI_API_KEY` set

### Issue: Extension can't connect to backend
**Solution**: 
- Check backend is running on correct port
- Check CORS is enabled
- Check extension ID header is sent

### Issue: Tool schemas not syncing
**Solution**:
- Check `/api/tools/sync` endpoint is accessible
- Check extension has valid ID
- Check backend logs for errors

### Issue: Streaming not working
**Solution**:
- Check `pipeUIMessageStreamToResponse` is used
- Check response headers allow streaming
- Check extension properly handles SSE

---

## 📚 Key Imports Reference

### Backend Imports

```typescript
// NestJS
import { Controller, Post, Get, Body, Res, UseGuards } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';

// AI SDK
import { streamText, convertToModelMessages } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Shared types
import type { ChatRequest, ToolSchema } from '@shared/types';
```

### Extension Imports

```typescript
// AI SDK
import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

// Shared types
import type { AIMode, RemoteModelType } from '@shared/types';

// Utils
import { getModelConfig, setModelConfig } from '../utils/modelSettings';
```

---

## 🎯 Phase Completion Criteria

Each phase is complete when:

1. ✅ All code changes implemented
2. ✅ TypeScript compiles without errors
3. ✅ All new files created
4. ✅ All tests pass
5. ✅ Manual testing successful
6. ✅ Documentation updated
7. ✅ Committed to version control
8. ✅ Ready for next phase

---

## 📞 Need Help?

If stuck:

1. Check phase-specific testing section
2. Review error logs (backend and extension)
3. Verify all files created/modified
4. Check this reference guide
5. Review AI SDK documentation: https://ai-sdk.dev/

---

**Good luck with your implementation! 🚀**
