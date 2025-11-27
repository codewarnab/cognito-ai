/**
 * Supermemory Utilities
 * Exports all Supermemory-related utility functions.
 */

// User ID management
export {
    getSupermemoryUserId,
    hasSupermemoryUserId,
    resetSupermemoryUserId
} from './userId';

// Credentials and configuration management
export {
    getSupermemoryApiKey,
    setSupermemoryApiKey,
    clearSupermemoryApiKey,
    hasSupermemoryApiKey,
    isSupermemoryEnabled,
    setSupermemoryEnabled,
    isSupermemoryReady,
    validateSupermemoryApiKeyFormat
} from './credentials';
