# Phase 8: Workflow Support

**Goal**: Enable workflow mode with backend, including custom prompts, tool filtering, and workflow-specific configurations.

**Duration**: 2-3 hours

**Prerequisites**: 
- Phase 7 completed
- MCP integration working
- Understanding of workflow system

---

## 📋 Overview

Workflows are predefined AI behaviors for specific use cases (e.g., "Research Assistant", "Code Helper", "Data Analyzer"). This phase enables workflows to work with the backend.

**Features**:
1. Send workflow ID to backend
2. Backend loads workflow-specific prompts
3. Backend filters tools based on workflow
4. Workflow state management
5. Workflow-specific model preferences

---

## 🎯 Architecture

### Workflow Flow

```
┌───────────────────────────────────────────────────────────┐
│                    Extension                              │
│                                                           │
│  User selects workflow → "Research Assistant"            │
│                    │                                      │
│                    ▼                                      │
│       Send workflow ID in request                         │
│                    │                                      │
└────────────────────┼───────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────────┐
         │      Backend              │
         │                           │
         │  1. Receive workflow ID   │
         │  2. Load workflow config  │
         │  3. Apply custom prompt   │
         │  4. Filter tools          │
         │  5. Set model preference  │
         └───────────────────────────┘
```

---

## 🛠️ Step-by-Step Implementation

### Step 1: Create Workflow Types

**File**: `shared/types/workflow.types.ts`

```typescript
/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools?: string[]; // If undefined, all tools allowed
  preferredModel?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  temperature?: number;
  maxTokens?: number;
  icon?: string;
}

/**
 * Workflow context in chat request
 */
export interface WorkflowContext {
  workflowId: string;
  sessionId?: string;
}
```

Update `shared/types/message.types.ts`:

```typescript
export interface ChatRequest {
  messages: any[];
  modelConfig?: {
    mode: 'backend' | 'byok';
    remoteModel?: 'gemini-2.5-pro' | 'gemini-2.5-flash';
  };
  workflowId?: string; // ← Add this
  workflowContext?: WorkflowContext; // ← Add this
  threadId?: string;
  initialPageContext?: string;
  toolSchemas?: ToolSchemaWithMCP[];
}
```

---

### Step 2: Create Workflow Definitions

**Create file**: `shared/workflows/definitions.ts`

```typescript
import type { WorkflowDefinition } from '../types/workflow.types';

export const WORKFLOW_DEFINITIONS: Record<string, WorkflowDefinition> = {
  'research-assistant': {
    id: 'research-assistant',
    name: 'Research Assistant',
    description: 'Help with research, fact-checking, and information gathering',
    systemPrompt: `You are a research assistant specialized in finding and analyzing information.

Your capabilities:
- Search the web for accurate information
- Verify facts from multiple sources
- Summarize complex topics clearly
- Cite sources properly
- Compare different perspectives

Always:
- Provide citations for claims
- Acknowledge uncertainty when appropriate
- Search multiple sources for verification
- Present balanced viewpoints`,
    allowedTools: [
      'search',
      'navigate_to',
      'get_page_content',
      'scroll',
      'extract_text',
    ],
    preferredModel: 'gemini-2.5-pro',
    temperature: 0.7,
    icon: '🔍',
  },
  
  'code-helper': {
    id: 'code-helper',
    name: 'Code Helper',
    description: 'Assist with coding tasks and development',
    systemPrompt: `You are a coding assistant specialized in software development.

Your capabilities:
- Analyze code and suggest improvements
- Debug issues and explain errors
- Write code snippets and examples
- Review code for best practices
- Explain programming concepts

Always:
- Write clean, well-documented code
- Follow language-specific conventions
- Explain your reasoning
- Consider edge cases
- Suggest alternative approaches`,
    allowedTools: [
      'search',
      'navigate_to',
      'get_page_content',
      'click',
      'keyboard_type',
      'extract_code',
    ],
    preferredModel: 'gemini-2.5-pro',
    temperature: 0.5,
    icon: '💻',
  },
  
  'quick-tasks': {
    id: 'quick-tasks',
    name: 'Quick Tasks',
    description: 'Fast responses for simple tasks',
    systemPrompt: `You are a quick task assistant focused on efficiency.

Your capabilities:
- Answer questions concisely
- Perform simple web actions
- Extract information quickly
- Navigate websites efficiently

Always:
- Be concise and direct
- Complete tasks quickly
- Use minimal tool calls
- Focus on the specific request`,
    allowedTools: [
      'search',
      'navigate_to',
      'click',
      'scroll',
      'get_page_content',
    ],
    preferredModel: 'gemini-2.5-flash',
    temperature: 0.7,
    icon: '⚡',
  },
  
  'data-analyzer': {
    id: 'data-analyzer',
    name: 'Data Analyzer',
    description: 'Analyze and visualize data from websites',
    systemPrompt: `You are a data analysis assistant.

Your capabilities:
- Extract data from web pages
- Analyze patterns and trends
- Compare data points
- Generate insights
- Create summaries

Always:
- Verify data accuracy
- Look for patterns
- Provide context for numbers
- Compare multiple sources
- Explain your analysis`,
    allowedTools: [
      'search',
      'navigate_to',
      'get_page_content',
      'extract_text',
      'scroll',
      'wait_for',
    ],
    preferredModel: 'gemini-2.5-pro',
    temperature: 0.6,
    icon: '📊',
  },
  
  'general': {
    id: 'general',
    name: 'General Assistant',
    description: 'General-purpose AI assistant',
    systemPrompt: `You are a helpful AI assistant with access to web browsing capabilities.

You can:
- Search the web
- Navigate websites
- Extract information
- Interact with web pages
- Help with various tasks

Always be helpful, accurate, and respectful.`,
    // No tool restrictions
    allowedTools: undefined,
    preferredModel: 'gemini-2.5-flash',
    temperature: 0.7,
    icon: '🤖',
  },
};

export function getWorkflowDefinition(workflowId: string): WorkflowDefinition | undefined {
  return WORKFLOW_DEFINITIONS[workflowId];
}

export function getAllWorkflows(): WorkflowDefinition[] {
  return Object.values(WORKFLOW_DEFINITIONS);
}
```

---

### Step 3: Backend Workflow Module

**Create file**: `backend/src/workflows/workflows.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';

@Module({
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
```

**Create file**: `backend/src/workflows/workflows.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { WorkflowDefinition, getWorkflowDefinition, getAllWorkflows } from '@shared/workflows/definitions';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);
  
  /**
   * Get workflow definition by ID
   */
  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    const workflow = getWorkflowDefinition(workflowId);
    
    if (!workflow) {
      this.logger.warn(`Workflow not found: ${workflowId}`);
      return undefined;
    }
    
    this.logger.log(`Loaded workflow: ${workflow.name}`);
    return workflow;
  }
  
  /**
   * Get all available workflows
   */
  getAllWorkflows(): WorkflowDefinition[] {
    return getAllWorkflows();
  }
  
  /**
   * Filter tools based on workflow
   */
  filterToolsForWorkflow(
    workflow: WorkflowDefinition,
    tools: Record<string, any>
  ): Record<string, any> {
    // If workflow doesn't restrict tools, return all
    if (!workflow.allowedTools || workflow.allowedTools.length === 0) {
      this.logger.log(`Workflow ${workflow.id}: using all tools`);
      return tools;
    }
    
    // Filter to only allowed tools
    const filtered: Record<string, any> = {};
    const allowedSet = new Set(workflow.allowedTools);
    
    for (const [name, tool] of Object.entries(tools)) {
      if (allowedSet.has(name)) {
        filtered[name] = tool;
      }
    }
    
    this.logger.log(
      `Workflow ${workflow.id}: filtered ${Object.keys(tools).length} → ${Object.keys(filtered).length} tools`
    );
    
    return filtered;
  }
  
  /**
   * Get workflow-specific model preference
   */
  getPreferredModel(workflow: WorkflowDefinition): string {
    return workflow.preferredModel || 'gemini-2.5-flash';
  }
  
  /**
   * Get workflow-specific temperature
   */
  getTemperature(workflow: WorkflowDefinition): number {
    return workflow.temperature ?? 0.7;
  }
  
  /**
   * Get workflow-specific max tokens
   */
  getMaxTokens(workflow: WorkflowDefinition): number {
    return workflow.maxTokens ?? 4000;
  }
}
```

---

### Step 4: Update Backend Chat Service

**File**: `backend/src/chat/chat.service.ts`

Integrate workflows:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { google } from '@ai-sdk/google';
import { streamText, convertToModelMessages } from 'ai';
import { ToolsService } from '../tools/tools.service';
import { MCPService } from '../mcp/mcp.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { ChatRequest } from '@shared/types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly toolsService: ToolsService,
    private readonly mcpService: MCPService,
    private readonly workflowsService: WorkflowsService,
  ) {}

  async chat(extensionId: string, request: ChatRequest) {
    // Load workflow if specified
    const workflow = request.workflowId
      ? this.workflowsService.getWorkflow(request.workflowId)
      : undefined;
    
    // Get model (workflow preference or request preference)
    const modelType = workflow?.preferredModel 
      || request.modelConfig?.remoteModel 
      || 'gemini-2.5-flash';
      
    const model = this.getModel(modelType);
    
    // Get tools
    const extensionSchemas = request.toolSchemas || [];
    let tools = await this.mcpService.mergeWithExtensionTools(extensionSchemas);
    
    // Filter tools based on workflow
    if (workflow) {
      tools = this.workflowsService.filterToolsForWorkflow(workflow, tools);
    }
    
    // Get system prompt
    const systemPrompt = workflow 
      ? workflow.systemPrompt 
      : this.getDefaultSystemPrompt();
    
    // Get workflow-specific parameters
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
    
    const result = streamText({
      model,
      messages: convertToModelMessages(request.messages),
      tools,
      system: systemPrompt,
      temperature,
      maxTokens,
    });

    return result;
  }
  
  private getModel(modelType: string) {
    const modelName = this.getModelName(modelType);
    
    return google(modelName, {
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  
  private getModelName(modelType: string): string {
    const modelMap: Record<string, string> = {
      'gemini-2.5-flash': 'gemini-2.0-flash-exp',
      'gemini-2.5-pro': 'gemini-2.0-pro-exp',
    };
    
    return modelMap[modelType] || modelMap['gemini-2.5-flash'];
  }
  
  private getDefaultSystemPrompt(): string {
    return 'You are a helpful AI assistant integrated into a Chrome extension.';
  }
}
```

---

### Step 5: Extension Workflow Selector

**Create file**: `src/components/features/chat/components/WorkflowSelector.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { getAllWorkflows, getWorkflowDefinition } from '@shared/workflows/definitions';
import type { WorkflowDefinition } from '@shared/types/workflow.types';
import './WorkflowSelector.css';

interface WorkflowSelectorProps {
  currentWorkflowId?: string;
  onWorkflowChange: (workflowId: string) => void;
}

export const WorkflowSelector: React.FC<WorkflowSelectorProps> = ({
  currentWorkflowId = 'general',
  onWorkflowChange,
}) => {
  const [workflows] = useState<WorkflowDefinition[]>(getAllWorkflows());
  const [selected, setSelected] = useState(currentWorkflowId);

  const handleChange = (workflowId: string) => {
    setSelected(workflowId);
    onWorkflowChange(workflowId);
  };

  return (
    <div className="workflow-selector">
      <label className="workflow-selector-label">Workflow</label>
      
      <div className="workflow-selector-grid">
        {workflows.map((workflow) => (
          <button
            key={workflow.id}
            className={`workflow-selector-card ${
              selected === workflow.id ? 'selected' : ''
            }`}
            onClick={() => handleChange(workflow.id)}
          >
            <div className="workflow-selector-icon">{workflow.icon}</div>
            <div className="workflow-selector-name">{workflow.name}</div>
            <div className="workflow-selector-description">
              {workflow.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
```

---

### Step 6: Update Extension AI Logic

**File**: `src/ai/core/aiLogic.ts`

Include workflow in requests:

```typescript
async function handleBackendMode(
  messages: UIMessage[],
  options: any,
  depth: number = 0,
  workflowId?: string
) {
  // ... existing code ...
  
  const stream = await transport.sendMessages({
    messages,
    toolSchemas,
    modelConfig: {
      mode: 'backend',
      remoteModel: modelConfig.remoteModel,
    },
    workflowId, // ← Add workflow ID
  });
  
  // ... rest of implementation ...
}
```

---

### Step 7: Add Workflow to Chat Context

**File**: `src/contexts/ChatContext.tsx`

```typescript
interface ChatContextValue {
  // ... existing properties ...
  workflowId?: string;
  setWorkflowId: (id: string) => void;
}

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workflowId, setWorkflowId] = useState<string>('general');
  
  // ... existing code ...
  
  // Include workflow in AI calls
  const sendMessage = async (message: string) => {
    await handleChat(messages, {
      workflowId,
      // ... other options ...
    });
  };
  
  return (
    <ChatContext.Provider
      value={{
        // ... existing values ...
        workflowId,
        setWorkflowId,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
```

---

## ✅ Testing Phase 8

### Test 1: Workflow Selection

1. Open extension
2. Select "Research Assistant" workflow
3. Send message: "Research the history of AI"
4. Verify:
   - Backend receives workflow ID
   - Research-specific prompt is used
   - Only allowed tools are available
   - Response follows research assistant style

---

### Test 2: Tool Filtering

1. Select "Quick Tasks" workflow (limited tools)
2. Try to trigger a tool not in allowed list
3. Verify model doesn't try to use that tool
4. Switch to "General" workflow (all tools)
5. Verify all tools are available again

---

### Test 3: Model Preference

1. Select "Research Assistant" (prefers Pro)
2. Check backend logs
3. Verify Pro model is used
4. Select "Quick Tasks" (prefers Flash)
5. Verify Flash model is used

---

### Test 4: Custom Prompts

1. Select different workflows
2. Compare response styles
3. Verify each workflow maintains its personality:
   - Research Assistant: cites sources, thorough
   - Code Helper: technical, provides examples
   - Quick Tasks: concise, efficient

---

### Test 5: Workflow Persistence

1. Select workflow
2. Reload extension
3. Verify workflow selection persists
4. Send message
5. Verify workflow is still active

---

## 🎯 Phase 8 Completion Checklist

- [ ] Workflow definitions created
- [ ] Backend workflow service implemented
- [ ] Tool filtering based on workflow
- [ ] Custom prompts per workflow
- [ ] Model preferences per workflow
- [ ] Workflow selector UI
- [ ] Workflow ID sent in requests
- [ ] All workflows tested
- [ ] Workflow persistence works

---

## 🚀 Next Steps

Once Phase 8 is complete:

**→ Proceed to Phase 9: Production Hardening**

This phase will:
- Comprehensive error handling
- Retry logic for failed requests
- Request/response logging
- Performance optimization
- Health monitoring
- Graceful degradation
