# Phase 6: Model Selection

**Goal**: Support Gemini 2.5 Pro and Flash model selection with intelligent routing and cost optimization.

**Duration**: 2 hours

**Prerequisites**: 
- Phase 5 completed
- Tool execution working correctly
- Backend handling requests successfully

---

## 📋 Overview

Add the ability for users to choose between different Gemini models:

- **Gemini 2.5 Flash**: Fast, cost-effective for simple tasks
- **Gemini 2.5 Pro**: More capable, better for complex reasoning

**Features**:
1. Model selector UI in extension
2. Model preference persistence
3. Backend model routing
4. Optional: Auto-select based on complexity (cost optimization)

---

## 🎯 Architecture

### Flow

```
┌─────────────────────────────────────────────────────────┐
│               Extension UI                              │
│                                                         │
│  ┌─────────────────────────────────────┐              │
│  │   Model Selector Dropdown           │              │
│  │   • Gemini 2.5 Flash (Default)      │              │
│  │   • Gemini 2.5 Pro                  │              │
│  └─────────────────────────────────────┘              │
│                     │                                   │
│                     ▼                                   │
│         Save to chrome.storage.local                    │
│                     │                                   │
└─────────────────────┼───────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────┐
        │     Backend API Request         │
        │  { model: 'gemini-2.5-pro' }    │
        └─────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────┐
        │   Backend Model Router          │
        │   - Load correct model          │
        │   - Apply model-specific config │
        └─────────────────────────────────┘
```

---

## 🛠️ Step-by-Step Implementation

### Step 1: Update Shared Types

**File**: `shared/types/ai-mode.types.ts`

Already defined in Phase 1, verify it includes:

```typescript
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
```

---

### Step 2: Create Model Selector Component

**Create file**: `src/components/shared/model-selector/ModelSelector.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { getModelConfig, setModelConfig } from '../../../utils/modelSettings';
import type { RemoteModelType } from '../../../ai/types/types';
import './ModelSelector.css';

interface ModelSelectorProps {
  onModelChange?: (model: RemoteModelType) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ 
  onModelChange, 
  disabled = false 
}) => {
  const [selectedModel, setSelectedModel] = useState<RemoteModelType>('gemini-2.5-flash');
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    loadCurrentModel();
  }, []);

  const loadCurrentModel = async () => {
    const config = await getModelConfig();
    setSelectedModel(config.remoteModel);
  };

  const handleModelChange = async (model: RemoteModelType) => {
    if (isChanging || disabled) return;
    
    setIsChanging(true);
    try {
      const config = await getModelConfig();
      await setModelConfig({
        ...config,
        remoteModel: model,
      });
      
      setSelectedModel(model);
      onModelChange?.(model);
      
      console.log('✓ Model changed to:', model);
    } catch (error) {
      console.error('Failed to change model:', error);
    } finally {
      setIsChanging(false);
    }
  };

  const models: { value: RemoteModelType; label: string; description: string }[] = [
    {
      value: 'gemini-2.5-flash',
      label: 'Flash ⚡',
      description: 'Fast and efficient for most tasks',
    },
    {
      value: 'gemini-2.5-pro',
      label: 'Pro 🚀',
      description: 'Advanced reasoning for complex tasks',
    },
  ];

  return (
    <div className="model-selector">
      <label className="model-selector-label">
        Model
      </label>
      
      <div className="model-selector-options">
        {models.map((model) => (
          <button
            key={model.value}
            className={`model-selector-option ${
              selectedModel === model.value ? 'selected' : ''
            } ${disabled || isChanging ? 'disabled' : ''}`}
            onClick={() => handleModelChange(model.value)}
            disabled={disabled || isChanging}
          >
            <div className="model-selector-option-label">
              {model.label}
            </div>
            <div className="model-selector-option-description">
              {model.description}
            </div>
          </button>
        ))}
      </div>
      
      {isChanging && (
        <div className="model-selector-loading">
          Changing model...
        </div>
      )}
    </div>
  );
};
```

---

### Step 3: Create Model Selector Styles

**Create file**: `src/components/shared/model-selector/ModelSelector.css`

```css
.model-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.model-selector-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.model-selector-options {
  display: flex;
  gap: 0.5rem;
}

.model-selector-option {
  flex: 1;
  padding: 0.75rem;
  border-radius: 6px;
  border: 2px solid var(--border-color);
  background-color: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.model-selector-option:hover:not(.disabled) {
  border-color: #4a6fa5;
  background-color: rgba(74, 111, 165, 0.05);
}

.model-selector-option.selected {
  border-color: #4a6fa5;
  background-color: rgba(74, 111, 165, 0.1);
}

.model-selector-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.model-selector-option-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.model-selector-option-description {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.3;
}

.model-selector-loading {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-align: center;
  padding: 0.25rem;
}
```

---

### Step 4: Add Model Selector to Chat Header

**File**: `src/components/features/chat/components/ChatHeader.tsx`

Add the model selector to the header:

```typescript
import React, { useState } from 'react';
import { ModelSelector } from '../../../shared/model-selector/ModelSelector';
// ... other imports ...

export const ChatHeader: React.FC<ChatHeaderProps> = ({ ... }) => {
  const [showModelSelector, setShowModelSelector] = useState(false);
  
  // ... existing code ...
  
  return (
    <div className="copilot-header">
      {/* ... existing header content ... */}
      
      {/* Add model selector button to menu */}
      <div className="copilot-header-menu">
        {showHeaderMenu && (
          <div className="copilot-header-menu-items">
            {/* ... existing menu items ... */}
            
            <button
              className="copilot-header-menu-item"
              onClick={() => {
                setShowHeaderMenu(false);
                setShowModelSelector(true);
              }}
            >
              Select Model
            </button>
            
            {/* ... other menu items ... */}
          </div>
        )}
      </div>
      
      {/* Model selector dialog */}
      {showModelSelector && (
        <div className="model-selector-dialog">
          <div className="model-selector-dialog-header">
            <h3>Choose AI Model</h3>
            <button onClick={() => setShowModelSelector(false)}>×</button>
          </div>
          
          <ModelSelector 
            onModelChange={(model) => {
              console.log('Model changed to:', model);
              setShowModelSelector(false);
            }}
          />
          
          <div className="model-selector-dialog-footer">
            <p className="model-selector-info">
              💡 Flash is faster and cheaper for most tasks. 
              Use Pro for complex reasoning and analysis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
```

---

### Step 5: Update Backend Chat Service

**File**: `backend/src/chat/chat.service.ts`

Add model routing logic:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { google } from '@ai-sdk/google';
import { streamText, convertToModelMessages } from 'ai';
import { ToolsService } from '../tools/tools.service';
import { ChatRequest, RemoteModelType } from '@shared/types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly toolsService: ToolsService) {}

  async chat(extensionId: string, request: ChatRequest) {
    // Get model from request, default to Flash
    const modelType = request.modelConfig?.remoteModel || 'gemini-2.5-flash';
    const model = this.getModel(modelType);
    
    const tools = this.toolsService.getToolsForAI(extensionId);
    
    this.logger.log(`Starting chat with model: ${modelType}, tools: ${Object.keys(tools).length}`);
    
    const result = streamText({
      model,
      messages: convertToModelMessages(request.messages),
      tools,
      system: this.getSystemPrompt(request),
      
      // Model-specific configurations
      ...this.getModelConfig(modelType),
    });

    return result;
  }

  private getModel(modelType: RemoteModelType) {
    const modelName = this.getModelName(modelType);
    
    this.logger.log(`Initializing model: ${modelName}`);
    
    return google(modelName, {
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  private getModelName(modelType: RemoteModelType): string {
    const modelMap: Record<RemoteModelType, string> = {
      'gemini-2.5-flash': 'gemini-2.0-flash-exp',
      'gemini-2.5-pro': 'gemini-2.0-pro-exp',
    };
    
    return modelMap[modelType] || modelMap['gemini-2.5-flash'];
  }

  private getModelConfig(modelType: RemoteModelType) {
    // Model-specific configurations
    const configs = {
      'gemini-2.5-flash': {
        temperature: 0.7,
        maxTokens: 4000,
        topP: 0.9,
      },
      'gemini-2.5-pro': {
        temperature: 0.8,
        maxTokens: 8000,
        topP: 0.95,
      },
    };
    
    return configs[modelType] || configs['gemini-2.5-flash'];
  }

  private getSystemPrompt(request: ChatRequest): string {
    let prompt = 'You are a helpful AI assistant integrated into a Chrome extension.';
    
    if (request.workflowId) {
      prompt += '\n\n' + this.getWorkflowPrompt(request.workflowId);
    }
    
    return prompt;
  }

  private getWorkflowPrompt(workflowId: string): string {
    // Placeholder for Phase 8
    return '';
  }
}
```

---

### Step 6: Update Extension AI Logic

**File**: `src/ai/core/aiLogic.ts`

Ensure model configuration is sent to backend:

```typescript
async function handleBackendMode(
  messages: UIMessage[],
  options: any,
  depth: number = 0
) {
  // ... existing code ...
  
  const modelConfig = await getModelConfig();
  const toolSchemas = await getToolSchemas();
  
  log.info(`🔄 Backend mode: ${modelConfig.remoteModel}`);
  
  const transport = new DefaultChatTransport({
    api: 'http://localhost:3000/api/chat',
    headers: {
      'X-Extension-ID': chrome.runtime.id,
      'X-Extension-Version': chrome.runtime.getManifest().version,
    },
  });
  
  const stream = await transport.sendMessages({
    messages,
    toolSchemas,
    // Include model configuration
    modelConfig: {
      mode: 'backend',
      remoteModel: modelConfig.remoteModel,
    },
  });
  
  // ... rest of implementation ...
}
```

---

### Step 7: Add Model Info to Chat UI (Optional)

**File**: `src/components/features/chat/components/ChatMessage.tsx`

Show which model was used for each response:

```typescript
export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  // ... existing code ...
  
  return (
    <div className={`chat-message ${message.role}`}>
      {/* ... existing content ... */}
      
      {message.role === 'assistant' && message.metadata?.model && (
        <div className="chat-message-model-badge">
          {getModelBadge(message.metadata.model)}
        </div>
      )}
    </div>
  );
};

function getModelBadge(model: string): string {
  if (model.includes('flash')) return '⚡ Flash';
  if (model.includes('pro')) return '🚀 Pro';
  return model;
}
```

---

### Step 8: Optional - Auto Model Selection

**Create file**: `src/ai/utils/modelSelector.ts`

Automatically choose model based on complexity:

```typescript
import type { UIMessage, RemoteModelType } from 'ai';

/**
 * Analyze prompt complexity and suggest optimal model
 */
export function suggestModel(messages: UIMessage[]): RemoteModelType {
  const lastMessage = messages[messages.length - 1];
  
  if (!lastMessage || lastMessage.role !== 'user') {
    return 'gemini-2.5-flash';
  }
  
  const text = lastMessage.content.toString().toLowerCase();
  
  // Indicators of complex tasks
  const complexityIndicators = [
    'analyze',
    'compare',
    'explain why',
    'reasoning',
    'complex',
    'detailed analysis',
    'deep dive',
    'comprehensive',
    'multiple steps',
    'strategy',
    'plan',
    'architecture',
  ];
  
  const hasComplexity = complexityIndicators.some(indicator => 
    text.includes(indicator)
  );
  
  // Long prompts might need Pro
  const isLongPrompt = text.length > 500;
  
  // Multiple tool uses might need Pro
  const hasMultipleTools = messages.filter(m => 
    m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 2
  ).length > 0;
  
  if (hasComplexity || isLongPrompt || hasMultipleTools) {
    return 'gemini-2.5-pro';
  }
  
  return 'gemini-2.5-flash';
}
```

Then use it in `aiLogic.ts`:

```typescript
// Optional: Auto-select model based on complexity
if (modelConfig.autoSelectModel) {
  const suggestedModel = suggestModel(messages);
  if (suggestedModel !== modelConfig.remoteModel) {
    log.info(`💡 Suggesting ${suggestedModel} for this task`);
    // Could show UI prompt or auto-switch
  }
}
```

---

## ✅ Testing Phase 6

### Test 1: Model Selection UI

1. Open extension
2. Click menu → "Select Model"
3. Verify model selector dialog appears
4. Switch between Flash and Pro
5. Verify:
   - Selection persists after reload
   - UI shows current selection
   - No errors in console

---

### Test 2: Backend Model Routing

1. Select "Flash" model
2. Send a message
3. Check backend logs: should show `gemini-2.5-flash`
4. Select "Pro" model
5. Send another message
6. Check backend logs: should show `gemini-2.5-pro`

**Expected backend logs:**
```
Starting chat with model: gemini-2.5-flash, tools: 15
Initializing model: gemini-2.0-flash-exp

Starting chat with model: gemini-2.5-pro, tools: 15
Initializing model: gemini-2.0-pro-exp
```

---

### Test 3: Model Performance

1. **Flash Test**: Send simple question: "What is 2+2?"
   - Should respond very quickly
   
2. **Pro Test**: Send complex question: "Analyze the pros and cons of using microservices vs monolithic architecture"
   - Should provide more detailed, nuanced response

---

### Test 4: Model Persistence

1. Select "Pro" model
2. Reload extension
3. Verify "Pro" is still selected
4. Send message
5. Verify Pro model is used

---

### Test 5: Cost Comparison (Optional)

Track token usage and costs:

```typescript
// In chat.service.ts
const result = await streamText({
  // ... config ...
  onFinish: async ({ usage }) => {
    this.logger.log(`Token usage: ${JSON.stringify(usage)}`);
    
    // Calculate approximate cost
    const cost = this.calculateCost(modelType, usage);
    this.logger.log(`Estimated cost: $${cost.toFixed(6)}`);
  },
});

private calculateCost(model: RemoteModelType, usage: any): number {
  // Approximate costs (update with actual pricing)
  const costs = {
    'gemini-2.5-flash': {
      input: 0.00001, // per 1K tokens
      output: 0.00003,
    },
    'gemini-2.5-pro': {
      input: 0.00005,
      output: 0.00015,
    },
  };
  
  const modelCost = costs[model];
  const inputCost = (usage.promptTokens / 1000) * modelCost.input;
  const outputCost = (usage.completionTokens / 1000) * modelCost.output;
  
  return inputCost + outputCost;
}
```

---

## 📝 Common Issues

### Model Not Changing

**Problem**: Backend still uses old model
**Solution**: 
- Check `modelConfig` is included in request body
- Verify `getModel()` function receives correct parameter
- Check backend logs for model initialization

### UI Not Updating

**Problem**: Model selector doesn't reflect current model
**Solution**:
- Check `loadCurrentModel()` is called on mount
- Verify `chrome.storage.local` is saving correctly
- Check for state update issues

### Wrong Model Used

**Problem**: Wrong model is called despite selection
**Solution**:
- Verify model name mapping in `getModelName()`
- Check Gemini API model IDs are correct
- Ensure environment variable `GEMINI_API_KEY` is set

---

## 🎯 Phase 6 Completion Checklist

- [ ] Model selector UI component created
- [ ] Model selector integrated into chat header
- [ ] Model preference persists across reloads
- [ ] Backend routes to correct model
- [ ] Model-specific configurations applied
- [ ] Both Flash and Pro models work correctly
- [ ] UI shows current model selection
- [ ] Optional: Auto model selection implemented
- [ ] All tests pass

---

## 🚀 Next Steps

Once Phase 6 is complete:

**→ Proceed to Phase 7: MCP Integration**

This phase will:
- Separate MCP tools from extension tools
- Backend-side MCP execution for API tools
- Extension-side MCP execution for browser tools
- Sync MCP tool schemas to backend
