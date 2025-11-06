# Phase 3: Basic Backend API

**Goal**: Implement the core `/api/chat` endpoint in NestJS with streaming support and extension ID authentication.

**Duration**: 3-4 hours

**Prerequisites**: 
- Phase 1 & 2 completed
- Backend server running locally
- Extension updated with new mode names

---

## 📋 Tasks Overview

1. Create Chat module structure
2. Implement extension ID authentication guard
3. Create chat DTOs (Data Transfer Objects)
4. Implement chat service with AI SDK
5. Implement chat controller with streaming
6. Setup CORS for Chrome extension
7. Test end-to-end streaming

---

## 🛠️ Step-by-Step Implementation

### Step 1: Install Additional Dependencies

```bash
cd backend
pnpm add @nestjs/config class-validator class-transformer
```

### Step 2: Create Chat Module Structure

```bash
cd src
mkdir chat
mkdir chat/dto
mkdir auth
mkdir config
```

### Step 3: Create Configuration Module

**Create file**: `backend/src/config/app.config.ts`

```typescript
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY,
  allowedOrigins: process.env.ALLOWED_ORIGINS || 'chrome-extension://*',
});
```

**Create file**: `backend/src/config/gemini.config.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiConfig {
  constructor(private configService: ConfigService) {}

  get apiKey(): string {
    const key = this.configService.get<string>('geminiApiKey');
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    return key;
  }

  get defaultModel(): string {
    return 'gemini-2.5-flash';
  }

  get supportedModels(): string[] {
    return ['gemini-2.5-pro', 'gemini-2.5-flash'];
  }
}
```

### Step 4: Create Auth Guard for Extension ID

**Create file**: `backend/src/auth/extension-auth.guard.ts`

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ExtensionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Get extension ID from header
    const extensionId = request.headers['x-extension-id'] as string;
    
    if (!extensionId) {
      throw new UnauthorizedException('Extension ID is required');
    }
    
    // Validate extension ID format (Chrome extension IDs are 32 characters)
    if (!/^[a-z]{32}$/.test(extensionId)) {
      throw new UnauthorizedException('Invalid extension ID format');
    }
    
    // Store extension info in request for later use
    (request as any).extensionId = extensionId;
    (request as any).extensionVersion = request.headers['x-extension-version'] || 'unknown';
    
    return true;
  }
}
```

**Create file**: `backend/src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ExtensionAuthGuard } from './extension-auth.guard';

@Module({
  providers: [ExtensionAuthGuard],
  exports: [ExtensionAuthGuard],
})
export class AuthModule {}
```

### Step 5: Create Chat DTOs

**Create file**: `backend/src/chat/dto/chat-request.dto.ts`

```typescript
import { IsArray, IsOptional, IsString, IsIn } from 'class-validator';

export class ChatRequestDto {
  @IsArray()
  messages: any[]; // UIMessage[] - keep as any to avoid circular deps
  
  @IsOptional()
  @IsString()
  @IsIn(['gemini-2.5-pro', 'gemini-2.5-flash'])
  model?: string;
  
  @IsOptional()
  @IsString()
  workflowId?: string;
  
  @IsOptional()
  @IsString()
  threadId?: string;
  
  @IsOptional()
  @IsString()
  initialPageContext?: string;
}
```

### Step 6: Create Chat Service

**Create file**: `backend/src/chat/chat.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToModelMessages } from 'ai';
import { GeminiConfig } from '../config/gemini.config';
import { ChatRequestDto } from './dto/chat-request.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly geminiConfig: GeminiConfig) {}

  /**
   * Stream AI response using AI SDK
   */
  async streamResponse(dto: ChatRequestDto, extensionId: string) {
    this.logger.log(`Starting stream for extension: ${extensionId}`);
    
    // Get API key from config
    const apiKey = this.geminiConfig.apiKey;
    
    // Initialize Google AI provider
    const google = createGoogleGenerativeAI({ apiKey });
    
    // Select model (default to flash)
    const modelName = dto.model || this.geminiConfig.defaultModel;
    const model = google(modelName);
    
    this.logger.log(`Using model: ${modelName}`);
    
    // Convert messages to model format
    const messages = convertToModelMessages(dto.messages);
    
    // For now, we'll use a simple system prompt
    // In Phase 8, we'll add workflow support
    const systemPrompt = this.getSystemPrompt(dto.workflowId);
    
    try {
      // Stream text with AI SDK
      const result = streamText({
        model,
        messages,
        system: systemPrompt,
        // Phase 5 will add tools here
        maxSteps: 5, // Allow multi-step tool calls
      });
      
      return result;
    } catch (error) {
      this.logger.error('Error streaming response:', error);
      throw error;
    }
  }
  
  /**
   * Get system prompt based on workflow
   * TODO: Phase 8 will load actual workflow prompts
   */
  private getSystemPrompt(workflowId?: string): string {
    if (workflowId) {
      this.logger.log(`Workflow mode: ${workflowId}`);
      // For now, return a basic prompt
      return 'You are a helpful AI assistant running in a Chrome extension.';
    }
    
    // Default backend mode prompt
    return `You are a helpful AI assistant running in a Chrome extension.

You have access to various tools to help the user interact with their browser and web pages.
When the user asks you to perform actions, use the appropriate tools.

Be concise and helpful in your responses.`;
  }
}
```

### Step 7: Create Chat Controller

**Create file**: `backend/src/chat/chat.controller.ts`

```typescript
import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  Req,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ExtensionAuthGuard } from '../auth/extension-auth.guard';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@Controller('api/chat')
@UseGuards(ExtensionAuthGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(
    @Body() dto: ChatRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const extensionId = (req as any).extensionId;
    const extensionVersion = (req as any).extensionVersion;
    
    this.logger.log(
      `Chat request from extension ${extensionId} (v${extensionVersion})`,
    );
    
    try {
      // Get streaming result from service
      const result = await this.chatService.streamResponse(dto, extensionId);
      
      // Use AI SDK's pipeUIMessageStreamToResponse
      // This handles all the streaming protocol for us
      result.pipeUIMessageStreamToResponse(res);
      
    } catch (error) {
      this.logger.error('Error in chat endpoint:', error);
      
      // Send error response
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: {
          message: error.message || 'An error occurred while processing your request',
          code: 'INTERNAL_ERROR',
        },
      });
    }
  }
}
```

### Step 8: Create Chat Module

**Create file**: `backend/src/chat/chat.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AuthModule } from '../auth/auth.module';
import { GeminiConfig } from '../config/gemini.config';

@Module({
  imports: [AuthModule],
  controllers: [ChatController],
  providers: [ChatService, GeminiConfig],
})
export class ChatModule {}
```

### Step 9: Update App Module

**File**: `backend/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { AuthModule } from './auth/auth.module';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    ChatModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### Step 10: Update CORS Configuration

**File**: `backend/src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Enable validation for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Enable CORS for Chrome extension
  app.enableCors({
    origin: (origin, callback) => {
      // Allow all chrome-extension:// origins
      if (!origin || origin.startsWith('chrome-extension://')) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Extension-ID',
      'X-Extension-Version',
    ],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Backend server running on http://localhost:${port}`);
  console.log(`📡 Chat endpoint: http://localhost:${port}/api/chat`);
}

bootstrap();
```

### Step 11: Update Extension to Use Backend Transport

**Create file**: `src/ai/transport/backendTransport.ts`

```typescript
import { DefaultChatTransport } from 'ai';
import { createLogger } from '../../logger';

const log = createLogger('BackendTransport');

/**
 * Get backend API URL based on environment
 */
function getBackendUrl(): string {
  // Development: use local server
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // Production: use Vercel deployment
  // TODO: Update this URL after deploying to Vercel
  return 'https://your-backend.vercel.app';
}

/**
 * Create transport for backend mode
 */
export function createBackendTransport() {
  const backendUrl = getBackendUrl();
  const apiUrl = `${backendUrl}/api/chat`;
  
  log.info('Creating backend transport:', apiUrl);
  
  return new DefaultChatTransport({
    api: apiUrl,
    headers: () => {
      // Get extension ID and version
      const extensionId = chrome.runtime.id;
      const version = chrome.runtime.getManifest().version;
      
      return {
        'X-Extension-ID': extensionId,
        'X-Extension-Version': version,
      };
    },
    credentials: 'omit', // Don't send cookies to backend
  });
}
```

### Step 12: Update AI Logic to Use Backend Transport

**File**: `src/ai/core/aiLogic.ts`

Add import at the top:
```typescript
import { createBackendTransport } from '../transport/backendTransport';
```

Find where the stream is created and update for backend mode:

**Find** (around line 100-150):
```typescript
const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    // Create retry manager for this stream session
    const retryManager = createStreamRetryManager(writer, abortSignal);
```

**Add** before the `createUIMessageStream` call:
```typescript
// For backend mode, use transport instead of direct execution
if (effectiveMode === 'backend') {
  const transport = createBackendTransport();
  
  try {
    const result = await transport.sendMessages({
      messages,
      id: threadId || generateId(),
    });
    
    return result;
  } catch (error) {
    log.error('Backend transport error:', error);
    throw error;
  }
}

// For BYOK mode, continue with direct execution
const stream = createUIMessageStream({
  execute: async ({ writer }) => {
```

---

## ✅ Testing Phase 3

### Test 1: Backend Health Check

```bash
cd backend
pnpm run start:dev
```

Visit: `http://localhost:3000/health`

Expected response:
```json
{
  "status": "ok",
  "timestamp": "...",
  "service": "chrome-ai-backend",
  "version": "1.0.0"
}
```

### Test 2: Test Chat Endpoint with curl

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-Extension-ID: $(printf 'a%.0s' {1..32})" \
  -H "X-Extension-Version: 0.0.1" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ],
    "model": "gemini-2.5-flash"
  }'
```

Should see streaming response.

### Test 3: Test Extension Authentication

```bash
# Without extension ID - should fail
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": []}'
```

Expected response:
```json
{
  "statusCode": 401,
  "message": "Extension ID is required"
}
```

### Test 4: Extension Integration

1. Open the extension
2. Switch to "Backend" mode
3. Send a message: "Hello!"
4. Should see streaming response from backend
5. Check browser console for logs
6. Check backend logs for request info

### Test 5: Error Handling

1. Stop the backend server
2. Try sending a message in backend mode
3. Should see error: "Failed to connect to backend"
4. Start backend server
5. Retry - should work

---

## 🎯 Phase 3 Completion Checklist

- [ ] Chat module created with proper structure
- [ ] Extension ID authentication guard implemented
- [ ] Chat DTOs created and validated
- [ ] Chat service implemented with AI SDK
- [ ] Chat controller with streaming support
- [ ] CORS configured for Chrome extension
- [ ] Backend transport created in extension
- [ ] Extension updated to use backend transport
- [ ] Health check endpoint working
- [ ] Chat endpoint tested with curl
- [ ] Extension can send messages to backend
- [ ] Streaming responses work end-to-end
- [ ] Authentication working correctly
- [ ] Error handling tested

---

## 🚀 Next Steps

Once Phase 3 is complete:

**→ Proceed to Phase 4: Tool Schema Sync**

This phase will:
- Create shared tool type definitions
- Backend endpoint to receive tool schemas
- Extension sends tool schemas on startup
- Backend stores and uses schemas for AI calls
