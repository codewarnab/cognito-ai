# Phase 7: MCP Integration

**Goal**: Integrate Model Context Protocol (MCP) tools with backend mode, enabling both server-side and client-side MCP tool execution.

**Duration**: 3-4 hours

**Prerequisites**: 
- Phase 6 completed
- Model selection working
- Tool execution flow stable
- Understanding of MCP concepts

---

## 📋 Overview

Model Context Protocol (MCP) enables integration with external services through a standardized interface. This phase implements MCP support in backend mode.

**Key Concepts**:
- **Extension Tools**: Browser-specific (tabs, navigation, etc.) - Execute on extension
- **MCP Tools**: External services (APIs, databases, etc.) - Can execute on backend OR extension
- **Hybrid Execution**: Smart routing based on tool type

**MCP Tool Categories**:
1. **Backend-Compatible**: API calls, data queries (execute on backend)
2. **Browser-Dependent**: Screen capture, DOM access (execute on extension)
3. **Hybrid**: Can run anywhere (execute on extension for consistency)

---

## 🎯 Architecture

### MCP Tool Flow

```
┌───────────────────────────────────────────────────────────────┐
│                        Extension                              │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           MCP Client Manager                         │   │
│  │  - Initialize MCP clients                           │   │
│  │  - Discover MCP tools                               │   │
│  │  - Classify tools (backend/extension)              │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                    │
│           ┌──────────────┴──────────────┐                   │
│           │                             │                    │
│  ┌────────▼────────┐         ┌─────────▼────────┐          │
│  │  Extension MCP  │         │   Backend MCP    │          │
│  │     Tools       │         │      Tools       │          │
│  │  (browser APIs) │         │   (sent to       │          │
│  │                 │         │    backend)      │          │
│  └─────────────────┘         └──────────────────┘          │
│                                       │                      │
└───────────────────────────────────────┼──────────────────────┘
                                        │
                        ┌───────────────▼──────────────┐
                        │    NestJS Backend            │
                        │                              │
                        │  ┌────────────────────────┐  │
                        │  │  MCP Client Manager    │  │
                        │  │  - HTTP/SSE transports │  │
                        │  │  - Execute MCP tools   │  │
                        │  └────────────────────────┘  │
                        │                              │
                        │  ┌────────────────────────┐  │
                        │  │  External MCP Servers  │  │
                        │  │  - API services        │  │
                        │  │  - Data sources        │  │
                        │  └────────────────────────┘  │
                        └──────────────────────────────┘
```

---

## 🛠️ Step-by-Step Implementation

### Step 1: Update Shared Types

**File**: `shared/types/tool.types.ts`

Add MCP-specific types:

```typescript
/**
 * MCP tool metadata
 */
export interface MCPToolMetadata {
  serverName: string;
  serverUrl?: string;
  transportType: 'http' | 'sse' | 'stdio';
  executionLocation: 'backend' | 'extension' | 'either';
}

/**
 * Tool schema with MCP metadata
 */
export interface ToolSchemaWithMCP extends ToolSchema {
  mcp?: MCPToolMetadata;
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  name: string;
  url?: string;
  transport: 'http' | 'sse' | 'stdio';
  headers?: Record<string, string>;
  enabled: boolean;
}
```

---

### Step 2: Create MCP Tool Classifier

**Create file**: `src/ai/mcp/classifier.ts`

```typescript
import { createLogger } from '../../logger';
import type { MCPToolMetadata } from '@shared/types';

const log = createLogger('MCPClassifier');

/**
 * Determine where an MCP tool should execute
 */
export function classifyMCPTool(
  toolName: string,
  toolDescription: string,
  serverName: string
): MCPToolMetadata['executionLocation'] {
  // Browser-dependent keywords
  const browserKeywords = [
    'screenshot',
    'capture',
    'dom',
    'page',
    'browser',
    'tab',
    'window',
    'cookie',
    'storage',
    'viewport',
  ];
  
  // API/Backend keywords
  const backendKeywords = [
    'api',
    'fetch',
    'request',
    'query',
    'search',
    'database',
    'webhook',
    'http',
  ];
  
  const lowerName = toolName.toLowerCase();
  const lowerDesc = toolDescription?.toLowerCase() || '';
  const combined = `${lowerName} ${lowerDesc}`;
  
  // Check if tool requires browser context
  const needsBrowser = browserKeywords.some(keyword => 
    combined.includes(keyword)
  );
  
  if (needsBrowser) {
    log.info(`${toolName} → extension (browser-dependent)`);
    return 'extension';
  }
  
  // Check if tool is API-based
  const isBackendSuitable = backendKeywords.some(keyword =>
    combined.includes(keyword)
  );
  
  if (isBackendSuitable) {
    log.info(`${toolName} → backend (API-based)`);
    return 'backend';
  }
  
  // Default to extension for safety
  log.info(`${toolName} → extension (default)`);
  return 'extension';
}
```

---

### Step 3: Update MCP Proxy

**File**: `src/ai/mcp/proxy.ts`

Update to classify and tag MCP tools:

```typescript
import { experimental_createMCPClient } from '@ai-sdk/mcp';
import { createLogger } from '../../logger';
import { classifyMCPTool } from './classifier';
import type { ToolSchemaWithMCP, MCPServerConfig } from '@shared/types';

const log = createLogger('MCPProxy');

let mcpClients: Map<string, any> = new Map();

/**
 * Initialize MCP clients from configuration
 */
export async function initializeMCPClients(
  configs: MCPServerConfig[]
): Promise<void> {
  log.info(`Initializing ${configs.length} MCP clients`);
  
  for (const config of configs) {
    if (!config.enabled) {
      log.info(`Skipping disabled MCP server: ${config.name}`);
      continue;
    }
    
    try {
      const client = await experimental_createMCPClient({
        transport: {
          type: config.transport,
          url: config.url || '',
          headers: config.headers,
        },
      });
      
      mcpClients.set(config.name, client);
      log.info(`✓ Initialized MCP client: ${config.name}`);
    } catch (error) {
      log.error(`✗ Failed to initialize ${config.name}:`, error);
    }
  }
}

/**
 * Get all MCP tools with classification metadata
 */
export async function getMCPTools(): Promise<ToolSchemaWithMCP[]> {
  const allTools: ToolSchemaWithMCP[] = [];
  
  for (const [serverName, client] of mcpClients.entries()) {
    try {
      const tools = await client.tools();
      
      for (const [toolName, tool] of Object.entries(tools)) {
        const executionLocation = classifyMCPTool(
          toolName,
          tool.description || '',
          serverName
        );
        
        allTools.push({
          name: toolName,
          description: tool.description,
          inputSchema: tool.inputSchema,
          mcp: {
            serverName,
            transportType: 'http', // or from config
            executionLocation,
          },
        });
      }
      
      log.info(`Loaded ${Object.keys(tools).length} tools from ${serverName}`);
    } catch (error) {
      log.error(`Failed to get tools from ${serverName}:`, error);
    }
  }
  
  return allTools;
}

/**
 * Get only backend-compatible MCP tools
 */
export async function getBackendMCPTools(): Promise<ToolSchemaWithMCP[]> {
  const allTools = await getMCPTools();
  return allTools.filter(tool => 
    tool.mcp?.executionLocation === 'backend' ||
    tool.mcp?.executionLocation === 'either'
  );
}

/**
 * Get only extension-side MCP tools
 */
export async function getExtensionMCPTools(): Promise<ToolSchemaWithMCP[]> {
  const allTools = await getMCPTools();
  return allTools.filter(tool =>
    tool.mcp?.executionLocation === 'extension' ||
    tool.mcp?.executionLocation === 'either'
  );
}

/**
 * Execute MCP tool
 */
export async function executeMCPTool(
  toolName: string,
  input: any
): Promise<any> {
  for (const [serverName, client] of mcpClients.entries()) {
    const tools = await client.tools();
    
    if (tools[toolName]) {
      log.info(`Executing MCP tool ${toolName} on ${serverName}`);
      
      try {
        // MCP tools need to be executed through the client
        const result = await tools[toolName].execute(input);
        return result;
      } catch (error) {
        log.error(`MCP tool execution failed: ${toolName}`, error);
        throw error;
      }
    }
  }
  
  throw new Error(`MCP tool not found: ${toolName}`);
}

/**
 * Cleanup MCP clients
 */
export async function closeMCPClients(): Promise<void> {
  log.info('Closing MCP clients');
  
  for (const [name, client] of mcpClients.entries()) {
    try {
      await client.close();
      log.info(`Closed MCP client: ${name}`);
    } catch (error) {
      log.error(`Failed to close ${name}:`, error);
    }
  }
  
  mcpClients.clear();
}
```

---

### Step 4: Update Extension Tool Schema Sync

**File**: `src/ai/tools/schemaConverter.ts`

Include MCP tools in schema sync:

```typescript
import { getAllTools } from './registry';
import { getMCPTools, getExtensionMCPTools } from '../mcp/proxy';
import type { ToolSchemaWithMCP } from '@shared/types';

/**
 * Get all tool schemas for backend
 * Includes both extension tools and MCP tools
 */
export async function getToolSchemas(): Promise<ToolSchemaWithMCP[]> {
  // Get standard extension tools
  const extensionTools = await getAllTools();
  const extensionSchemas: ToolSchemaWithMCP[] = extensionTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    // No MCP metadata for regular extension tools
  }));
  
  // Get MCP tools (only those that should execute on extension)
  const mcpSchemas = await getExtensionMCPTools();
  
  // Get backend-compatible MCP tools
  const backendMCPSchemas = await getBackendMCPTools();
  
  console.log(`Tool schemas: ${extensionSchemas.length} extension, ${mcpSchemas.length} extension-MCP, ${backendMCPSchemas.length} backend-MCP`);
  
  // Send all schemas to backend
  // Backend will see which it can execute
  return [
    ...extensionSchemas,
    ...mcpSchemas,
    ...backendMCPSchemas,
  ];
}
```

---

### Step 5: Backend MCP Client Setup

**Create file**: `backend/src/mcp/mcp.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { MCPService } from './mcp.service';

@Module({
  providers: [MCPService],
  exports: [MCPService],
})
export class MCPModule {}
```

**Create file**: `backend/src/mcp/mcp.service.ts`

```typescript
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { experimental_createMCPClient } from '@ai-sdk/mcp';
import { ToolSchemaWithMCP } from '@shared/types';

@Injectable()
export class MCPService implements OnModuleDestroy {
  private readonly logger = new Logger(MCPService.name);
  private mcpClients: Map<string, any> = new Map();
  
  /**
   * Initialize backend MCP clients
   */
  async initializeClients(): Promise<void> {
    // Backend can connect to MCP servers via HTTP/SSE
    const mcpServers = this.getMCPServerConfigs();
    
    for (const config of mcpServers) {
      try {
        const client = await experimental_createMCPClient({
          transport: {
            type: config.transport,
            url: config.url,
            headers: config.headers,
          },
        });
        
        this.mcpClients.set(config.name, client);
        this.logger.log(`Initialized MCP client: ${config.name}`);
      } catch (error) {
        this.logger.error(`Failed to initialize MCP client ${config.name}:`, error);
      }
    }
  }
  
  /**
   * Get MCP tools that can execute on backend
   */
  async getBackendMCPTools(): Promise<Record<string, any>> {
    const tools: Record<string, any> = {};
    
    for (const [serverName, client] of this.mcpClients.entries()) {
      try {
        const serverTools = await client.tools();
        
        // Add all MCP tools with server prefix
        for (const [toolName, tool] of Object.entries(serverTools)) {
          const prefixedName = `${serverName}_${toolName}`;
          tools[prefixedName] = tool;
        }
        
        this.logger.log(`Loaded ${Object.keys(serverTools).length} tools from ${serverName}`);
      } catch (error) {
        this.logger.error(`Failed to get tools from ${serverName}:`, error);
      }
    }
    
    return tools;
  }
  
  /**
   * Merge backend MCP tools with extension tool schemas
   */
  async mergeWithExtensionTools(
    extensionSchemas: ToolSchemaWithMCP[]
  ): Promise<Record<string, any>> {
    const mergedTools: Record<string, any> = {};
    
    // Add extension tools (without execute functions)
    for (const schema of extensionSchemas) {
      if (schema.mcp?.executionLocation !== 'backend') {
        // Extension will handle execution
        mergedTools[schema.name] = {
          description: schema.description,
          inputSchema: schema.inputSchema,
          // No execute function
        };
      }
    }
    
    // Add backend MCP tools (with execute functions)
    const backendMCPTools = await this.getBackendMCPTools();
    for (const [name, tool] of Object.entries(backendMCPTools)) {
      // Only include if schema says it can run on backend
      const schema = extensionSchemas.find(s => 
        s.name === name && 
        (s.mcp?.executionLocation === 'backend' || s.mcp?.executionLocation === 'either')
      );
      
      if (schema) {
        mergedTools[name] = tool; // With execute function
      }
    }
    
    this.logger.log(`Merged tools: ${Object.keys(mergedTools).length} total`);
    return mergedTools;
  }
  
  private getMCPServerConfigs() {
    // Load from environment or config file
    // Example:
    return [
      {
        name: 'weather',
        transport: 'http' as const,
        url: process.env.MCP_WEATHER_URL || 'https://api.weather.com/mcp',
        headers: {
          'Authorization': `Bearer ${process.env.MCP_WEATHER_TOKEN}`,
        },
      },
      // Add more MCP servers as needed
    ];
  }
  
  async onModuleDestroy() {
    this.logger.log('Closing MCP clients...');
    
    for (const [name, client] of this.mcpClients.entries()) {
      try {
        await client.close();
        this.logger.log(`Closed MCP client: ${name}`);
      } catch (error) {
        this.logger.error(`Failed to close ${name}:`, error);
      }
    }
  }
}
```

---

### Step 6: Update Backend Chat Service

**File**: `backend/src/chat/chat.service.ts`

Integrate MCP tools:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { google } from '@ai-sdk/google';
import { streamText, convertToModelMessages } from 'ai';
import { ToolsService } from '../tools/tools.service';
import { MCPService } from '../mcp/mcp.service';
import { ChatRequest } from '@shared/types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly toolsService: ToolsService,
    private readonly mcpService: MCPService,
  ) {}

  async chat(extensionId: string, request: ChatRequest) {
    const model = this.getModel(request.modelConfig?.remoteModel);
    
    // Get extension tool schemas
    const extensionSchemas = request.toolSchemas || [];
    
    // Merge with backend MCP tools
    const tools = await this.mcpService.mergeWithExtensionTools(extensionSchemas);
    
    this.logger.log(`Chat with ${Object.keys(tools).length} tools (includes MCP)`);
    
    const result = streamText({
      model,
      messages: convertToModelMessages(request.messages),
      tools,
      system: this.getSystemPrompt(request),
      temperature: 0.7,
      maxTokens: 4000,
    });

    return result;
  }
  
  // ... rest of service methods ...
}
```

---

### Step 7: Update Extension Tool Executor

**File**: `src/ai/tools/executor.ts`

Handle MCP tool execution:

```typescript
import { createLogger } from '../../logger';
import { getAllTools } from './registry';
import { executeMCPTool } from '../mcp/proxy';

const log = createLogger('ToolExecutor');

export async function executeLocalTool(
  toolName: string,
  input: any
): Promise<any> {
  // Try regular extension tools first
  const tools = await getAllTools();
  const tool = tools.find(t => t.name === toolName);
  
  if (tool && tool.execute) {
    log.info(`Executing extension tool: ${toolName}`);
    return await tool.execute(input);
  }
  
  // Try MCP tools
  try {
    log.info(`Executing MCP tool: ${toolName}`);
    return await executeMCPTool(toolName, input);
  } catch (error) {
    log.error(`Tool execution failed: ${toolName}`, error);
    throw new Error(`Tool not found or execution failed: ${toolName}`);
  }
}
```

---

## ✅ Testing Phase 7

### Test 1: MCP Client Initialization

1. Configure MCP server in environment
2. Start backend
3. Check logs for MCP client initialization
4. Verify tools are discovered

**Expected backend logs:**
```
Initialized MCP client: weather
Loaded 5 tools from weather
```

---

### Test 2: Backend MCP Tool Execution

1. Send request that triggers backend MCP tool
2. Verify tool executes on backend
3. Verify result is returned correctly

---

### Test 3: Extension MCP Tool Execution

1. Send request that triggers browser-dependent MCP tool
2. Verify tool call is sent to extension
3. Verify extension executes MCP tool
4. Verify result is sent back to backend

---

### Test 4: Tool Classification

1. Add MCP tool with "screenshot" in description
2. Verify it's classified as extension-side
3. Add MCP tool with "api" in description
4. Verify it's classified as backend-side

---

### Test 5: Hybrid Tool Scenario

1. Send request that uses both:
   - Backend MCP tool (API call)
   - Extension MCP tool (screenshot)
   - Regular extension tool (navigation)
2. Verify all execute correctly
3. Verify results flow properly

---

## 🎯 Phase 7 Completion Checklist

- [ ] MCP tool classification implemented
- [ ] Extension MCP client setup
- [ ] Backend MCP client setup
- [ ] Tool schemas include MCP metadata
- [ ] Backend can execute MCP tools
- [ ] Extension can execute MCP tools
- [ ] Tool routing works correctly
- [ ] All MCP tools execute successfully
- [ ] MCP clients close properly

---

## 🚀 Next Steps

Once Phase 7 is complete:

**→ Proceed to Phase 8: Workflow Support**

This phase will:
- Send workflow ID to backend
- Backend loads workflow-specific prompts
- Backend filters tools based on workflow
- Workflow session management
