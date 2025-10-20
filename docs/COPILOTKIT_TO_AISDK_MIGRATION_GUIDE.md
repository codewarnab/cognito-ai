# CopilotKit to AI SDK v5 Migration Guide

This guide provides a comprehensive step-by-step process for migrating tools from CopilotKit to AI SDK v5, based on the migration patterns used in this project.

## Table of Contents
1. [Overview](#overview)
2. [Key Differences](#key-differences)
3. [Migration Steps](#migration-steps)
4. [Code Comparison](#code-comparison)
5. [Common Patterns](#common-patterns)
6. [Troubleshooting](#troubleshooting)

---

## Overview

AI SDK v5 (by Vercel) provides a more flexible and standardized approach to tool definition and execution compared to CopilotKit. This migration involves:
- Changing from `useFrontendTool` to custom `registerTool` utility
- Using Zod schemas for parameter validation
- Implementing separate UI rendering system
- Following React hooks pattern for tool registration

---

## Key Differences

### CopilotKit Pattern
```tsx
useFrontendTool({
    name: "toolName",
    description: "Tool description",
    parameters: [
        {
            name: "param1",
            type: "string",
            description: "Parameter description",
            required: true
        }
    ],
    handler: async ({ param1 }) => {
        // Tool logic
        return { result: "..." };
    },
    render: ({ status, result, args }) => {
        // UI rendering
        return <Component />;
    }
});
```

### AI SDK v5 Pattern
```tsx
// Tool registration
registerTool({
    name: 'toolName',
    description: 'Tool description',
    parameters: z.object({
        param1: z.string().describe('Parameter description'),
    }),
    execute: async ({ param1 }) => {
        // Tool logic
        return { result: "..." };
    },
});

// UI rendering (separate)
registerToolUI('toolName', (state: ToolUIState) => {
    // UI rendering based on state
    return <Component />;
});
```

---

## Migration Steps

### Step 1: Update Imports

**Before (CopilotKit):**
```tsx
import { useFrontendTool } from "@copilotkit/react-core";
```

**After (AI SDK v5):**
```tsx
import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { ToolCard } from '../../components/ui/ToolCard';
import type { ToolUIState } from '../../ai/ToolUIContext';
```

### Step 2: Convert Tool Hook Function

**Before:**
```tsx
export function useMyTool() {
    useFrontendTool({
        // configuration
    });
}
```

**After:**
```tsx
export function useMyTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        // Tool registration logic
        
        return () => {
            // Cleanup
            unregisterToolUI('toolName');
        };
    }, []);
}
```

### Step 3: Convert Parameters to Zod Schema

**Before:**
```tsx
parameters: [
    {
        name: "url",
        type: "string",
        description: "The URL to open",
        required: true
    },
    {
        name: "newTab",
        type: "boolean",
        description: "If true, opens URL in a new tab",
        required: false
    }
]
```

**After:**
```tsx
parameters: z.object({
    url: z.string().describe('The URL to open'),
    newTab: z.boolean()
        .describe('If true, opens URL in a new tab. Defaults to true.')
        .default(true),
})
```

#### Parameter Type Conversions:
- `"string"` → `z.string()`
- `"number"` → `z.number()`
- `"boolean"` → `z.boolean()`
- `"object"` → `z.object({ ... })`
- `"array"` → `z.array(z.string())` (specify element type)
- For optional parameters: add `.optional()` or `.default(value)`

### Step 4: Convert Handler to Execute Function

**Before:**
```tsx
handler: async ({ param1, param2 }) => {
    try {
        // Logic here
        return { success: true, data: result };
    } catch (error) {
        return { error: "Error message", details: String(error) };
    }
}
```

**After:**
```tsx
execute: async ({ param1, param2 }) => {
    try {
        log.info("TOOL CALL: toolName", { param1, param2 });
        
        // Logic here
        
        log.info('✅ Tool completed', { result });
        return { success: true, data: result };
    } catch (error) {
        log.error('[Tool] Error in toolName:', error);
        return { error: "Error message", details: String(error) };
    }
}
```

**Key Changes:**
- Rename `handler` to `execute`
- Add logging at start and end
- Same async/await pattern
- Same return format

### Step 5: Convert Render to UI Registration

**Before:**
```tsx
render: ({ status, result, args }) => {
    if (status === "inProgress") {
        return <ToolCard title="Loading..." state="loading" />;
    }
    if (status === "complete" && result) {
        if (result.error) {
            return <ToolCard title="Error" subtitle={result.error} state="error" />;
        }
        return <ToolCard title="Success" state="success" />;
    }
    return null;
}
```

**After:**
```tsx
registerToolUI('toolName', (state: ToolUIState) => {
    const { state: toolState, input, output } = state;

    if (toolState === 'input-streaming' || toolState === 'input-available') {
        return (
            <ToolCard 
                title="Loading..." 
                subtitle={`Processing: ${input?.param1}`}
                state="loading" 
                icon="🔧" 
            />
        );
    }
    
    if (toolState === 'output-available' && output) {
        if (output.error) {
            return (
                <ToolCard 
                    title="Error" 
                    subtitle={output.error} 
                    state="error" 
                    icon="🔧" 
                />
            );
        }
        return (
            <ToolCard 
                title="Success" 
                subtitle={output.message}
                state="success" 
                icon="🔧" 
            />
        );
    }
    
    if (toolState === 'output-error') {
        return (
            <ToolCard 
                title="Failed" 
                subtitle={state.errorText} 
                state="error" 
                icon="🔧" 
            />
        );
    }
    
    return null;
});
```

**State Mapping:**
- `status === "inProgress"` → `toolState === 'input-streaming' || toolState === 'input-available'`
- `status === "complete"` → `toolState === 'output-available'`
- Error state → `toolState === 'output-error'`
- `args` → `input`
- `result` → `output`

---

## Code Comparison

### Complete Example: Opening a Tab

#### CopilotKit Version
```tsx
export function useOpenTabTool() {
    useFrontendTool({
        name: "openTab",
        description: "Open a URL in a new tab",
        parameters: [
            {
                name: "url",
                type: "string",
                description: "The URL to open",
                required: true
            }
        ],
        handler: async ({ url }) => {
            try {
                const tab = await chrome.tabs.create({ url });
                return { success: true, tabId: tab.id };
            } catch (error) {
                return { error: "Failed to open tab" };
            }
        },
        render: ({ status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Opening Tab" state="loading" />;
            }
            if (status === "complete" && result?.success) {
                return <ToolCard title="Opened Tab" state="success" />;
            }
            return null;
        },
    });
}
```

#### AI SDK v5 Version
```tsx
export function useOpenTabTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering openTab tool...');
        
        registerTool({
            name: 'openTab',
            description: 'Open a URL in a new tab',
            parameters: z.object({
                url: z.string().describe('The URL to open'),
            }),
            execute: async ({ url }) => {
                try {
                    log.info("TOOL CALL: openTab", { url });
                    const tab = await chrome.tabs.create({ url });
                    log.info('📑 Opened tab', { tabId: tab.id });
                    return { success: true, tabId: tab.id };
                } catch (error) {
                    log.error('[Tool] Error:', error);
                    return { error: "Failed to open tab" };
                }
            },
        });

        registerToolUI('openTab', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <ToolCard 
                        title="Opening Tab" 
                        subtitle={input?.url}
                        state="loading" 
                        icon="🌐" 
                    />
                );
            }
            
            if (toolState === 'output-available' && output?.success) {
                return (
                    <ToolCard 
                        title="Opened Tab" 
                        subtitle={output.url}
                        state="success" 
                        icon="🌐" 
                    />
                );
            }
            
            if (toolState === 'output-error') {
                return (
                    <ToolCard 
                        title="Failed" 
                        subtitle={state.errorText} 
                        state="error" 
                        icon="🌐" 
                    />
                );
            }
            
            return null;
        });

        log.info('✅ openTab tool registration complete');

        return () => {
            log.info('🧹 Cleaning up openTab tool');
            unregisterToolUI('openTab');
        };
    }, []);
}
```

---

## Common Patterns

### 1. Tool with Optional Parameters

```tsx
parameters: z.object({
    required: z.string().describe('This parameter is required'),
    optional: z.string().optional().describe('This parameter is optional'),
    withDefault: z.number().default(5).describe('This has a default value'),
})
```

### 2. Tool with Complex Objects

```tsx
parameters: z.object({
    config: z.object({
        name: z.string(),
        value: z.number(),
        enabled: z.boolean(),
    }).describe('Configuration object'),
})
```

### 3. Tool with Arrays

```tsx
parameters: z.object({
    items: z.array(z.string()).describe('List of items'),
    numbers: z.array(z.number()).describe('List of numbers'),
})
```

### 4. Tool with Enums

```tsx
parameters: z.object({
    mode: z.enum(['fast', 'normal', 'thorough'])
        .describe('Processing mode')
        .default('normal'),
})
```

### 5. Conditional Rendering in UI

```tsx
registerToolUI('toolName', (state: ToolUIState) => {
    const { state: toolState, input, output } = state;

    // Show loading state with progress
    if (toolState === 'input-streaming' || toolState === 'input-available') {
        return (
            <ToolCard 
                title="Processing" 
                subtitle={`Step ${input?.step || 1}`}
                state="loading" 
                icon="⚙️"
            >
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                    Working on: {input?.description}
                </div>
            </ToolCard>
        );
    }
    
    // Show success with details
    if (toolState === 'output-available' && output) {
        if (output.error) {
            return <ToolCard title="Error" subtitle={output.error} state="error" icon="❌" />;
        }
        
        return (
            <ToolCard 
                title="Completed" 
                subtitle={output.summary}
                state="success" 
                icon="✅"
            >
                {output.details && (
                    <div style={{ fontSize: '12px', marginTop: '8px' }}>
                        {output.details.map((item, idx) => (
                            <div key={idx}>{item}</div>
                        ))}
                    </div>
                )}
            </ToolCard>
        );
    }
    
    // Show error
    if (toolState === 'output-error') {
        return <ToolCard title="Failed" subtitle={state.errorText} state="error" icon="❌" />;
    }
    
    return null;
});
```

### 6. Tool with Chrome API Integration

```tsx
execute: async ({ tabId, action }) => {
    try {
        log.info("TOOL CALL: chromeAction", { tabId, action });
        
        // Check API availability
        if (!chrome.tabs) {
            return { error: "Chrome Tabs API not available" };
        }
        
        // Execute Chrome API call
        const result = await chrome.tabs.update(tabId, { active: true });
        
        log.info('✅ Chrome action completed', { result });
        return { success: true, result };
    } catch (error) {
        log.error('[Tool] Chrome API error:', error);
        return { error: "Chrome API call failed", details: String(error) };
    }
}
```


## Migration Checklist

Use this checklist when migrating each tool:

- [ ] Update imports (add `z`, `useEffect`, `registerTool`, `useToolUI`, etc.)
- [ ] Create `useEffect` wrapper with cleanup
- [ ] Convert `useFrontendTool` to `registerTool`
- [ ] Convert parameter array to Zod schema
- [ ] Rename `handler` to `execute`
- [ ] Add logging to execute function
- [ ] Convert `render` to `registerToolUI`
- [ ] Update state checks (`status` → `toolState`)
- [ ] Update data access (`args` → `input`, `result` → `output`)
- [ ] Add cleanup function with `unregisterToolUI`
- [ ] Test tool registration (check console logs)
- [ ] Test tool execution (check behavior)
- [ ] Test UI rendering (all states: loading, success, error)
- [ ] Update tool imports in parent component

---

## Best Practices

1. **Always add logging**: Use the logger for debugging tool execution
2. **Use descriptive icons**: Add relevant emoji icons to ToolCard for visual clarity
3. **Handle all states**: Implement UI for all possible tool states
4. **Provide feedback**: Show progress and results in the UI
5. **Error handling**: Always catch and return errors gracefully
6. **Type safety**: Use TypeScript types for input/output
7. **Cleanup properly**: Always unregister UI in useEffect cleanup
8. **One registration per mount**: Use empty dependency array in useEffect
9. **Consistent naming**: Keep tool names consistent across registration and UI

---

