/**
 * Error Cards - Specialized error display components
 * 
 * Different card variants for different error categories:
 * - AuthErrorCard: Authentication/API key issues (amber theme)
 * - RateLimitErrorCard: Rate limiting/quota errors (blue theme with countdown)
 * - NetworkErrorCard: Network/connection issues (cyan theme)
 * - MCPErrorCard: MCP server errors (purple theme)
 * - StorageErrorCard: Storage/quota errors (emerald theme)
 * - BrowserErrorCard: Browser API errors (slate theme)
 * - GenericErrorCard: Fallback for unknown errors (red theme)
 */

// Main factory component - use this to auto-select the right card
export { ErrorCardFactory } from './ErrorCardFactory';

// Individual card components (for direct use if needed)
export { AuthErrorCard } from './AuthErrorCard';
export { RateLimitErrorCard } from './RateLimitErrorCard';
export { NetworkErrorCard } from './NetworkErrorCard';
export { MCPErrorCard } from './MCPErrorCard';
export { StorageErrorCard } from './StorageErrorCard';
export { BrowserErrorCard } from './BrowserErrorCard';
export { GenericErrorCard } from './GenericErrorCard';

// Types and utilities
export {
    type ErrorCardData,
    type BaseErrorCardProps,
    ErrorCategory,
    getErrorCategory,
    formatRetryAfter,
} from './types';
