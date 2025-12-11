# Error Handling Standards

## Critical Rules
- Never use empty catch blocks; always log errors with context
- Validate API response structure before accessing properties
- Always use `APIError` instead of generic `Error` for consistency
- Wrap initialization logic in try-catch blocks
- Wrap all external I/O operations in try-catch blocks
- Null-check error objects before accessing properties: `error?.message || 'Unknown error'`
- Remove debug logging of raw error objects (may contain sensitive data)

## API Errors
- Include: statusCode, retryable flag, userMessage, technicalDetails, errorCode
- Provide user-facing messages via `apiErrorHandler` toast mapping
- Check `chrome.runtime.lastError` in all Chrome API callbacks

## Async Operations
- Wrap async switch/case statements in try-catch to ensure response callbacks execute
- Add timeout guards to Promises interacting with external systems
- Use `Promise.race()` with timeout to prevent indefinite hangs
- Clean up event listeners in both success and error paths
- Wrap storage persistence calls in try-catch; revert UI state on failure
