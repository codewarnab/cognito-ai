/**
 * Type definitions for Side Panel components
 * 
 * @deprecated These types are now exported from their respective modules:
 * - ChatMode -> components/chat
 * - TabContext -> chrome/tabs
 * - ContextWarningState -> components/chat
 * 
 * This file is kept for backward compatibility but may be removed in the future.
 */

// Re-export from proper locations for backward compatibility
export type { ChatMode, ContextWarningState } from './components/chat';
export type { TabContext } from './chrome/tabs';
