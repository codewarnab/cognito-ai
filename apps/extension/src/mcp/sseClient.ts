/**
 * Generic MCP SSE Client
 * Handles Server-Sent Events connection to MCP servers
 * 
 * Enhanced with comprehensive error handling:
 * - Automatic retry with exponential backoff
 * - Detailed error categorization (network, auth, server errors)
 * - Rate limit detection and handling
 * - Connection recovery and reconnection
 * 
 * @deprecated This file has been refactored into multiple files in ./client/
 * Import from './client' instead for better maintainability
 */

// Re-export from the new modular structure
export { McpSSEClient } from './client';
export type { SSEClientConfig } from './client';

// Legacy implementation removed - all functionality moved to ./client/
// The original 600+ line file has been split into focused modules:
// - config.ts: Configuration and defaults
// - errorHandler.ts: Error handling and categorization
// - messageHandler.ts: Message routing and pending requests
// - requestManager.ts: Request/notification sending with timeout
// - streamProcessor.ts: SSE stream processing
// - transportDetector.ts: Transport detection (POST/GET fallback)
// - connectionManager.ts: Connection/reconnection logic
// - McpSSEClient.ts: Main orchestrator class
