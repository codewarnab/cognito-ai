/**
 * MCP PAT Validation Helpers
 * 
 * Validates Personal Access Tokens against configurable validation endpoints.
 */

import { createLogger } from '~logger';
import type { PatConfig } from '@/constants/mcpServers';

const log = createLogger('MCP-Validation', 'MCP_AUTH_OAUTH');

export interface ValidationResult {
    valid: boolean;
    error?: string;
    userData?: Record<string, unknown>;
}

/**
 * Validate a Personal Access Token against the configured validation URL
 * 
 * @param patConfig - PAT configuration containing validation URL and settings
 * @param token - The token to validate
 * @returns Validation result with success status and optional user data
 */
export async function validatePat(
    patConfig: PatConfig,
    token: string
): Promise<ValidationResult> {
    if (!patConfig.validationUrl) {
        // No validation URL configured = assume valid
        log.info('No validation URL configured, assuming token is valid');
        return { valid: true };
    }

    if (!token || token.trim() === '') {
        return { valid: false, error: 'Token is required' };
    }

    try {
        log.info(`Validating PAT against ${patConfig.validationUrl}`);

        const headers: Record<string, string> = {
            ...(patConfig.authHeaderName
                ? { [patConfig.authHeaderName]: token }
                : { 'Authorization': `Bearer ${token}` }),
            'Accept': 'application/json',
            'User-Agent': 'Cognito-AI-Extension',
            ...patConfig.validationHeaders
        };

        const response = await fetch(patConfig.validationUrl, {
            method: patConfig.validationMethod || 'GET',
            headers
        });

        if (response.ok) {
            let userData: Record<string, unknown> | undefined;
            try {
                userData = await response.json();
            } catch {
                // Response may not be JSON, that's fine
            }
            log.info('PAT validation successful', userData ? { username: userData.login || userData.name } : {});
            return { valid: true, userData };
        }

        const errorText = await response.text().catch(() => '');
        log.warn('PAT validation failed:', { status: response.status, error: errorText.slice(0, 200) });

        if (response.status === 401) {
            return {
                valid: false,
                error: 'Invalid token. Please check your token and try again.'
            };
        }

        if (response.status === 403) {
            return {
                valid: false,
                error: 'Token does not have required permissions.'
            };
        }

        return {
            valid: false,
            error: `Validation failed: ${response.statusText || 'Unknown error'}`
        };
    } catch (error) {
        log.error('PAT validation error:', error);

        if (error instanceof TypeError && error.message.includes('fetch')) {
            return {
                valid: false,
                error: 'Network error. Please check your internet connection.'
            };
        }

        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Validation failed'
        };
    }
}
