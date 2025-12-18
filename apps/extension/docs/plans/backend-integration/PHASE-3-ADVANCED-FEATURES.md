# Phase 3: Advanced Features

## Overview

This phase adds advanced capabilities to backend mode including WebMCP integration, streaming optimizations, analytics, and user experience improvements.

**Goal:** Bring backend mode to feature parity with BYOK mode and add backend-exclusive features.

**Scope:**
- ✅ WebMCP protocol support
- ✅ Streaming optimizations
- ✅ Usage analytics and rate limit visibility
- ✅ Session management
- ✅ Model selection in backend mode
- ✅ Enhanced error recovery

## Prerequisites

- Phase 1 and Phase 2 completed
- Understanding of WebMCP protocol (optional for WebMCP features)

---

## Feature 1: WebMCP Integration

### What is WebMCP?

WebMCP allows websites to expose tools that AI can call. When backend mode is active, we can still support WebMCP by:
1. Discovering tools from websites (in browser)
2. Sending tool schemas to backend (like Phase 2)
3. Executing WebMCP tools in browser context

### Implementation

**File:** `apps/extension/src/ai/backend/webmcpIntegration.ts` (NEW)

```typescript
/**
 * WebMCP Integration for Backend Mode
 * 
 * Bridges WebMCP tool discovery with backend AI.
 * Tools discovered from websites are sent to backend as schemas,
 * and executed locally when the AI calls them.
 */

import { createLogger } from '~logger';
import { getToolSchemas as getBuiltinSchemas } from './frontendToolExecutor';

const log = createLogger('WebMCPBackend', 'WEBMCP');

interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Get combined tool schemas including WebMCP tools
 */
export async function getCombinedToolSchemas(): Promise<Record<string, unknown>> {
  // Get built-in tool schemas
  const builtinSchemas = getBuiltinSchemas();
  
  // Get WebMCP tools from active tab
  const webmcpTools = await discoverWebMCPTools();
  
  // Merge, with WebMCP tools prefixed to avoid conflicts
  const combined = { ...builtinSchemas };
  
  for (const tool of webmcpTools) {
    const prefixedName = `webmcp_${tool.name}`;
    combined[prefixedName] = {
      description: `[WebMCP] ${tool.description}`,
      parameters: tool.inputSchema,
    };
  }
  
  log.info('Combined tool schemas:', {
    builtin: Object.keys(builtinSchemas).length,
    webmcp: webmcpTools.length,
    total: Object.keys(combined).length,
  });
  
  return combined;
}

/**
 * Discover WebMCP tools from current page
 */
async function discoverWebMCPTools(): Promise<WebMCPTool[]> {
  try {
    // Query the MCP hub in background for active tab tools
    const response = await chrome.runtime.sendMessage({
      type: 'GET_WEBMCP_TOOLS',
    });
    
    if (response?.tools) {
      log.info('Discovered WebMCP tools:', response.tools.length);
      return response.tools;
    }
    
    return [];
  } catch (error) {
    log.warn('Failed to discover WebMCP tools:', error);
    return [];
  }
}

/**
 * Execute a WebMCP tool
 */
export async function executeWebMCPTool(
  toolName: string, 
  args: Record<string, unknown>
): Promise<unknown> {
  // Remove webmcp_ prefix
  const originalName = toolName.replace(/^webmcp_/, '');
  
  log.info('Executing WebMCP tool:', { toolName: originalName, args });
  
  const response = await chrome.runtime.sendMessage({
    type: 'EXECUTE_WEBMCP_TOOL',
    toolName: originalName,
    args,
  });
  
  if (response?.error) {
    throw new Error(response.error);
  }
  
  return response?.result;
}
```

---

## Feature 2: Model Selection

### Allow Users to Choose Model

Backend mode should support model selection, with options appropriate for our API quota.

**File:** `apps/extension/src/stores/settingsStore.ts`

Add backend model selection:

```typescript
interface SettingsState {
  // ... existing ...
  
  // Backend mode settings
  useBackendMode: boolean;
  setUseBackendMode: (value: boolean) => void;
  
  // Backend model selection
  backendModel: 'gemini-2.0-flash' | 'gemini-1.5-flash' | 'gemini-1.5-pro';
  setBackendModel: (model: SettingsState['backendModel']) => void;
}
```

**UI Component:**

```tsx
// In settings or composer toolbar dropdown
const modelOptions = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', description: 'Fast & capable' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Balanced' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Most capable (higher quota usage)' },
];
```

---

## Feature 3: Rate Limit Visibility

### Show Users Their Usage

**File:** `packages/backend-vercel/src/routes/ai.ts` (add endpoint)

> [!NOTE]
> The backend uses the modular TypeScript structure. Add this endpoint to `src/routes/ai.ts`.
> Rate limiting is handled via `src/middleware/rateLimit.ts` which supports Redis via Upstash.

```typescript
// Add to src/routes/ai.ts (uses existing imports)
// import { getClientIp } from '../middleware/logging';
// import { getUsageForIP } from '../middleware/rateLimit';

/**
 * GET /api/ai/usage
 * 
 * Returns current usage stats for the user
 */
router.get('/usage', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    
    // Get usage from Redis or in-memory store
    const usage = await getUsageForIP(ip);
    
    return res.json({
        requests: {
            used: usage.count,
            limit: 20,
            resetIn: usage.resetIn,
        },
        quota: {
            daily: { used: usage.dailyCount, limit: 100 },
            monthly: { used: usage.monthlyCount, limit: 1000 },
        },
    });
});
```

**Extension UI:**

```tsx
// Add usage indicator to mode toggle
const [usage, setUsage] = useState<UsageInfo | null>(null);

useEffect(() => {
  if (useBackendMode) {
    fetch(`${BACKEND_URL}/api/ai/usage`)
      .then(r => r.json())
      .then(setUsage)
      .catch(() => {});
  }
}, [useBackendMode]);

// In the UI:
{useBackendMode && usage && (
  <div className="text-xs text-muted-foreground">
    {usage.requests.used}/{usage.requests.limit} requests
    {usage.requests.used >= usage.requests.limit && (
      <span className="text-destructive"> (limit reached)</span>
    )}
  </div>
)}
```

---

## Feature 4: Persistent Sessions with Redis

### Upgrade Rate Limiting

Move from in-memory to Redis for production reliability.

> [!NOTE]
> The backend already has Redis infrastructure via Upstash configured in `src/config/config.ts`:
> - `config.upstashRedisUrl` - Redis REST URL
> - `config.upstashRedisToken` - Redis REST token
>
> Rate limiting is handled in `src/middleware/rateLimit.ts` with `initializeRedis()` called at startup.

**File:** `packages/backend-vercel/src/middleware/rateLimit.ts` (Update)

```typescript
import { Redis } from '@upstash/redis';
import { config } from '../config/config';

let redis: Redis | null = null;

export function initializeRedis(): void {
    if (config.upstashRedisUrl && config.upstashRedisToken) {
        redis = new Redis({
            url: config.upstashRedisUrl,
            token: config.upstashRedisToken,
        });
        console.log('[RateLimit] Redis initialized');
    } else {
        console.log('[RateLimit] Using in-memory fallback');
    }
}

interface RateLimitResult {
    allowed: boolean;
    remaining?: number;
    retryAfter?: number;
}

export async function checkRateLimitWithRedis(ip: string): Promise<RateLimitResult> {
    if (!redis) {
        // Fallback to in-memory
        return checkInMemoryRateLimit(ip);
    }
    
    const key = `ratelimit:ai:${ip}`;
    const current = await redis.incr(key);
    
    if (current === 1) {
        // First request, set expiry
        await redis.expire(key, AI_RATE_LIMIT_WINDOW / 1000);
    }
    
    if (current > 20) {
        const ttl = await redis.ttl(key);
        return { allowed: false, retryAfter: ttl };
    }
    
    return { allowed: true, remaining: 20 - current };
}
```

---

## Feature 5: Streaming Optimizations

### Reduce Latency with Connection Reuse

**File:** `apps/extension/src/ai/backend/streamingOptimizations.ts` (NEW)

```typescript
/**
 * Streaming Optimizations
 * 
 * - Connection pooling
 * - Request deduplication
 * - Prefetching for likely follow-ups
 */

import { createLogger } from '~logger';

const log = createLogger('StreamOptimizer', 'AI_CHAT');

// Keep-alive connection for backend
let backendController: AbortController | null = null;

/**
 * Create optimized fetch for streaming
 */
export function createOptimizedFetch() {
  return (url: string, options: RequestInit) => {
    // Add keep-alive headers
    const headers = new Headers(options.headers);
    headers.set('Connection', 'keep-alive');
    
    return fetch(url, {
      ...options,
      headers,
      // Enable streaming
      // @ts-ignore - experimental
      duplex: 'half',
    });
  };
}

/**
 * Abort any in-flight backend request
 */
export function abortBackendRequest() {
  if (backendController) {
    backendController.abort();
    backendController = null;
  }
}

/**
 * Create new abort controller for backend request
 */
export function createBackendController(): AbortController {
  abortBackendRequest();
  backendController = new AbortController();
  return backendController;
}
```

---

## Feature 6: Analytics and Monitoring

### Track Backend Mode Usage

**File:** `packages/backend-vercel/src/routes/ai.ts` (Update)

> [!NOTE]
> Add analytics logging to the existing TypeScript routes. The modular structure allows
> creating a dedicated analytics service at `src/services/analytics.ts` if needed.

Add analytics logging:

```typescript
// At the end of successful requests in src/routes/ai.ts:
const startTime = Date.now();

// ... after streaming completes:
console.log('[Analytics] Request completed:', {
    timestamp: new Date().toISOString(),
    model: modelName,
    messageCount: messages.length,
    hasTools: Object.keys(toolSchemas || {}).length > 0,
    responseTime: Date.now() - startTime,
    ip: typeof ip === 'string' ? ip.substring(0, 10) : 'unknown', // Truncated for privacy
    region: config.vercelRegion,
    // These can be sent to analytics service
});
```

For production, integrate with:
- Vercel Analytics
- Custom dashboard
- Alerting for errors/quota

---

## Feature 7: Graceful Degradation

### Auto-Fallback to BYOK

When backend rate limits are exceeded, offer to switch to BYOK mode.

```tsx
// In error handling:
if (error.status === 429 && hasApiKey) {
  showToast({
    title: 'Rate limit reached',
    description: 'Would you like to switch to your API key?',
    action: {
      label: 'Switch to BYOK',
      onClick: () => setUseBackendMode(false),
    },
  });
}
```

---

## Testing Checklist

### WebMCP
- [ ] Tools from websites are discovered
- [ ] WebMCP tools appear in backend tool schemas
- [ ] WebMCP tool execution works via backend mode

### Model Selection
- [ ] Model selector shows available models
- [ ] Selected model is sent to backend
- [ ] Different models produce appropriate responses

### Rate Limiting
- [ ] Usage endpoint returns current stats
- [ ] UI shows usage information
- [ ] Rate limits enforce correctly with Redis
- [ ] Graceful degradation offers BYOK fallback

### Performance
- [ ] Streaming starts quickly (< 500ms TTFB)
- [ ] Connection reuse works
- [ ] Abort works mid-stream

---

## Success Criteria

Phase 3 is complete when:

1. **WebMCP works** in backend mode
2. **Model selection** is available
3. **Usage visibility** shows rate limits
4. **Redis rate limiting** is production-ready
5. **Graceful degradation** handles limits smoothly
6. **Analytics** provide visibility into usage

---

## Future Considerations (Beyond Phase 3)

### Phase 5: Content Script Features
See [PHASE-5-CONTENT-SCRIPT-FEATURES.md](./PHASE-5-CONTENT-SCRIPT-FEATURES.md) for:
- Writer (text generation)
- Rewriter (text transformation)
- Summarizer (text summarization)

### Potential Phase 6+ Features
- **User accounts** for persistent quotas
- **Premium tier** with higher limits
- **Custom system prompts** stored on backend
- **Conversation history** sync across devices
- **Shared conversations** via links

### Security Enhancements
- **API key rotation** on backend
- **Request signing** with extension identity
- **Anomaly detection** for abuse prevention
- **CORS restrictions** to extension origin only

---

## Conclusion

After completing all three phases, backend mode will be a fully functional alternative to BYOK mode:

| Capability | BYOK | Backend (Full) |
|------------|------|----------------|
| Text chat | ✅ | ✅ |
| Backend tools (search, retrieve) | ✅ | ✅ |
| Frontend tools | ✅ | ✅ |
| MCP server tools | ✅ | ✅ |
| WebMCP tools | ✅ | ✅ |
| Model selection | ✅ | ✅ |
| No API key needed | ❌ | ✅ |
| Unlimited usage | ✅ | ❌ (rate limited) |

Users can choose based on their needs:
- **BYOK**: Full control, no limits, key stays on device
- **Backend**: Easy start, no setup, rate limited
