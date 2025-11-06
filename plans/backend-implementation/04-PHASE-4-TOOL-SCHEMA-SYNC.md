# Phase 4: Tool Schema Sync

**Goal**: Implement automatic tool schema synchronization between extension and backend, enabling the backend to know about all available tools.

**Duration**: 2-3 hours

**Prerequisites**: 
- Phase 3 completed
- Backend API working
- Extension can communicate with backend

---

## 📋 Tasks Overview

1. Create tool schema extraction utility in extension
2. Create backend endpoint to receive tool schemas
3. Implement in-memory tool schema storage
4. Extension sends schemas on startup
5. Backend uses schemas in AI calls
6. Handle schema updates

---

## 🛠️ Step-by-Step Implementation

### Step 1: Update Shared Tool Types

**File**: `shared/types/tool.types.ts`

Add more detailed types:

```typescript
/**
 * Shared tool type definitions
 */

/**
 * Tool schema definition (without execute function)
 * Used for backend communication
 */
export interface ToolSchema {
  name: string;
  description?: string;
  inputSchema: any; // JSON schema representation
  outputSchema?: any;
  type?: 'function' | 'provider-defined';
  providerOptions?: Record<string, any>;
}

/**
 * Tool category for organization
 */
export type ToolCategory =
  | 'browser'      // Browser interaction tools (navigate, click, scroll)
  | 'content'      // Content tools (read page, search)
  | 'mcp'          // MCP server tools
  | 'agent'        // Agent tools (YouTube, etc.)
  | 'workflow'     // Workflow-specific tools
  | 'other';

/**
 * Categorized tool schema
 */
export interface CategorizedToolSchema extends ToolSchema {
  category: ToolCategory;
  requiresBrowser: boolean; // True if tool needs browser APIs
}

/**
 * Tool schemas sync request
 * Extension sends this to backend on startup or when tools change
 */
export interface ToolSchemasSyncRequest {
  extensionId: string;
  version: string;
  timestamp: number;
  schemas: CategorizedToolSchema[];
}

/**
 * Tool schemas sync response
 */
export interface ToolSchemasSyncResponse {
  success: boolean;
  message: string;
  receivedCount: number;
  storedCount: number;
}
```

### Step 2: Create Tool Schema Extractor in Extension

**Create file**: `src/ai/tools/schemaExtractor.ts`

```typescript
/**
 * Extract tool schemas for backend synchronization
 */

import { createLogger } from '../../logger';
import type { CategorizedToolSchema, ToolCategory } from '@shared/types';
import { getAllTools } from './registryUtils';

const log = createLogger('ToolSchemaExtractor');

/**
 * Tool category mapping
 * Maps tool names to their categories
 */
const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  // Browser interaction tools
  navigateTo: 'browser',
  clickElement: 'browser',
  scrollPage: 'browser',
  switchTab: 'browser',
  openNewTab: 'browser',
  closeTab: 'browser',
  
  // Content tools
  getPageContent: 'content',
  searchPage: 'content',
  getPageMetadata: 'content',
  
  // Workflow tools
  generateMarkdown: 'workflow',
  generatePDF: 'workflow',
  getReportTemplate: 'workflow',
  
  // Agent tools
  analyzeYouTubeVideo: 'agent',
};

/**
 * Tools that require browser APIs
 * These MUST be executed on the extension side
 */
const BROWSER_REQUIRED_TOOLS = [
  'navigateTo',
  'clickElement',
  'scrollPage',
  'switchTab',
  'openNewTab',
  'closeTab',
  'getPageContent',
  'searchPage',
  'getPageMetadata',
];

/**
 * Convert Zod schema to JSON schema representation
 */
function zodToJsonSchema(zodSchema: any): any {
  // This is a simplified conversion
  // In production, you might want to use a library like zod-to-json-schema
  
  try {
    // Try to extract the shape of the schema
    if (zodSchema._def && zodSchema._def.typeName) {
      const typeName = zodSchema._def.typeName;
      
      if (typeName === 'ZodObject') {
        const shape = zodSchema._def.shape();
        const properties: Record<string, any> = {};
        const required: string[] = [];
        
        for (const [key, value] of Object.entries(shape)) {
          properties[key] = zodToJsonSchema(value);
          
          // Check if field is required
          if ((value as any)._def && !(value as any)._def.isOptional) {
            required.push(key);
          }
        }
        
        return {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        };
      }
      
      if (typeName === 'ZodString') {
        return { type: 'string', description: zodSchema._def.description };
      }
      
      if (typeName === 'ZodNumber') {
        return { type: 'number', description: zodSchema._def.description };
      }
      
      if (typeName === 'ZodBoolean') {
        return { type: 'boolean', description: zodSchema._def.description };
      }
      
      if (typeName === 'ZodArray') {
        return {
          type: 'array',
          items: zodToJsonSchema(zodSchema._def.type),
        };
      }
    }
    
    // Fallback: return a generic object type
    return { type: 'object' };
  } catch (error) {
    log.warn('Failed to convert Zod schema:', error);
    return { type: 'object' };
  }
}

/**
 * Extract schema from a tool
 */
function extractToolSchema(toolName: string, tool: any): CategorizedToolSchema | null {
  try {
    // Get tool category
    const category: ToolCategory = TOOL_CATEGORIES[toolName] || 'other';
    const requiresBrowser = BROWSER_REQUIRED_TOOLS.includes(toolName);
    
    // Extract schema information
    const schema: CategorizedToolSchema = {
      name: toolName,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.inputSchema),
      category,
      requiresBrowser,
    };
    
    // Add output schema if available
    if (tool.outputSchema) {
      schema.outputSchema = zodToJsonSchema(tool.outputSchema);
    }
    
    // Add provider options if available
    if (tool.providerOptions) {
      schema.providerOptions = tool.providerOptions;
    }
    
    return schema;
  } catch (error) {
    log.error(`Failed to extract schema for tool ${toolName}:`, error);
    return null;
  }
}

/**
 * Extract all tool schemas
 */
export function extractAllToolSchemas(): CategorizedToolSchema[] {
  log.info('Extracting tool schemas...');
  
  const allTools = getAllTools();
  const schemas: CategorizedToolSchema[] = [];
  
  for (const [toolName, tool] of Object.entries(allTools)) {
    const schema = extractToolSchema(toolName, tool);
    if (schema) {
      schemas.push(schema);
    }
  }
  
  log.info(`Extracted ${schemas.length} tool schemas`);
  
  return schemas;
}

/**
 * Get tool schemas by category
 */
export function getToolSchemasByCategory(): Record<ToolCategory, CategorizedToolSchema[]> {
  const schemas = extractAllToolSchemas();
  const categorized: Record<ToolCategory, CategorizedToolSchema[]> = {
    browser: [],
    content: [],
    mcp: [],
    agent: [],
    workflow: [],
    other: [],
  };
  
  for (const schema of schemas) {
    categorized[schema.category].push(schema);
  }
  
  return categorized;
}
```

### Step 3: Create Tool Sync Service in Extension

**Create file**: `src/ai/tools/toolSync.ts`

```typescript
/**
 * Tool synchronization with backend
 */

import { createLogger } from '../../logger';
import { extractAllToolSchemas } from './schemaExtractor';
import type { ToolSchemasSyncRequest, ToolSchemasSyncResponse } from '@shared/types';

const log = createLogger('ToolSync');

/**
 * Get backend URL
 */
function getBackendUrl(): string {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return 'https://your-backend.vercel.app'; // TODO: Update after deployment
}

/**
 * Sync tool schemas with backend
 */
export async function syncToolSchemas(): Promise<boolean> {
  try {
    log.info('Syncing tool schemas with backend...');
    
    // Extract tool schemas
    const schemas = extractAllToolSchemas();
    
    // Prepare sync request
    const request: ToolSchemasSyncRequest = {
      extensionId: chrome.runtime.id,
      version: chrome.runtime.getManifest().version,
      timestamp: Date.now(),
      schemas,
    };
    
    log.info(`Sending ${schemas.length} tool schemas to backend`);
    
    // Send to backend
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/api/tools/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-ID': chrome.runtime.id,
        'X-Extension-Version': chrome.runtime.getManifest().version,
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
    }
    
    const result: ToolSchemasSyncResponse = await response.json();
    
    log.info('Tool sync successful:', result);
    
    return result.success;
  } catch (error) {
    log.error('Failed to sync tool schemas:', error);
    return false;
  }
}

/**
 * Sync tool schemas on extension startup
 * Call this from the sidepanel initialization
 */
export function initializeToolSync() {
  // Sync immediately
  syncToolSchemas();
  
  // Re-sync every hour (in case tools change)
  setInterval(() => {
    syncToolSchemas();
  }, 60 * 60 * 1000); // 1 hour
}
```

### Step 4: Create Tools Module in Backend

**Create directory**:
```bash
cd backend/src
mkdir tools
mkdir tools/dto
```

**Create file**: `backend/src/tools/dto/tool-sync.dto.ts`

```typescript
import { IsArray, IsString, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ToolSchemaDto {
  @IsString()
  name: string;
  
  @IsString()
  description?: string;
  
  inputSchema: any;
  
  outputSchema?: any;
  
  @IsString()
  category: string;
  
  requiresBrowser: boolean;
}

export class ToolSchemaSyncDto {
  @IsString()
  extensionId: string;
  
  @IsString()
  version: string;
  
  @IsNumber()
  timestamp: number;
  
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToolSchemaDto)
  schemas: ToolSchemaDto[];
}
```

### Step 5: Create Tools Service in Backend

**Create file**: `backend/src/tools/tools.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import type { CategorizedToolSchema } from '@shared/types';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  
  // In-memory storage of tool schemas per extension
  private toolSchemas = new Map<string, {
    version: string;
    timestamp: number;
    schemas: CategorizedToolSchema[];
  }>();

  /**
   * Store tool schemas for an extension
   */
  storeToolSchemas(
    extensionId: string,
    version: string,
    schemas: CategorizedToolSchema[],
  ): void {
    this.logger.log(
      `Storing ${schemas.length} tool schemas for extension ${extensionId}`,
    );
    
    this.toolSchemas.set(extensionId, {
      version,
      timestamp: Date.now(),
      schemas,
    });
    
    // Log tool categories
    const categoryCounts = this.getCategoryCounts(schemas);
    this.logger.log('Tool categories:', categoryCounts);
  }

  /**
   * Get tool schemas for an extension
   */
  getToolSchemas(extensionId: string): CategorizedToolSchema[] {
    const stored = this.toolSchemas.get(extensionId);
    
    if (!stored) {
      this.logger.warn(`No tool schemas found for extension ${extensionId}`);
      return [];
    }
    
    return stored.schemas;
  }

  /**
   * Get tool schemas that can be executed on backend
   * (i.e., tools that don't require browser APIs)
   */
  getBackendExecutableTools(extensionId: string): CategorizedToolSchema[] {
    const schemas = this.getToolSchemas(extensionId);
    return schemas.filter(schema => !schema.requiresBrowser);
  }

  /**
   * Get tool schemas that require browser execution
   */
  getBrowserRequiredTools(extensionId: string): CategorizedToolSchema[] {
    const schemas = this.getToolSchemas(extensionId);
    return schemas.filter(schema => schema.requiresBrowser);
  }

  /**
   * Get count of tools by category
   */
  private getCategoryCounts(schemas: CategorizedToolSchema[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const schema of schemas) {
      counts[schema.category] = (counts[schema.category] || 0) + 1;
    }
    
    return counts;
  }

  /**
   * Convert categorized tool schemas to AI SDK tool format
   * WITHOUT execute functions (for backend-side tool calling)
   */
  convertToAISDKTools(schemas: CategorizedToolSchema[]): Record<string, any> {
    const tools: Record<string, any> = {};
    
    for (const schema of schemas) {
      tools[schema.name] = {
        description: schema.description,
        inputSchema: schema.inputSchema,
        // No execute function - backend will return tool calls
        // Extension will execute and send results back
      };
    }
    
    return tools;
  }
}
```

### Step 6: Create Tools Controller in Backend

**Create file**: `backend/src/tools/tools.controller.ts`

```typescript
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ExtensionAuthGuard } from '../auth/extension-auth.guard';
import { ToolsService } from './tools.service';
import { ToolSchemaSyncDto } from './dto/tool-sync.dto';
import type { ToolSchemasSyncResponse } from '@shared/types';

@Controller('api/tools')
@UseGuards(ExtensionAuthGuard)
export class ToolsController {
  private readonly logger = new Logger(ToolsController.name);

  constructor(private readonly toolsService: ToolsService) {}

  @Post('sync')
  async syncToolSchemas(
    @Body() dto: ToolSchemaSyncDto,
    @Req() req: Request,
  ): Promise<ToolSchemasSyncResponse> {
    const extensionId = (req as any).extensionId;
    
    this.logger.log(
      `Tool sync request from ${extensionId} (v${dto.version})`,
    );
    
    try {
      // Store tool schemas
      this.toolsService.storeToolSchemas(
        extensionId,
        dto.version,
        dto.schemas,
      );
      
      return {
        success: true,
        message: 'Tool schemas synced successfully',
        receivedCount: dto.schemas.length,
        storedCount: dto.schemas.length,
      };
    } catch (error) {
      this.logger.error('Failed to sync tool schemas:', error);
      
      throw new HttpException(
        {
          success: false,
          message: 'Failed to sync tool schemas',
          receivedCount: dto.schemas.length,
          storedCount: 0,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
```

### Step 7: Create Tools Module

**Create file**: `backend/src/tools/tools.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ToolsController],
  providers: [ToolsService],
  exports: [ToolsService], // Export for use in ChatService
})
export class ToolsModule {}
```

### Step 8: Update App Module

**File**: `backend/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { AuthModule } from './auth/auth.module';
import { ToolsModule } from './tools/tools.module'; // Add this
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    ChatModule,
    AuthModule,
    ToolsModule, // Add this
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### Step 9: Initialize Tool Sync in Extension

**File**: `src/sidepanel.tsx`

Add import at the top:
```typescript
import { initializeToolSync } from './ai/tools/toolSync';
```

Add in the component initialization (in `useEffect` or component mount):
```typescript
useEffect(() => {
  // Initialize tool sync with backend
  initializeToolSync();
  
  // ... other initialization code
}, []);
```

---

## ✅ Testing Phase 4

### Test 1: Backend Tools Endpoint

Start backend:
```bash
cd backend
pnpm run start:dev
```

### Test 2: Test Tool Sync with curl

```bash
curl -X POST http://localhost:3000/api/tools/sync \
  -H "Content-Type: application/json" \
  -H "X-Extension-ID: $(printf 'a%.0s' {1..32})" \
  -H "X-Extension-Version: 0.0.1" \
  -d '{
    "extensionId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "version": "0.0.1",
    "timestamp": 1699999999999,
    "schemas": [
      {
        "name": "navigateTo",
        "description": "Navigate to a URL",
        "inputSchema": {
          "type": "object",
          "properties": {
            "url": {"type": "string"}
          },
          "required": ["url"]
        },
        "category": "browser",
        "requiresBrowser": true
      }
    ]
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Tool schemas synced successfully",
  "receivedCount": 1,
  "storedCount": 1
}
```

### Test 3: Extension Auto-Sync

1. Open extension
2. Check browser console
3. Should see: "Syncing tool schemas with backend..."
4. Should see: "Tool sync successful"
5. Check backend logs
6. Should see tool categories logged

### Test 4: Verify Stored Schemas

Add a debug endpoint in backend to check stored schemas:

**File**: `backend/src/tools/tools.controller.ts`

```typescript
@Get('schemas/:extensionId')
async getSchemas(@Param('extensionId') extensionId: string) {
  const schemas = this.toolsService.getToolSchemas(extensionId);
  return {
    extensionId,
    count: schemas.length,
    schemas,
  };
}
```

Then test:
```bash
curl http://localhost:3000/api/tools/schemas/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  -H "X-Extension-ID: $(printf 'a%.0s' {1..32})"
```

---

## 🎯 Phase 4 Completion Checklist

- [ ] Tool schema extractor created
- [ ] Tool sync service created in extension
- [ ] Backend tools module created
- [ ] Tools service stores schemas in memory
- [ ] Tools controller receives sync requests
- [ ] Extension syncs on startup
- [ ] Extension re-syncs periodically
- [ ] Backend logs tool categories
- [ ] curl tests pass
- [ ] Extension auto-sync works
- [ ] No TypeScript errors

---

## 🚀 Next Steps

Once Phase 4 is complete:

**→ Proceed to Phase 5: Tool Execution Flow**

This phase will:
- Backend returns tool calls (not executed)
- Extension receives and executes tools
- Extension sends tool results back
- Backend continues with results
- Full round-trip tool calling works
