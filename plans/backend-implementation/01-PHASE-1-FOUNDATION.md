# Phase 1: Foundation & Project Setup

**Goal**: Set up the basic NestJS backend structure, shared types folder, and deployment configuration.

**Duration**: 2-3 hours

**Prerequisites**: 
- Node.js 20+ installed
- pnpm installed (or npm)
- Access to Google AI Studio API key

---

## 📋 Tasks Overview

1. Create backend folder structure
2. Initialize NestJS project
3. Create shared types folder
4. Configure TypeScript paths
5. Setup Vercel deployment configuration
6. Create basic health check endpoint
7. Test local development server

---

## 🛠️ Step-by-Step Implementation

### Step 1: Create Backend Folder Structure

Create the following directory structure in your project root:

```bash
cd c:/Users/User/code/hackathons/chrome-ai

# Create backend directory
mkdir backend
cd backend
```

### Step 2: Initialize NestJS Project

```bash
# Initialize a new NestJS project
npx @nestjs/cli new . --package-manager pnpm --skip-git

# When prompted for "Which package manager would you ❤️  to use?"
# Select: pnpm
```

This creates:
- `src/` folder with basic NestJS structure
- `package.json` with NestJS dependencies
- `tsconfig.json` for TypeScript configuration
- `nest-cli.json` for NestJS CLI configuration

### Step 3: Install Required Dependencies

```bash
# Install AI SDK and Google provider
pnpm add ai @ai-sdk/google zod

# Install Vercel adapter for NestJS (for deployment)
pnpm add -D @nestjs/platform-express
```

### Step 4: Create Shared Folder Structure

Go back to project root and create shared folder:

```bash
cd ..
mkdir shared
mkdir shared/types
mkdir shared/utils
```

### Step 5: Create Shared Type Definitions

Create `shared/types/ai-mode.types.ts`:

```typescript
/**
 * Shared AI Mode types between extension and backend
 */

/**
 * AI Mode options
 * - backend: Uses NestJS backend with server-side API keys (default)
 * - byok: Bring Your Own Key - user provides their own API key
 */
export type AIMode = 'backend' | 'byok';

/**
 * Remote model options for Gemini
 */
export type RemoteModelType = 
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash';

/**
 * Model configuration
 */
export interface ModelConfig {
  mode: AIMode;
  remoteModel?: RemoteModelType;
}

/**
 * Extension identification
 */
export interface ExtensionInfo {
  id: string;
  version: string;
}
```

Create `shared/types/tool.types.ts`:

```typescript
/**
 * Shared tool type definitions
 */

import type { z } from 'zod';

/**
 * Tool schema definition (without execute function)
 * Used for backend communication
 */
export interface ToolSchema {
  name: string;
  description?: string;
  inputSchema: any; // Zod schema or JSON schema
  outputSchema?: any;
}

/**
 * Tool call from AI model
 */
export interface ToolCall {
  toolCallId: string;
  toolName: string;
  input: any;
}

/**
 * Tool result from extension
 */
export interface ToolResult {
  toolCallId: string;
  toolName: string;
  output: any;
  error?: string;
}

/**
 * Tool schemas sync request
 * Extension sends this to backend on startup
 */
export interface ToolSchemasSyncRequest {
  extensionId: string;
  version: string;
  schemas: ToolSchema[];
}
```

Create `shared/types/message.types.ts`:

```typescript
/**
 * Shared message types
 */

/**
 * Re-export UIMessage from AI SDK for consistency
 * Both extension and backend will use the same type
 */
export type { UIMessage } from 'ai';

/**
 * Chat request to backend
 */
export interface ChatRequest {
  messages: any[]; // UIMessage[] - using any to avoid circular deps
  modelConfig?: {
    mode: 'backend' | 'byok';
    remoteModel?: 'gemini-2.5-pro' | 'gemini-2.5-flash';
  };
  workflowId?: string;
  threadId?: string;
  initialPageContext?: string;
}

/**
 * Chat response from backend
 * Uses Server-Sent Events (SSE) for streaming
 */
export interface ChatStreamEvent {
  type: 'text-delta' | 'tool-call' | 'tool-result' | 'finish' | 'error';
  data: any;
}
```

Create `shared/types/index.ts`:

```typescript
/**
 * Shared types barrel export
 */

export * from './ai-mode.types';
export * from './tool.types';
export * from './message.types';
```

### Step 6: Update Backend TypeScript Configuration

Edit `backend/tsconfig.json` to add path mapping for shared folder:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  }
}
```

### Step 7: Create Basic Backend Structure

Update `backend/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Enable CORS for Chrome extension
  app.enableCors({
    origin: true, // Allow all origins in development
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Backend server running on http://localhost:${port}`);
}

bootstrap();
```

Update `backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

Update `backend/src/app.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'chrome-ai-backend',
      version: '1.0.0',
    };
  }
}
```

Update `backend/src/app.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Chrome AI Backend - Ready to serve!';
  }
}
```

### Step 8: Create Environment Configuration

Create `backend/.env.example`:

```bash
# Google Gemini API Key
GEMINI_API_KEY=your_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS=chrome-extension://*
```

Create `backend/.env` (add to .gitignore):

```bash
GEMINI_API_KEY=YOUR_ACTUAL_API_KEY_HERE
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=chrome-extension://*
```

Create `backend/.gitignore`:

```
# Dependencies
node_modules/

# Environment
.env
.env.local

# Build
dist/
build/

# Logs
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

### Step 9: Configure Vercel Deployment

Create `backend/vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/main.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/main.ts",
      "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "regions": ["iad1"]
}
```

### Step 10: Add Scripts to package.json

Update `backend/package.json` scripts:

```json
{
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "vercel-build": "nest build"
  }
}
```

---

## ✅ Testing Phase 1

### Test 1: Backend Development Server

```bash
cd backend
pnpm install
pnpm run start:dev
```

Expected output:
```
[Nest] INFO [NestFactory] Starting Nest application...
[Nest] INFO [InstanceLoader] AppModule dependencies initialized
[Nest] LOG Application is running on: http://localhost:3000
🚀 Backend server running on http://localhost:3000
```

### Test 2: Health Check Endpoint

Open browser and visit:
```
http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-06T...",
  "service": "chrome-ai-backend",
  "version": "1.0.0"
}
```

### Test 3: Shared Types Import

Create a test file `backend/src/test-shared.ts`:

```typescript
import { AIMode, RemoteModelType, ToolSchema } from '@shared/types';

const mode: AIMode = 'backend';
const model: RemoteModelType = 'gemini-2.5-flash';

console.log('Shared types work!', { mode, model });
```

Run:
```bash
npx ts-node src/test-shared.ts
```

Should print: `Shared types work! { mode: 'backend', model: 'gemini-2.5-flash' }`

Then delete the test file.

---

## 📁 Final Folder Structure

After Phase 1, your structure should look like:

```
chrome-ai/
├── backend/
│   ├── node_modules/
│   ├── src/
│   │   ├── app.controller.ts
│   │   ├── app.module.ts
│   │   ├── app.service.ts
│   │   └── main.ts
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   ├── nest-cli.json
│   ├── package.json
│   ├── tsconfig.json
│   └── vercel.json
├── shared/
│   ├── types/
│   │   ├── ai-mode.types.ts
│   │   ├── tool.types.ts
│   │   ├── message.types.ts
│   │   └── index.ts
│   └── utils/
└── src/
    └── (existing extension code)
```

---

## 🎯 Phase 1 Completion Checklist

- [ ] Backend folder created with NestJS structure
- [ ] Shared types folder created
- [ ] TypeScript paths configured for shared imports
- [ ] Basic health check endpoint working
- [ ] Development server runs successfully
- [ ] Vercel deployment configuration created
- [ ] Environment variables configured
- [ ] All dependencies installed
- [ ] Test imports from shared folder work

---

## 🚀 Next Steps

Once Phase 1 is complete and all tests pass:

**→ Proceed to Phase 2: Backend Mode Infrastructure**

This phase will:
- Rename existing "local"/"remote" to "backend"/"byok"
- Update UI components and dialogs
- Update type definitions across extension
- Maintain backward compatibility
