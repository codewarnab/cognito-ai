/**
 * SSE Client configuration with retry and error handling options
 */
export interface SSEClientConfig {
    reconnectMinDelay: number;
    reconnectMaxDelay: number;
    reconnectMultiplier: number;
    /** Maximum number of reconnection attempts before giving up */
    maxReconnectAttempts?: number;
    /** Timeout for individual requests in milliseconds */
    requestTimeout?: number;
    /** Custom HTTP headers to include with all requests (for non-OAuth servers) */
    customHeaders?: Record<string, string>;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<Omit<SSEClientConfig, 'customHeaders'>> & { customHeaders?: Record<string, string> } = {
    reconnectMinDelay: 500,
    reconnectMaxDelay: 30000,
    reconnectMultiplier: 2,
    maxReconnectAttempts: 5,
    requestTimeout: 30000,
    customHeaders: undefined,
};

/**
 * Merge user config with defaults
 */
export function mergeConfig(config?: Partial<SSEClientConfig>): Required<Omit<SSEClientConfig, 'customHeaders'>> & { customHeaders?: Record<string, string> } {
    return {
        reconnectMinDelay: config?.reconnectMinDelay ?? DEFAULT_CONFIG.reconnectMinDelay,
        reconnectMaxDelay: config?.reconnectMaxDelay ?? DEFAULT_CONFIG.reconnectMaxDelay,
        reconnectMultiplier: config?.reconnectMultiplier ?? DEFAULT_CONFIG.reconnectMultiplier,
        maxReconnectAttempts: config?.maxReconnectAttempts ?? DEFAULT_CONFIG.maxReconnectAttempts,
        requestTimeout: config?.requestTimeout ?? DEFAULT_CONFIG.requestTimeout,
        customHeaders: config?.customHeaders,
    };
}
