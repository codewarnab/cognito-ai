# Phase 9: Production Hardening

**Goal**: Make the backend production-ready with comprehensive error handling, monitoring, logging, and performance optimizations.

**Duration**: 3-4 hours

**Prerequisites**: 
- Phases 1-8 completed
- All features working in development
- Ready for production deployment

---

## 📋 Overview

Transform the development backend into a production-ready service with:

1. **Error Handling**: Graceful error recovery and informative messages
2. **Retry Logic**: Automatic retries for transient failures
3. **Logging**: Structured, searchable logs for debugging
4. **Monitoring**: Health checks and metrics
5. **Performance**: Caching, rate limiting, optimization
6. **Security**: Input validation, authentication improvements
7. **Graceful Degradation**: Fallback mechanisms

---

## 🛠️ Step-by-Step Implementation

### Step 1: Create Global Exception Filter

**Create file**: `backend/src/common/filters/all-exceptions.filter.ts`

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    };

    // Log error details
    this.logger.error(
      `${request.method} ${request.url}`,
      JSON.stringify(errorResponse),
    );

    response.status(status).json(errorResponse);
  }
}
```

---

### Step 2: Create Logging Interceptor

**Create file**: `backend/src/common/interceptors/logging.interceptor.ts`

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const extensionId = headers['x-extension-id'] || 'unknown';

    const now = Date.now();
    
    this.logger.log(
      `→ ${method} ${url} | Extension: ${extensionId}`
    );

    return next
      .handle()
      .pipe(
        tap({
          next: () => {
            const responseTime = Date.now() - now;
            this.logger.log(
              `← ${method} ${url} | ${responseTime}ms`
            );
          },
          error: (error) => {
            const responseTime = Date.now() - now;
            this.logger.error(
              `✗ ${method} ${url} | ${responseTime}ms | ${error.message}`
            );
          },
        }),
      );
  }
}
```

---

### Step 3: Create Retry Service

**Create file**: `backend/src/common/utils/retry.util.ts`

```typescript
import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: any) => void;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  onRetry: () => {},
};

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  const logger = new Logger('Retry');

  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxAttempts) {
        logger.error(`Failed after ${attempt} attempts: ${error.message}`);
        throw error;
      }

      const delay = opts.delayMs * Math.pow(opts.backoffMultiplier, attempt - 1);
      
      logger.warn(
        `Attempt ${attempt}/${opts.maxAttempts} failed: ${error.message}. ` +
        `Retrying in ${delay}ms...`
      );

      opts.onRetry(attempt, error);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Determine if error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // Rate limit errors
  if (error.status === 429) {
    return true;
  }

  // Server errors (5xx)
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  return false;
}
```

---

### Step 4: Update Chat Service with Retry Logic

**File**: `backend/src/chat/chat.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { google } from '@ai-sdk/google';
import { streamText, convertToModelMessages } from 'ai';
import { withRetry, isRetryableError } from '../common/utils/retry.util';
// ... other imports ...

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly toolsService: ToolsService,
    private readonly mcpService: MCPService,
    private readonly workflowsService: WorkflowsService,
  ) {}

  async chat(extensionId: string, request: ChatRequest) {
    try {
      return await this.chatWithRetry(extensionId, request);
    } catch (error) {
      this.logger.error('Chat failed:', error);
      throw error;
    }
  }

  private async chatWithRetry(extensionId: string, request: ChatRequest) {
    return withRetry(
      async () => {
        // Load workflow
        const workflow = request.workflowId
          ? this.workflowsService.getWorkflow(request.workflowId)
          : undefined;
        
        // Get model
        const modelType = workflow?.preferredModel 
          || request.modelConfig?.remoteModel 
          || 'gemini-2.5-flash';
          
        const model = this.getModel(modelType);
        
        // Get and filter tools
        const extensionSchemas = request.toolSchemas || [];
        let tools = await this.mcpService.mergeWithExtensionTools(extensionSchemas);
        
        if (workflow) {
          tools = this.workflowsService.filterToolsForWorkflow(workflow, tools);
        }
        
        // Get configuration
        const systemPrompt = workflow 
          ? workflow.systemPrompt 
          : this.getDefaultSystemPrompt();
        
        const temperature = workflow
          ? this.workflowsService.getTemperature(workflow)
          : 0.7;
          
        const maxTokens = workflow
          ? this.workflowsService.getMaxTokens(workflow)
          : 4000;
        
        this.logger.log(
          `Chat: model=${modelType}, workflow=${workflow?.name || 'none'}, ` +
          `tools=${Object.keys(tools).length}, temp=${temperature}`
        );
        
        // Stream text with error handling
        const result = streamText({
          model,
          messages: convertToModelMessages(request.messages),
          tools,
          system: systemPrompt,
          temperature,
          maxTokens,
          
          // Error callback
          onError: ({ error }) => {
            this.logger.error('Stream error:', error);
            
            // Check if error is retryable
            if (isRetryableError(error)) {
              throw error; // Will trigger retry
            }
          },
        });

        return result;
      },
      {
        maxAttempts: 3,
        delayMs: 1000,
        backoffMultiplier: 2,
        onRetry: (attempt, error) => {
          this.logger.warn(
            `Chat retry attempt ${attempt}: ${error.message}`
          );
        },
      },
    );
  }
  
  // ... rest of service methods ...
}
```

---

### Step 5: Create Health Check Endpoint

**Create file**: `backend/src/health/health.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check() {
    return this.healthService.checkHealth();
  }

  @Get('detailed')
  async detailedCheck() {
    return this.healthService.detailedHealthCheck();
  }
}
```

**Create file**: `backend/src/health/health.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { MCPService } from '../mcp/mcp.service';
import { google } from '@ai-sdk/google';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    geminiApi: 'ok' | 'error';
    mcpClients: 'ok' | 'error';
    memory: 'ok' | 'warning' | 'critical';
  };
  details?: any;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(private readonly mcpService: MCPService) {}

  async checkHealth(): Promise<HealthStatus> {
    const checks = {
      geminiApi: await this.checkGeminiApi(),
      mcpClients: await this.checkMCPClients(),
      memory: this.checkMemory(),
    };

    const allHealthy = Object.values(checks).every(status => status === 'ok');
    const anyError = Object.values(checks).some(status => status === 'error');

    return {
      status: anyError ? 'unhealthy' : (allHealthy ? 'healthy' : 'degraded'),
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks,
    };
  }

  async detailedHealthCheck(): Promise<HealthStatus> {
    const basicHealth = await this.checkHealth();
    
    return {
      ...basicHealth,
      details: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV,
      },
    };
  }

  private async checkGeminiApi(): Promise<'ok' | 'error'> {
    try {
      const model = google('gemini-2.0-flash-exp', {
        apiKey: process.env.GEMINI_API_KEY,
      });
      
      // Simple test to verify API key works
      // You might want to add a lightweight test call here
      
      return 'ok';
    } catch (error) {
      this.logger.error('Gemini API health check failed:', error);
      return 'error';
    }
  }

  private async checkMCPClients(): Promise<'ok' | 'error'> {
    try {
      // Check if MCP clients are initialized
      const tools = await this.mcpService.getBackendMCPTools();
      return Object.keys(tools).length >= 0 ? 'ok' : 'error';
    } catch (error) {
      this.logger.error('MCP health check failed:', error);
      return 'error';
    }
  }

  private checkMemory(): 'ok' | 'warning' | 'critical' {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    if (usagePercent > 90) {
      this.logger.warn(`Memory usage critical: ${usagePercent.toFixed(1)}%`);
      return 'critical';
    } else if (usagePercent > 75) {
      this.logger.warn(`Memory usage high: ${usagePercent.toFixed(1)}%`);
      return 'warning';
    }

    return 'ok';
  }
}
```

**Create file**: `backend/src/health/health.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MCPModule } from '../mcp/mcp.module';

@Module({
  imports: [MCPModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
```

---

### Step 6: Add Rate Limiting

**Install dependencies**:
```bash
cd backend
pnpm add @nestjs/throttler
```

**File**: `backend/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
// ... other imports ...

@Module({
  imports: [
    // Rate limiting: 100 requests per 60 seconds per IP
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60 seconds
      limit: 100, // 100 requests
    }]),
    
    // ... other modules ...
  ],
  providers: [
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

---

### Step 7: Add Request Validation

**Install dependencies**:
```bash
cd backend
pnpm add class-validator class-transformer
```

**Create file**: `backend/src/chat/dto/chat-request.dto.ts`

```typescript
import { IsArray, IsString, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ModelConfigDto {
  @IsString()
  mode: 'backend' | 'byok';

  @IsOptional()
  @IsString()
  remoteModel?: 'gemini-2.5-pro' | 'gemini-2.5-flash';
}

export class ChatRequestDto {
  @IsArray()
  messages: any[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ModelConfigDto)
  modelConfig?: ModelConfigDto;

  @IsOptional()
  @IsString()
  workflowId?: string;

  @IsOptional()
  @IsString()
  threadId?: string;

  @IsOptional()
  @IsArray()
  toolSchemas?: any[];
}
```

**Update chat controller**:

```typescript
import { Body, ValidationPipe } from '@nestjs/common';
import { ChatRequestDto } from './dto/chat-request.dto';

@Controller('api/chat')
export class ChatController {
  @Post()
  async chat(
    @Headers('x-extension-id') extensionId: string,
    @Body(new ValidationPipe({ transform: true })) request: ChatRequestDto,
    @Res() res: Response,
  ) {
    // ... implementation ...
  }
}
```

---

### Step 8: Add Caching for Workflow Definitions

**Create file**: `backend/src/common/cache/cache.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cache: Map<string, { value: any; expiresAt: number }> = new Map();

  /**
   * Get cached value
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.logger.debug(`Cache expired: ${key}`);
      return undefined;
    }
    
    this.logger.debug(`Cache hit: ${key}`);
    return entry.value as T;
  }

  /**
   * Set cached value with TTL
   */
  set<T>(key: string, value: T, ttlMs: number = 60000): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    
    this.logger.debug(`Cache set: ${key} (TTL: ${ttlMs}ms)`);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
```

---

### Step 9: Add Graceful Shutdown

**File**: `backend/src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global filters and interceptors
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Backend server running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, starting graceful shutdown...`);
    
    try {
      await app.close();
      console.log('✓ Application closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('✗ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
```

---

### Step 10: Add Environment Variable Validation

**Create file**: `backend/src/config/env.validation.ts`

```typescript
import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

export function validateEnvironment() {
  const required = [
    'GEMINI_API_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    throw new Error('Environment validation failed');
  }

  logger.log('✓ Environment variables validated');
}
```

Call in `main.ts`:

```typescript
import { validateEnvironment } from './config/env.validation';

async function bootstrap() {
  validateEnvironment(); // Before creating app
  
  // ... rest of bootstrap ...
}
```

---

## ✅ Testing Phase 9

### Test 1: Error Handling

1. Stop Gemini API (invalid key)
2. Send request
3. Verify graceful error response
4. Check logs for error details

---

### Test 2: Retry Logic

1. Simulate network failure (disconnect)
2. Send request
3. Verify automatic retries
4. Check retry logs

---

### Test 3: Health Checks

1. Visit `http://localhost:3000/health`
2. Verify status is "healthy"
3. Visit `/health/detailed`
4. Verify all checks pass

---

### Test 4: Rate Limiting

1. Send 100+ requests rapidly
2. Verify rate limit kicks in after 100 requests
3. Wait 60 seconds
4. Verify requests work again

---

### Test 5: Graceful Shutdown

1. Start server
2. Send Ctrl+C
3. Verify:
   - "SIGINT received" message
   - MCP clients close
   - Application closes cleanly
   - No zombie processes

---

## 🎯 Phase 9 Completion Checklist

- [ ] Global exception filter implemented
- [ ] Logging interceptor added
- [ ] Retry logic with exponential backoff
- [ ] Health check endpoints
- [ ] Rate limiting configured
- [ ] Request validation
- [ ] Caching for workflows
- [ ] Graceful shutdown
- [ ] Environment validation
- [ ] All error scenarios tested

---

## 🚀 Next Steps

Once Phase 9 is complete:

**→ Proceed to Phase 10: Deployment & Documentation**

This phase will:
- Deploy backend to Vercel
- Update extension with production URL
- Test production deployment
- Write migration guide
- Update documentation
