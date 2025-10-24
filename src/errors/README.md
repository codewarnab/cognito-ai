# Error Handling System

This directory contains the centralized error handling infrastructure for the Chrome AI extension.

## Overview

The error handling system provides:

- **Typed Error Classes**: Comprehensive error types for all failure scenarios
- **User-Friendly Messages**: Automatic translation of technical errors to actionable user messages
- **Automatic Retry Logic**: Exponential backoff with jitter for transient errors
- **Rate Limit Handling**: Respects `Retry-After` headers and API rate limits
- **Formatted Error Display**: Ready-to-use markdown formatting for chat UI

## Architecture

### Core Files

- **`errorTypes.ts`**: Error type enums and class definitions
- **`errorMessages.ts`**: User-friendly message templates and formatting
- **`retryManager.ts`**: Retry logic with exponential backoff
- **`index.ts`**: Convenience exports and utility functions

## Usage

### 1. Creating Errors

```typescript
import { APIError, MCPError, NetworkError } from '@/errors';

// Create specific error types
throw APIError.rateLimitExceeded(5000); // 5 second retry
throw APIError.authFailed('Invalid API key');
throw MCPError.connectionFailed('my-server');
throw NetworkError.timeout();
```

### 2. Error Messages

```typescript
import { formatErrorAsMarkdown, buildUserMessage } from '@/errors';

try {
  // ... some operation
} catch (error) {
  // Get user-friendly message
  const userMsg = buildUserMessage(error);
  
  // Format for chat display with expandable details
  const markdown = formatErrorAsMarkdown(error, {
    serverName: 'MyServer',
    toolName: 'myTool',
  });
  
  console.log(markdown);
  // **⚠️ Unable to connect to MyServer. Retrying...**
  //
  // **What you can do:**
  // - The system will automatically retry the connection
  // - Check your internet connection
  //
  // <details>
  // <summary>Technical Details</summary>
  // ...
  // </details>
}
```

### 3. Automatic Retry

```typescript
import { createRetryManager, RetryPresets } from '@/errors';

// Create retry manager with standard config
const retryManager = createRetryManager({
  ...RetryPresets.Standard,
  onRetry: (attempt, delay, error) => {
    console.log(`Retry attempt ${attempt} after ${delay}ms`);
  },
  onCountdown: (remainingMs, attempt) => {
    console.log(`Retrying in ${Math.ceil(remainingMs / 1000)}s...`);
  },
});

// Execute with automatic retry
const result = await retryManager.execute(async () => {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) {
    throw APIError.serverError(response.status);
  }
  return response.json();
});
```

### 4. Parsing Generic Errors

```typescript
import { parseError } from '@/errors';

try {
  // ... operation that might throw
} catch (error) {
  // Convert to typed error
  const typedError = parseError(error, {
    context: 'mcp',
    serverName: 'my-server',
    statusCode: 429,
  });
  
  // Now it's a properly typed error with user-friendly messages
  throw typedError;
}
```

### 5. Stream Integration (AI Responses)

```typescript
import { formatErrorInline, formatRetryCountdown } from '@/errors';

// In AI stream handler
try {
  // ... streaming
} catch (error) {
  const typedError = parseError(error);
  
  if (isRetryableError(typedError)) {
    // Show retry message
    writer.write({
      type: 'text-delta',
      delta: formatRetryCountdown(5, 1, 3), // 5 seconds, attempt 1 of 3
    });
    
    // Wait and retry...
  } else {
    // Show error inline
    writer.write({
      type: 'text-delta',
      delta: formatErrorInline(typedError),
    });
  }
}
```

## Error Types

### API Errors (`APIError`)

- `API_RATE_LIMIT` - Rate limit exceeded (429)
- `API_QUOTA_EXCEEDED` - Quota exceeded (403)
- `API_AUTH_FAILED` - Authentication failed (401)
- `API_MALFORMED_FUNCTION_CALL` - Invalid function call from AI
- `API_SERVER_ERROR` - Server error (500, 502, 503, 504)

### MCP Errors (`MCPError`)

- `MCP_CONNECTION_FAILED` - Cannot connect to MCP server
- `MCP_AUTH_FAILED` - MCP authentication failed
- `MCP_TOOL_EXECUTION_FAILED` - MCP tool failed to execute
- `MCP_SERVER_UNAVAILABLE` - MCP server unavailable (503)

### Network Errors (`NetworkError`)

- `NETWORK_TIMEOUT` - Request timed out
- `NETWORK_CONNECTION_RESET` - Connection reset
- `NETWORK_DNS_FAILED` - DNS resolution failed

### Browser API Errors (`BrowserAPIError`)

- `BROWSER_PERMISSION_DENIED` - Permission denied
- `BROWSER_AUDIO_CONTEXT_ERROR` - Audio context error
- `BROWSER_STORAGE_QUOTA_EXCEEDED` - Storage quota exceeded
- `BROWSER_TAB_ACCESS_DENIED` - Tab access denied

### External Service Errors (`ExternalServiceError`)

- `EXTERNAL_YOUTUBE_API_ERROR` - YouTube API error
- `EXTERNAL_SERVICE_UNAVAILABLE` - External service unavailable

## Retry Presets

```typescript
import { RetryPresets } from '@/errors';

// Quick retry (3 attempts, 500ms initial delay)
RetryPresets.Quick

// Standard retry (3 attempts, 1s initial delay)
RetryPresets.Standard

// Aggressive retry (5 attempts, 2s initial delay)
RetryPresets.Aggressive

// Rate-limited retry (2 attempts, 5s initial delay)
RetryPresets.RateLimited

// No retry (for debugging)
RetryPresets.NoRetry
```

## Best Practices

1. **Always use typed errors**: Use the specific error classes instead of generic `Error`
2. **Provide context**: Include relevant metadata (server name, tool name, etc.)
3. **Let the system retry**: Use `RetryManager` for transient errors
4. **Show user-friendly messages**: Use `formatErrorAsMarkdown` or `buildUserMessage`
5. **Log technical details**: Keep technical details in expandable sections
6. **Respect rate limits**: The retry manager automatically handles `Retry-After` headers

## Examples

### API Call with Retry

```typescript
import { createRetryManager, APIError, formatErrorInline } from '@/errors';

async function callAPI() {
  const retry = createRetryManager({
    maxRetries: 3,
    onCountdown: (ms, attempt) => {
      updateUI(`Retrying in ${Math.ceil(ms / 1000)}s...`);
    },
  });

  return retry.execute(async () => {
    const response = await fetch('https://api.example.com', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw APIError.rateLimitExceeded(
        retryAfter ? parseInt(retryAfter) * 1000 : undefined
      );
    }

    if (response.status === 401) {
      throw APIError.authFailed('Invalid API key');
    }

    if (!response.ok) {
      throw APIError.serverError(response.status);
    }

    return response.json();
  });
}
```

### MCP Tool Execution

```typescript
import { MCPError, parseError, formatErrorAsMarkdown } from '@/errors';

async function executeMCPTool(serverName: string, toolName: string, args: any) {
  try {
    const result = await mcpClient.callTool(serverName, toolName, args);
    return result;
  } catch (error) {
    const typedError = parseError(error, {
      context: 'mcp',
      serverName,
      toolName,
    });

    // Display in UI
    displayError(formatErrorAsMarkdown(typedError));
    
    throw typedError;
  }
}
```

## Future Enhancements

- Error analytics and monitoring
- Internationalization (i18n) support
- Error simulation for testing
- Custom error recovery strategies
- Error reporting (opt-in)
