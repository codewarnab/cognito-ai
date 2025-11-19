/**
 * Error handling and categorization for MCP SSE connections
 */

import { MCPError, NetworkError, ErrorType } from '../../errors/errorTypes';
import { buildUserMessage } from '../../errors/errorMessages';
import { createLogger } from '@logger';
import type { McpConnectionState } from '../types';

const authLog = createLogger('MCP-Auth', 'MCP_AUTH');

export interface ErrorHandlerCallbacks {
    updateStatus: (state: McpConnectionState, error?: string) => void;
}

export class ErrorHandler {
    constructor(
        private serverId: string,
        private callbacks: ErrorHandlerCallbacks
    ) { }

    /**
     * Handle error responses from fetch with proper categorization
     * 
     * Handles:
     * - 401: Authentication errors (invalid/expired token)
     * - 403: Quota/scope errors
     * - 429: Rate limiting
     * - 500-504: Server errors
     * - Network errors
     */
    async handleErrorResponse(response: Response): Promise<void> {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        authLog.error(`[${this.serverId}] Connection failed:`, response.status, errorText);

        // Parse rate limit headers
        const retryAfter = response.headers.get('Retry-After');

        switch (response.status) {
            case 401: {
                // Authentication error - distinguish between format and expiry
                let errorData: any;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: 'unknown', error_description: errorText };
                }

                if (errorData.error === 'invalid_token' && errorData.error_description?.includes('Invalid token format')) {
                    // Token format is wrong - don't try to refresh, need re-auth
                    const error = MCPError.authFailed(
                        this.serverId,
                        `Invalid token format: ${errorData.error_description}`
                    );
                    this.callbacks.updateStatus('invalid-token', buildUserMessage(error));
                    throw error;
                } else {
                    // Token expired or other auth issue - might be refreshable
                    const error = MCPError.authFailed(
                        this.serverId,
                        `Authentication failed: ${errorText}`
                    );
                    this.callbacks.updateStatus('needs-auth', buildUserMessage(error));
                    throw error;
                }
            }

            case 403: {
                // Quota or scope error
                const error = MCPError.authFailed(
                    this.serverId,
                    `Access forbidden (quota exceeded or insufficient scopes): ${errorText}`
                );
                this.callbacks.updateStatus('error', buildUserMessage(error));
                throw error;
            }

            case 429: {
                // Rate limiting
                const retryAfterMs = retryAfter
                    ? parseInt(retryAfter, 10) * 1000
                    : 60000; // Default 60s if not specified

                const error = new MCPError({
                    message: `Rate limit exceeded for ${this.serverId}`,
                    statusCode: 429,
                    retryable: true,
                    retryAfter: retryAfterMs,
                    userMessage: `Rate limit exceeded for ${this.serverId}. Retrying in ${Math.ceil(retryAfterMs / 1000)}s...`,
                    technicalDetails: `Rate limit exceeded. Retry after ${retryAfterMs}ms`,
                    errorCode: ErrorType.MCP_SERVER_UNAVAILABLE,
                    serverName: this.serverId,
                });

                const errorMessage = buildUserMessage(error, {
                    seconds: Math.ceil(retryAfterMs / 1000).toString(),
                });
                this.callbacks.updateStatus('error', errorMessage);
                throw error;
            }

            case 500:
            case 502:
            case 503:
            case 504: {
                // Server errors - retryable
                const error = new MCPError({
                    message: `Server error ${response.status} for ${this.serverId}`,
                    statusCode: response.status,
                    retryable: true,
                    userMessage: `${this.serverId} is temporarily unavailable. Retrying...`,
                    technicalDetails: `Server error ${response.status}: ${errorText}`,
                    errorCode: ErrorType.MCP_SERVER_UNAVAILABLE,
                    serverName: this.serverId,
                });

                this.callbacks.updateStatus('error', buildUserMessage(error));
                throw error;
            }

            default: {
                // Other HTTP errors
                const error = new MCPError({
                    message: `HTTP ${response.status} error for ${this.serverId}`,
                    statusCode: response.status,
                    retryable: false,
                    userMessage: `Connection failed to ${this.serverId}`,
                    technicalDetails: `HTTP ${response.status}: ${errorText}`,
                    errorCode: ErrorType.MCP_CONNECTION_FAILED,
                    serverName: this.serverId,
                });
                throw error;
            }
        }
    }

    /**
     * Categorize connection errors for proper handling
     * 
     * Determines error type and retry eligibility based on error characteristics
     */
    categorizeConnectionError(error: unknown): MCPError | NetworkError {
        const errMessage = error instanceof Error ? error.message : String(error);
        const errName = error instanceof Error ? error.name : 'Error';

        // Network-specific errors
        if (errName === 'TypeError' || errMessage.includes('Failed to fetch')) {
            return NetworkError.connectionReset(
                `Network error connecting to ${this.serverId}: ${errMessage}`
            );
        }

        if (errMessage.includes('timeout') || errMessage.includes('ETIMEDOUT')) {
            return NetworkError.timeout(
                `Connection timeout to ${this.serverId}: ${errMessage}`
            );
        }

        if (errMessage.includes('ECONNREFUSED')) {
            return MCPError.connectionFailed(
                this.serverId,
                `Connection refused: ${errMessage}`
            );
        }

        if (errMessage.includes('DNS') || errMessage.includes('ENOTFOUND')) {
            return NetworkError.dnsFailed(
                `DNS resolution failed for ${this.serverId}: ${errMessage}`
            );
        }

        // MCP-specific errors (already categorized)
        if (error instanceof MCPError) {
            return error;
        }

        // Default: generic connection error
        return MCPError.connectionFailed(
            this.serverId,
            errMessage
        );
    }
}
