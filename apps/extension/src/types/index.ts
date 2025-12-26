/**
 * Central type export point
 * All types should be exported from here for easy imports
 */

// Chrome API types
export * from './chrome';

// AI-related types
export * from './ai';

// Component types
export * from './components';

// Database types
export * from './database';

// MCP types
export * from './mcp';

// Workflow types
export * from './workflows';

// Event types
export * from './events';

// Messaging types (type-safe messaging system)
// Note: Both events and messaging export isTypedMessage - we prefer the events version
export {
    type MessageDefinition,
    type MessageRegistry,
    type MessageType,
    type MessagePayload,
    type MessageResponse,
    type TypedMessage,
    type NoPayloadMessageType,
    type PayloadMessageType,
    isMessageType,
} from './messaging';

// Re-export MCP and port message types from messaging
export * from './messaging/mcp';
export * from './messaging/ports';

// Utility types
export * from './utils';

// Bookmarks types
export * from './bookmarks';

// Text Summarizer types
export * from './textSummarizer';

// Write Command types
export * from './writeCommand';

// Rewrite Command types
export * from './rewriteCommand';

// Keep existing sidepanel types
export * from './sidepanel';

// Logger types are exported from @cognito/shared, not from a local module
// Use: import type { LogCategory, LoggerConfig } from '@cognito/shared';

// assets.d.ts contains ambient module declarations and doesn't need to be re-exported
