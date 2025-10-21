# MCP Tool Icon Mapping Implementation Plan

## Problem Statement
Currently, when MCP tools are rendered in the chat UI, they all use the generic `ChromeIcon` as a fallback. The issue is that we need to map MCP tool calls to their corresponding server icons from the `assets` folder, so users can visually identify which service/server the tool belongs to.

## Current Implementation Analysis

### 1. **Where MCP Tools Are Rendered**
- **Component**: `src/components/McpToolCall.tsx`
- **Usage**: Called from `src/components/ToolRenderer.tsx` which catches all MCP tool calls
- **Current Icon Logic**: Hardcoded mapping for only 5 services:
  ```typescript
  const getToolIcon = (toolName: string) => {
      const name = toolName.toLowerCase();
      if (name.includes("notion")) return Notion;
      if (name.includes("figma")) return Figma;
      if (name.includes("github") || name.includes("git")) return GitHub;
      if (name.includes("linear")) return Linear;
      if (name.includes("supabase")) return Supabase;
      return null; // Falls back to no icon
  };
  ```

### 2. **How Tools Are Structured**
- **Background Service** (`src/background.ts`): 
  - Function `getAllMCPTools()` fetches tools from all enabled MCP servers
  - Each tool has `serverId` and `serverName` attached:
    ```typescript
    const serverTools = toolsList.tools.map((tool: any) => ({
        ...tool,
        serverId,      // e.g., "notion", "linear", "supabase"
        serverName     // e.g., "Notion", "Linear", "Supabase"
    }));
    ```

- **MCP Proxy** (`src/ai/mcpProxy.ts`):
  - Converts MCP tool definitions to AI SDK format
  - Preserves `serverId` and `serverName` in tool definitions
  - Tools are passed with original names (no prefixing)

### 3. **Available Server Configurations**
- **File**: `src/constants/mcpServers.tsx`
- **Structure**: Array of `ServerConfig` with:
  - `id`: Unique identifier (e.g., "notion", "linear")
  - `name`: Display name
  - `icon`: React component or image element
  - Other metadata (auth requirements, URLs, etc.)

### 4. **Available Icon Assets**
Located in `assets/` folder:
- **SVG Components**: `Ahrefs.tsx`, `Asana.tsx`, `Atlassian.tsx`, `Canva.tsx`, `Figma.tsx`, `GitHub.tsx`, `Globalping.tsx`, `HuggingFace.tsx`, `Linear.tsx`, `Netlify.tsx`, `Notion.tsx`, `PayPal.tsx`, `Sentry.tsx`, `Stripe.tsx`, `Supabase.tsx`, `Vercel.tsx`, `Webflow.tsx`, `Wix.tsx`
- **Images**: `context7.png`, `coingecko.webp`, `deepwiki.webp`, `wix.webp`, `mcp.png`
- **Chat Icons** (sub-folder): Various action icons for browser automation

### 5. **Existing Icon Mapping System**
- **File**: `src/components/ui/ToolIconMapper.tsx`
- **Purpose**: Maps **local frontend tool names** to animated icons
- **Current mapping**: Click, navigate, search, scroll, memory operations, etc.
- **Fallback**: `ChromeIcon` for unmapped tools
- **Note**: This is for local tools, NOT MCP tools

## Root Cause Analysis

### Why ChromeIcon is Used
1. **Missing Server Context**: The `McpToolCall` component receives only the `toolName` from the render props
2. **No ServerId Propagation**: The `serverId` from tool definitions is NOT passed through the rendering chain
3. **Limited Pattern Matching**: Current `getToolIcon()` only checks if tool name contains server keywords
4. **Incomplete Mapping**: Only 5 services are mapped, rest fall back to `null`

### Architecture Gap
```
Background (has serverId) 
  → mcpProxy (preserves serverId) 
    → AI SDK (executes tool)
      → ToolRenderer (renders UI) 
        → McpToolCall (❌ NO serverId available)
```

## Proposed Solution

### Option 1: Pass ServerId Through Render Props (RECOMMENDED)
**Why**: Clean, explicit, leverages existing data flow

**Steps**:

#### Step 1: Enhance MCPToolDefinition Interface
- **File**: `src/ai/mcpProxy.ts`
- **Action**: Ensure `serverId` and `serverName` are part of tool metadata
- **Why**: These fields are already added by the background service, just need to ensure they're preserved

#### Step 2: Pass ServerId to Tool Renderer
- **File**: `src/components/ToolRenderer.tsx`
- **Action**: Extract `serverId` from tool call context and pass to `McpToolCall`
- **Challenge**: Need to verify if CopilotKit's render props include tool metadata
- **Alternative**: Parse from tool name if format is standardized (e.g., `notion_search_pages`)

#### Step 3: Create Server-to-Icon Mapping Utility
- **New File**: `src/utils/mcpIconMapper.ts` or `src/components/ui/McpIconMapper.tsx`
- **Purpose**: 
  - Export a mapping object: `serverId → IconComponent`
  - Import icons from `assets/`
  - Provide function: `getMcpServerIcon(serverId: string): React.ComponentType`
  - Fallback to generic MCP icon or ChromeIcon
- **Why Separate File**: Reusability across components, easier maintenance

#### Step 4: Update McpToolCall Component
- **File**: `src/components/McpToolCall.tsx`
- **Changes**:
  - Add `serverId?: string` to `McpToolCallProps` interface
  - Replace `getToolIcon()` function with import from `McpIconMapper`
  - Update icon resolution: `const Icon = getMcpServerIcon(serverId || toolName)`
  - Keep fallback behavior for backward compatibility

#### Step 5: Verify Icon Assets Match Server IDs
- **Action**: Cross-reference `mcpServers.tsx` server IDs with available icon files
- **Create Missing Icons**: For servers with only image assets (context7, coingecko, deepwiki)
- **Ensure Consistency**: Server ID in config matches icon file name (case-insensitive)

### Option 2: Parse Tool Name Convention
**Why**: No need to modify data flow, works with existing architecture

**Steps**:

#### Step 1: Establish Naming Convention
- **Convention**: MCP tools should be named as `{serverId}_{toolName}`
- **Example**: `notion_search_pages`, `linear_create_issue`, `supabase_query_database`
- **Challenge**: Requires background service to prefix tool names
- **Risk**: Breaks existing tool calls if not backward compatible

#### Step 2: Update Background Service
- **File**: `src/background.ts` → `getAllMCPTools()`
- **Action**: Prefix tool names with `serverId_` before returning
- **Why**: Makes server association explicit in tool name

#### Step 3: Create Parsing Utility
- **File**: `src/utils/parseToolServerId.ts`
- **Function**: `extractServerId(toolName: string): string | null`
- **Logic**: Split by underscore, return first part if matches known server ID

#### Step 4: Use in McpToolCall
- **Import** parsing utility and icon mapper
- **Extract** serverId from toolName
- **Map** to appropriate icon

**Drawbacks**:
- Changes tool names visible to AI and users
- May break existing integrations
- Less flexible than explicit metadata passing

### Option 3: Global Tool Registry (OVER-ENGINEERED)
**Why**: Most future-proof but complex

**Not Recommended** for this use case as it's overkill.

## Recommended Approach: OPTION 1

### Why Option 1?
1. ✅ **Clean Architecture**: Uses existing metadata from background
2. ✅ **No Breaking Changes**: Doesn't modify tool names
3. ✅ **Explicit & Clear**: ServerId is directly passed, no guessing
4. ✅ **Maintainable**: Single source of truth for icons
5. ✅ **Backward Compatible**: Falls back gracefully if serverId missing

## Detailed Implementation Steps

### Phase 1: Setup Icon Mapping Infrastructure

#### File: `src/components/ui/McpIconMapper.tsx`
```typescript
/**
 * Maps MCP server IDs to their corresponding icon components
 * Provides centralized icon mapping for MCP tool visualization
 */

import React from 'react';
import { Ahrefs } from '../../../assets/Ahrefs';
import { Asana } from '../../../assets/Asana';
// ... import all MCP server icons

interface McpIconMapperProps {
  serverId: string;
  size?: number;
  className?: string;
}

// Server ID to Icon Component mapping
const MCP_SERVER_ICONS: Record<string, React.ComponentType<any>> = {
  'ahrefs': Ahrefs,
  'asana': Asana,
  'astro-docs': Astro,
  // ... map all servers
  'notion': Notion,
  'linear': Linear,
  'supabase': Supabase,
  // ... continue for all
};

/**
 * Get icon component for a given MCP server ID
 * Returns null if no mapping exists (caller should use fallback)
 */
export function getMcpServerIcon(serverId?: string): React.ComponentType<any> | null {
  if (!serverId) return null;
  
  const normalizedId = serverId.toLowerCase();
  return MCP_SERVER_ICONS[normalizedId] || null;
}

/**
 * Render icon for MCP server with size and className support
 */
export function McpServerIcon({ serverId, size = 24, className }: McpIconMapperProps) {
  const IconComponent = getMcpServerIcon(serverId);
  
  if (!IconComponent) {
    return null; // Caller should handle fallback
  }
  
  return <IconComponent width={size} height={size} className={className} />;
}
```

**Why This Structure**:
- Separate function for flexibility (can use in different contexts)
- Component wrapper for convenience
- Size and className props for styling control
- Null return allows caller to decide fallback

### Phase 2: Investigate Tool Metadata Propagation

#### Task: Check CopilotKit Render Props
**File**: `src/components/ToolRenderer.tsx`

**What to Check**:
```typescript
render: ({ name, status, args, result }: CatchAllActionRenderProps<[]>) => {
  // Do these props include tool metadata?
  // Is there a way to access the original tool definition?
  // Can we get serverId from somewhere?
}
```

**Possible Solutions**:
- **If metadata available**: Extract and pass directly
- **If NOT available**: Need to store tool→serverId mapping globally
- **Alternative**: Check if `args` or `result` include server info

#### Task: Create Tool Metadata Store (If Needed)
**File**: `src/utils/toolMetadataStore.ts`

```typescript
/**
 * Global store for tool metadata (serverId mapping)
 * Populated when tools are registered, queried during rendering
 */

const toolToServerMap = new Map<string, string>();

export function registerToolServer(toolName: string, serverId: string) {
  toolToServerMap.set(toolName, serverId);
}

export function getToolServerId(toolName: string): string | undefined {
  return toolToServerMap.get(toolName);
}

export function clearToolMetadata() {
  toolToServerMap.clear();
}
```

**Usage**: 
- Register in `mcpProxy.ts` when creating tool definitions
- Query in `ToolRenderer.tsx` or `McpToolCall.tsx`

### Phase 3: Update McpToolCall Component

#### File: `src/components/McpToolCall.tsx`

**Changes**:

1. **Update Interface**:
```typescript
interface McpToolCallProps {
    name: string;
    status: "executing" | "complete" | "failed";
    args?: Record<string, any>;
    result?: any;
    serverId?: string; // NEW: Optional server identifier
}
```

2. **Import Icon Mapper**:
```typescript
import { getMcpServerIcon } from '../ui/McpIconMapper';
import { ChromeIcon } from '../../../assets/chat/chrome'; // Fallback
```

3. **Replace getToolIcon Function**:
```typescript
// REMOVE old hardcoded mapping
// const getToolIcon = (toolName: string) => { ... }

// NEW: Use serverId-based lookup with fallback
const getToolIcon = (serverId?: string, toolName?: string) => {
  // Try server ID first
  if (serverId) {
    const serverIcon = getMcpServerIcon(serverId);
    if (serverIcon) return serverIcon;
  }
  
  // Fallback: try pattern matching on tool name (backward compatibility)
  if (toolName) {
    const name = toolName.toLowerCase();
    if (name.includes("notion")) return getMcpServerIcon("notion");
    if (name.includes("figma")) return getMcpServerIcon("figma");
    if (name.includes("github") || name.includes("git")) return getMcpServerIcon("github");
    if (name.includes("linear")) return getMcpServerIcon("linear");
    if (name.includes("supabase")) return getMcpServerIcon("supabase");
  }
  
  // Final fallback
  return ChromeIcon;
};
```

4. **Update Component Logic**:
```typescript
function McpToolCall({ name, status, args, result, serverId }: McpToolCallProps) {
    const Icon = getToolIcon(serverId, name);
    // ... rest of component unchanged
}
```

### Phase 4: Update Tool Renderer

#### File: `src/components/ToolRenderer.tsx`

**Goal**: Pass `serverId` to `McpToolCall` component

**Steps**:

1. **Import Metadata Store** (if needed):
```typescript
import { getToolServerId } from '../utils/toolMetadataStore';
```

2. **Extract ServerId in Render Function**:
```typescript
render: ({ name, status, args, result }: CatchAllActionRenderProps<[]>) => {
    // Option A: If available in props directly
    const serverId = (args as any)?._serverId || (result as any)?._serverId;
    
    // Option B: If using metadata store
    const serverId = getToolServerId(name);
    
    // Option C: If all else fails, try parsing tool name
    const serverId = name.split('_')[0]; // If convention followed
    
    const mappedStatus = status === "inProgress" ? "executing" : status;
    
    return (
        <McpToolCall
            status={mappedStatus as "executing" | "complete" | "failed"}
            name={name}
            args={args}
            result={result}
            serverId={serverId} // NEW: Pass server ID
        />
    );
}
```

### Phase 5: Populate Tool Metadata (If Store Needed)

#### File: `src/ai/mcpProxy.ts`

**If using metadata store**:

1. **Import Store**:
```typescript
import { registerToolServer } from '../utils/toolMetadataStore';
```

2. **Register Tools When Creating**:
```typescript
for (const toolDef of toolDefinitions) {
    try {
        // ... existing tool creation code ...
        
        tools[toolDef.name] = {
            description: toolDef.description || `Tool from ${toolDef.serverName}`,
            parameters: zodSchema,
            execute: async (args: any) => { ... }
        };
        
        // NEW: Register server mapping
        registerToolServer(toolDef.name, toolDef.serverId);
        
        log.info(`✅ Registered proxy tool: ${toolDef.name} (from ${toolDef.serverName})`);
    } catch (error) { ... }
}
```

### Phase 6: Handle Image-Based Icons

Some servers use images instead of SVG components:
- Context7: `context7.png`
- CoinGecko: `coingecko.webp`
- DeepWiki: `deepwiki.webp`

#### Option A: Create SVG Wrapper Components
**Files**: `assets/Context7.tsx`, `assets/CoinGecko.tsx`, `assets/DeepWiki.tsx`

```typescript
// assets/Context7.tsx
import React from 'react';
import context7Image from './context7.png';

export function Context7({ width = 24, height = 24 }: { width?: number; height?: number }) {
  return (
    <img 
      src={context7Image} 
      alt="Context7" 
      width={width} 
      height={height}
      style={{ objectFit: 'contain' }}
    />
  );
}
```

#### Option B: Handle in Icon Mapper
```typescript
const MCP_SERVER_IMAGES: Record<string, string> = {
  'context7': context7Image,
  'coingecko': coingeckoImage,
  'deepwiki': deepwikiImage,
};

export function getMcpServerIcon(serverId?: string): React.ComponentType<any> | null {
  if (!serverId) return null;
  
  const normalizedId = serverId.toLowerCase();
  
  // Check SVG components first
  if (MCP_SERVER_ICONS[normalizedId]) {
    return MCP_SERVER_ICONS[normalizedId];
  }
  
  // Check images
  if (MCP_SERVER_IMAGES[normalizedId]) {
    // Return wrapper component
    return ({ width = 24, height = 24 }: any) => (
      <img 
        src={MCP_SERVER_IMAGES[normalizedId]} 
        alt={serverId}
        width={width}
        height={height}
        style={{ objectFit: 'contain' }}
      />
    );
  }
  
  return null;
}
```

### Phase 7: Add Generic MCP Fallback Icon

For servers without specific icons:

**Option 1**: Use existing `mcp.png` from assets
**Option 2**: Create a generic MCP icon component
**Option 3**: Keep ChromeIcon as ultimate fallback

**Recommended**: Use `mcp.png` as MCP fallback, ChromeIcon as absolute last resort

```typescript
import mcpGenericImage from '../../../assets/mcp.png';

const GenericMCPIcon = ({ width = 24, height = 24 }: any) => (
  <img 
    src={mcpGenericImage} 
    alt="MCP Tool"
    width={width}
    height={height}
  />
);

const getToolIcon = (serverId?: string, toolName?: string) => {
  // ... server lookup logic ...
  
  // MCP generic fallback
  return GenericMCPIcon;
};
```

## Testing Strategy

### Test Cases

1. **Server-Specific Icons**
   - Enable Notion server
   - Trigger Notion tool
   - Verify Notion icon displays

2. **Fallback Behavior**
   - Call tool with no serverId
   - Verify ChromeIcon or MCP generic displays

3. **Pattern Matching Fallback**
   - Call tool without serverId but name contains "linear"
   - Verify Linear icon displays

4. **Image-Based Icons**
   - Enable Context7/CoinGecko/DeepWiki
   - Trigger their tools
   - Verify images display correctly

5. **Multiple Tools from Same Server**
   - Enable server with multiple tools
   - Execute different tools
   - Verify all use same server icon

6. **Unknown Server**
   - Mock tool from unregistered server
   - Verify graceful fallback

## Potential Issues & Solutions

### Issue 1: Render Props Don't Include Metadata
**Solution**: Use global tool metadata store populated during registration

### Issue 2: Icon Size Inconsistencies
**Solution**: Standardize size prop (24x24) and use CSS for container sizing

### Issue 3: Image Loading Performance
**Solution**: 
- Use lazy loading for images
- Consider converting images to SVG for consistency
- Add loading placeholder

### Issue 4: Icon Component Type Mismatches
**Solution**: Ensure all icon components accept consistent props (width, height, className)

### Issue 5: Dynamic Server Registration
**Solution**: Clear and repopulate metadata store when servers are enabled/disabled

## Files to Create/Modify

### New Files
1. `src/components/ui/McpIconMapper.tsx` - Icon mapping utility
2. `src/utils/toolMetadataStore.ts` - (If needed) Tool→Server mapping
3. `assets/Context7.tsx` - Wrapper for image icon
4. `assets/CoinGecko.tsx` - Wrapper for image icon
5. `assets/DeepWiki.tsx` - Wrapper for image icon

### Modified Files
1. `src/components/McpToolCall.tsx` - Add serverId prop, update icon logic
2. `src/components/ToolRenderer.tsx` - Pass serverId to McpToolCall
3. `src/ai/mcpProxy.ts` - (If needed) Register tool metadata
4. `src/constants/mcpServers.tsx` - Verify icon consistency

## Success Criteria

✅ Each MCP tool call displays the correct server icon
✅ Fallback behavior works for missing/unknown servers
✅ No performance degradation in rendering
✅ Icons are consistently sized and styled
✅ Works for both SVG components and image assets
✅ Backward compatible with existing tool calls
✅ Easy to add new server icons in the future

## Timeline Estimate

- **Phase 1** (Icon Mapper): 1-2 hours
- **Phase 2** (Investigation): 1-2 hours
- **Phase 3** (Update McpToolCall): 1 hour
- **Phase 4** (Update ToolRenderer): 1 hour
- **Phase 5** (Metadata Store): 1-2 hours (if needed)
- **Phase 6** (Image Icons): 1 hour
- **Phase 7** (Generic Fallback): 30 minutes
- **Testing**: 2-3 hours

**Total**: 8-12 hours of development time

## Next Steps

1. Review this plan and approve approach
2. Investigate render props in Phase 2 to determine if metadata store needed
3. Implement Phase 1 (icon mapper) first as it's independent
4. Based on Phase 2 findings, proceed with either direct passing or store approach
5. Implement remaining phases sequentially
6. Test thoroughly with multiple servers
7. Document usage for future server additions
