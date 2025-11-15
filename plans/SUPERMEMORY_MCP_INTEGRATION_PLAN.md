# Supermemory MCP Integration Plan

## Overview
Integrate Supermemory MCP as a universal memory layer for the Chrome AI extension. Supermemory provides persistent memory across conversations with automatic storage and retrieval capabilities.

## Key Features
- **Global Memory**: All memories accessible across all conversations
- **Semi-Automatic Memory Triggers**: AI suggests memories, user confirms (or AI decides autonomously)
- **Automatic Retrieval**: AI fetches relevant memories when needed
- **OAuth with DCR**: Full OAuth 2.1 + PKCE authentication (already implemented)
- **Simple Integration**: Treated as standard MCP server (no special UI needed)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome AI Extension                       │
│                                                               │
│  ┌────────────────┐     ┌──────────────────────────────┐   │
│  │   Chat UI      │────▶│  AI Assistant (Gemini)       │   │
│  │                │     │  - Decides when to remember   │   │
│  │  [💭 Memory]   │     │  - Searches memories          │   │
│  └────────────────┘     └──────────┬───────────────────┘   │
│                                     │                         │
│                                     ▼                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         MCP Client Infrastructure                     │   │
│  │  - OAuth Discovery & DCR (✅ Already Built)          │   │
│  │  - SSE Connection Handler                            │   │
│  │  - Tool Call Manager                                 │   │
│  └──────────────────┬───────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │ SSE + MCP Protocol
                      ▼
    ┌─────────────────────────────────────────────┐
    │    Supermemory MCP Server (Hosted)          │
    │    https://api.supermemory.ai/mcp           │
    │                                              │
    │  Tools:                                      │
    │  1. addToSupermemory(content, tags?)        │
    │  2. searchSupermemory(query, limit?)        │
    └─────────────────────────────────────────────┘
```

## Implementation Phases

---

### **Phase 1: Core Integration** ⚡ (30 minutes)
**Goal**: Add Supermemory to MCP servers list and verify OAuth connection

#### Tasks:
1. **Add Supermemory Server Configuration**
   - File: `src/constants/mcpServers.tsx`
   - Add Supermemory entry to `MCP_SERVERS` array
   - Configure OAuth settings (DCR-enabled, scopes if needed)
   - Set `requiresAuthentication: true`

2. **Add Icon Mapping**
   - File: `src/components/ui/tools/icons/McpIconMapper.tsx`
   - Import Supermemory SVG from `assets/supermemory.svg`
   - Add mapping: `'supermemory': Supermemory`

3. **Create Supermemory Icon Component**
   - File: `assets/Supermemory.tsx`
   - Create React component wrapper for SVG (follow pattern of other icons) only if neded if not using raw SVG

#### Deliverables:
- ✅ Supermemory appears in MCP servers list
- ✅ Icon displays correctly
- ✅ Server can be enabled/disabled from settings

#### Testing:
```bash
# Build extension
pnpm run build

# Test in Chrome:
# 1. Go to extension options
# 2. Find Supermemory in MCP servers list
# 3. Click "Enable"
# 4. Verify OAuth flow launches
# 5. Complete authentication
# 6. Verify connection status shows "connected"
```

---

### **Phase 2: OAuth Discovery & Connection** 🔐 (20 minutes)
**Goal**: Ensure OAuth discovery works with Supermemory's endpoints

#### Tasks:
1. **Verify OAuth Discovery**
   - Test discovery with: `https://api.supermemory.ai/mcp`
   - Confirm DCR registration endpoint discovered
   - Verify PKCE support detected

2. **Test OAuth Flow**
   - Enable Supermemory server
   - Verify dynamic client registration
   - Complete authorization flow
   - Verify token storage in `chrome.storage.local`

3. **Verify SSE Connection**
   - Confirm SSE connection establishes after OAuth
   - Verify MCP protocol handshake (initialize)
   - Confirm tools list received

#### Deliverables:
- ✅ OAuth discovery finds all endpoints
- ✅ Dynamic client registration succeeds
- ✅ SSE connection stable
- ✅ Tools available: `addToSupermemory`, `searchSupermemory`

#### Testing:
```bash
# Run discovery test
node test-mcp-discovery.js https://api.supermemory.ai/mcp

# Expected output:
# ✅ Protected Resource Metadata: FOUND
# ✅ Authorization Server Metadata: FOUND
# ✅ DCR Supported: YES
```

---

### **Phase 3: Tool Integration & AI Prompting** 🤖 (45 minutes)
**Goal**: Configure AI assistant to use memory tools appropriately

#### Tasks:
1. **Verify Tool Schemas**
   - File: Check MCP tools list response
   - Verify `addToSupermemory` schema:
     ```typescript
     {
       name: "addToSupermemory",
       description: "Store information in long-term memory",
       inputSchema: {
         type: "object",
         properties: {
           content: { type: "string", description: "The information to remember" },
           tags?: { type: "array", items: { type: "string" } }
         },
         required: ["content"]
       }
     }
     ```
   - Verify `searchSupermemory` schema:
     ```typescript
     {
       name: "searchSupermemory",
       description: "Search long-term memory for relevant information",
       inputSchema: {
         type: "object",
         properties: {
           query: { type: "string", description: "Search query" },
           limit?: { type: "number", description: "Max results" }
         },
         required: ["query"]
       }
     }
     ```

2. **Configure AI System Prompt** (Optional Enhancement)
   - File: `src/ai/prompts/systemPrompt.ts` (or equivalent)
   - Add memory usage guidelines:
     ```
     ## Memory System (Supermemory MCP)
     
     You have access to a persistent memory system. Use it wisely:
     
     **When to Save Memories (Semi-Automatic)**:
     - User shares important personal information (preferences, goals, facts)
     - User provides context about ongoing projects
     - User mentions people, places, or things they reference repeatedly
     - User explicitly asks you to remember something
     
     **Before Saving**:
     - Determine if information is worth remembering long-term
     - Extract the key information clearly
     - Add relevant tags for organization (e.g., ["personal", "work", "project-name"])
     
     **When to Search Memories (Automatic)**:
     - User asks about something from past conversations
     - Current conversation relates to stored context
     - User references a topic you've discussed before
     
     **Memory Tagging Strategy (Global)**:
     - All memories are globally accessible
     - Use tags to organize: #work, #personal, #project-[name], #preference
     - Be consistent with tag names
     ```

3. **Handle Tool Responses**
   - Existing infrastructure should handle this
   - Verify tool call success/failure messages display properly

#### Deliverables:
- ✅ AI can call `addToSupermemory` tool
- ✅ AI can call `searchSupermemory` tool
- ✅ Tool responses integrated into conversation
- ✅ AI follows memory usage guidelines

#### Testing:
Test conversation flow:
```
User: "I'm working on a Chrome extension called chrome-ai"
AI: [Calls addToSupermemory with content + tags]
AI: "I'll remember that you're working on chrome-ai..."

User: "What project was I working on?"
AI: [Calls searchSupermemory("project")]
AI: "You're working on a Chrome extension called chrome-ai"
```

---

### **Phase 4: Error Handling & Edge Cases** 🛡️ (30 minutes)
**Goal**: Handle failures gracefully

#### Tasks:
1. **Test Connection Failures**
   - Simulate network errors
   - Verify reconnection logic works
   - Test token expiration and refresh

2. **Test Tool Call Failures**
   - Invalid parameters
   - Empty search results
   - Rate limiting (if applicable)

3. **Add Error Messages**
   - User-friendly error display
   - Guidance for common issues

4. **Storage Validation**
   - Verify tokens stored correctly in `chrome.storage.local`
   - Test token persistence across sessions
   - Verify no memory leaks in long-running sessions

#### Deliverables:
- ✅ Graceful error handling
- ✅ Auto-reconnection on SSE disconnect
- ✅ Token refresh works automatically
- ✅ Clear error messages for users

---

### **Phase 5: Testing & Documentation** 📚 (45 minutes)
**Goal**: Comprehensive testing and user documentation

#### Tasks:
1. **End-to-End Testing**
   - Fresh installation flow
   - OAuth connection from scratch
   - Store 10+ memories with different tags
   - Search memories with various queries
   - Test cross-session persistence
   - Test with multiple tabs open

2. **Performance Testing**
   - Memory search response time
   - Impact on chat latency
   - SSE connection stability over 24+ hours

3. **Write User Documentation**
   - File: `docs/SUPERMEMORY_USAGE.md`
   - Setup instructions
   - How to enable Supermemory
   - How memories work (automatic)
   - Privacy considerations
   - Troubleshooting guide

4. **Update Main README**
   - Add Supermemory to features list
   - Link to documentation

#### Deliverables:
- ✅ Complete test suite passed
- ✅ User documentation written
- ✅ README updated
- ✅ Known issues documented

---

## Technical Implementation Details

### 1. Server Configuration Structure
```typescript
{
    id: "supermemory",
    name: "Supermemory",
    icon: <Supermemory />,
    initialEnabled: false,
    initialAuthenticated: false,
    url: "https://api.supermemory.ai/mcp",
    description: "Universal memory system that persists context across conversations. Automatically stores and retrieves important information.",
    requiresAuthentication: true,
    
    // OAuth configuration (DCR-enabled, will use discovery)
    oauth: {
        // Discovery will find these automatically
        // No manual hints needed since DCR is supported
        scopes: [], // Use default scopes from discovery
    }
}
```

### 2. Memory Storage Strategy
- **Where**: `chrome.storage.local` (key: `mcp.supermemory.tokens`)
- **What**: OAuth tokens (access_token, refresh_token, expires_at)
- **Why local**: Device-specific, not synced (per user's requirement)

### 3. Tool Call Flow
```typescript
// 1. User says something important
User: "My favorite color is blue"

// 2. AI decides to remember (semi-automatic)
AI Internal: [Should I remember this? Yes - personal preference]

// 3. AI calls MCP tool
MCP Tool Call: {
  name: "addToSupermemory",
  arguments: {
    content: "User's favorite color is blue",
    tags: ["personal", "preference", "color"]
  }
}

// 4. Supermemory stores it
Response: { success: true, id: "mem_123..." }

// 5. AI confirms to user
AI: "I'll remember that your favorite color is blue."

// Later...
User: "What's my favorite color?"

// 6. AI searches memory
MCP Tool Call: {
  name: "searchSupermemory",
  arguments: {
    query: "favorite color",
    limit: 5
  }
}

// 7. Supermemory returns matches
Response: {
  results: [
    { content: "User's favorite color is blue", relevance: 0.95 }
  ]
}

// 8. AI uses context
AI: "Your favorite color is blue!"
```

### 4. Global Tagging Strategy
All memories are globally tagged and accessible:
- `#personal` - Personal preferences, info about user
- `#work` - Work-related context
- `#project-[name]` - Project-specific memories
- `#preference` - User preferences
- `#contact` - People mentioned
- Custom tags as needed

### 5. Semi-Automatic Memory Triggers
AI will automatically determine when to save memories based on:
- Importance of information
- Likelihood of future reference
- User's explicit requests ("remember this")
- Context switches (starting new projects/topics)

No explicit user confirmation needed (fully automatic in practice, but AI is "smart" about when to save).

---

## Files to Modify

### Core Integration
1. ✏️ `src/constants/mcpServers.tsx` - Add Supermemory config
2. ✏️ `assets/Supermemory.tsx` - Create icon component (NEW)
3. ✏️ `src/components/ui/tools/icons/McpIconMapper.tsx` - Add icon mapping

### Optional Enhancements
4. ✏️ `src/ai/prompts/systemPrompt.ts` - Add memory guidelines (if exists)

### Documentation
5. ✏️ `docs/SUPERMEMORY_USAGE.md` - User guide (NEW)
6. ✏️ `README.md` - Update features list

---

## Success Criteria

### Phase 1-2: Connection ✅
- [ ] Supermemory appears in MCP servers list
- [ ] OAuth flow completes successfully
- [ ] SSE connection establishes
- [ ] Tools list includes `addToSupermemory` and `searchSupermemory`

### Phase 3-4: Functionality ✅
- [ ] AI can successfully store memories
- [ ] AI can successfully search memories
- [ ] Memories persist across sessions
- [ ] Error handling works correctly

### Phase 5: Production Ready ✅
- [ ] Documentation complete
- [ ] All tests pass
- [ ] Performance acceptable (<500ms for memory operations)
- [ ] No memory leaks in 24-hour test

---

## Timeline Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Core Integration | 30 min | 30 min |
| Phase 2: OAuth & Connection | 20 min | 50 min |
| Phase 3: Tool Integration | 45 min | 1h 35min |
| Phase 4: Error Handling | 30 min | 2h 5min |
| Phase 5: Testing & Docs | 45 min | **2h 50min** |

**Total Estimated Time**: ~3 hours

Given that all OAuth/MCP infrastructure is already built, this is primarily configuration and testing work.

---

## Risk Assessment

### Low Risk ✅
- **OAuth Discovery**: Already implemented and tested
- **DCR Support**: Confirmed working with test script
- **SSE Connection**: Existing infrastructure handles this
- **Tool Calls**: Standard MCP protocol, no special handling

### Medium Risk ⚠️
- **API Rate Limits**: Unknown if Supermemory has rate limits
  - Mitigation: Implement exponential backoff
- **Token Expiration**: Need to verify refresh token handling
  - Mitigation: Already implemented in oauth.ts

### Minimal Risk 🟢
- **Performance**: Memory operations might add latency
  - Mitigation: Async operations, don't block chat
- **Privacy**: Users might not realize everything is being remembered
  - Mitigation: Clear documentation, opt-in feature

---

## Post-Launch Enhancements (Future Phases)

### Phase 6: Advanced Features (Optional)
- Memory management UI (view/edit/delete memories)
- Memory export/import
- Thread-specific memory isolation (optional mode)
- Memory analytics (most used tags, memory count)
- Search filters by tags
- Memory deduplication

### Phase 7: UX Improvements (Optional)
- Memory indicator in chat (show when AI uses memories)
- Memory suggestions (show related memories in sidebar)
- Manual memory triggers (button to "remember this message")
- Memory confirmation prompts (semi-automatic with UI)

### Phase 8: Integration Enhancements (Optional)
- Sync memories with other MCP servers (Notion, etc.)
- Memory-based chat suggestions
- Cross-device memory sync (if using chrome.storage.sync)

---

## Notes

1. **No Special UI Required**: Supermemory is just another MCP server. All interactions happen through AI tool calls.

2. **Global Memory by Design**: All memories are accessible globally. No per-thread isolation in initial version.

3. **Semi-Automatic = Smart Automatic**: The AI will decide when to save memories intelligently. Users don't need to explicitly confirm each save.

4. **Existing Code Reuse**: 95% of the infrastructure already exists. This is primarily configuration work.

5. **Privacy Consideration**: Users should be aware that the extension is storing information externally. Add a notice in settings.

---

## Getting Started

To begin implementation:

```bash
# 1. Verify discovery works
node test-mcp-discovery.js https://api.supermemory.ai/mcp

# 2. Create feature branch
git checkout -b feature/supermemory-integration

# 3. Start with Phase 1
# Edit src/constants/mcpServers.tsx
# Create assets/Supermemory.tsx
# Update McpIconMapper.tsx

# 4. Test as you go
pnpm run build
# Load extension in Chrome and test
```

Ready to implement! 🚀
