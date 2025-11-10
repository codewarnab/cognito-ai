/**
 * MCP Consent Manager
 * Manages per-client consent decisions to prevent confused deputy attacks
 * 
 * Per MCP Security Best Practices:
 * - Maintains registry of approved client_id values per user
 * - Stores consent decisions securely (server-side database, or server specific cookies)
 * - Validates consent before initiating third-party authorization flow
 */

import { createLogger } from '../logger';

const log = createLogger('MCP-Consent', 'MCP_AUTH');

export interface ConsentRecord {
    serverId: string;
    clientId: string;
    redirectUri: string;
    scopes: string[];
    grantedAt: number;
    expiresAt: number; // Consent expires after 90 days
}

const CONSENT_EXPIRY = 90 * 24 * 60 * 60 * 1000; // 90 days

/**
 * Get storage key for consent records
 */
function getConsentKey(serverId: string): string {
    return `mcp.${serverId}.consent.approved`;
}

/**
 * Check if user has previously consented to this client configuration
 */
export async function hasConsent(
    serverId: string,
    clientId: string,
    redirectUri: string
): Promise<boolean> {
    try {
        const key = getConsentKey(serverId);
        const result = await chrome.storage.local.get(key);
        const records: ConsentRecord[] = result[key] || [];

        const now = Date.now();

        // Find matching consent that hasn't expired
        const consent = records.find(r =>
            r.clientId === clientId &&
            r.redirectUri === redirectUri &&
            r.expiresAt > now
        );

        if (consent) {
            log.info(`[${serverId}] Valid consent found for client ${clientId.substring(0, 8)}...`);
            return true;
        }

        log.info(`[${serverId}] No valid consent found for client ${clientId.substring(0, 8)}...`);
        return false;
    } catch (error) {
        log.error(`[${serverId}] Error checking consent:`, error);
        return false;
    }
}

/**
 * Store user consent for a client configuration
 */
export async function storeConsent(
    serverId: string,
    clientId: string,
    redirectUri: string,
    scopes: string[]
): Promise<void> {
    try {
        const key = getConsentKey(serverId);
        const result = await chrome.storage.local.get(key);
        let records: ConsentRecord[] = result[key] || [];

        const now = Date.now();

        // Remove expired consents and existing consent for this client
        records = records.filter(r =>
            r.expiresAt > now &&
            !(r.clientId === clientId && r.redirectUri === redirectUri)
        );

        // Add new consent
        const newConsent: ConsentRecord = {
            serverId,
            clientId,
            redirectUri,
            scopes,
            grantedAt: now,
            expiresAt: now + CONSENT_EXPIRY
        };

        records.push(newConsent);

        await chrome.storage.local.set({ [key]: records });

        log.info(`[${serverId}] Consent stored for client ${clientId.substring(0, 8)}... (expires in 90 days)`);
    } catch (error) {
        log.error(`[${serverId}] Error storing consent:`, error);
        throw error;
    }
}

/**
 * Revoke consent for a server (called during disconnect)
 */
export async function revokeConsent(serverId: string): Promise<void> {
    try {
        const key = getConsentKey(serverId);
        await chrome.storage.local.remove(key);
        log.info(`[${serverId}] All consent records revoked`);
    } catch (error) {
        log.error(`[${serverId}] Error revoking consent:`, error);
    }
}

/**
 * Get all consent records for a server (for debugging/management UI)
 */
export async function getConsentRecords(serverId: string): Promise<ConsentRecord[]> {
    try {
        const key = getConsentKey(serverId);
        const result = await chrome.storage.local.get(key);
        return result[key] || [];
    } catch (error) {
        log.error(`[${serverId}] Error getting consent records:`, error);
        return [];
    }
}

/**
 * Validate redirect URI matches exactly (no wildcards, no pattern matching)
 * Per MCP spec: Use exact string matching
 */
export function validateRedirectUri(
    registeredUri: string,
    requestUri: string
): boolean {
    // Exact string match only - no wildcards, no patterns
    const isValid = registeredUri === requestUri;

    if (!isValid) {
        log.warn('Redirect URI mismatch:', {
            registered: registeredUri,
            request: requestUri
        });
    }

    return isValid;
}
