/**
 * Scope Challenge Handler for MCP OAuth
 * Implements step-up authorization per MCP specification
 */

import type { ScopeChallenge, McpServerOAuthConfig } from './types';
import { parseScopeChallenge } from './discovery';

/**
 * Storage key for challenged scopes
 */
function getChallengedScopesKey(serverId: string): string {
    return `oauth.${serverId}.challenged_scopes`;
}

/**
 * Storage key for granted scopes
 */
function getGrantedScopesKey(serverId: string): string {
    return `oauth.${serverId}.granted_scopes`;
}

/**
 * Store challenged scopes for a server
 */
export async function storeChallengedScopes(serverId: string, scopes: string[]): Promise<void> {
    const key = getChallengedScopesKey(serverId);
    await chrome.storage.local.set({ [key]: scopes });
    console.log(`[ScopeHandler:${serverId}] Stored challenged scopes:`, scopes);
}

/**
 * Get challenged scopes for a server
 */
export async function getChallengedScopes(serverId: string): Promise<string[] | null> {
    const key = getChallengedScopesKey(serverId);
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
}

/**
 * Store granted scopes for a server
 */
export async function storeGrantedScopes(serverId: string, scopes: string[]): Promise<void> {
    const key = getGrantedScopesKey(serverId);
    await chrome.storage.local.set({ [key]: scopes });
    console.log(`[ScopeHandler:${serverId}] Stored granted scopes:`, scopes);
}

/**
 * Get granted scopes for a server
 */
export async function getGrantedScopes(serverId: string): Promise<string[] | null> {
    const key = getGrantedScopesKey(serverId);
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
}

/**
 * Clear all scope data for a server
 */
export async function clearScopeData(serverId: string): Promise<void> {
    await chrome.storage.local.remove([
        getChallengedScopesKey(serverId),
        getGrantedScopesKey(serverId)
    ]);
}

/**
 * Parse scope string into array
 */
export function parseScopeString(scopeString: string): string[] {
    return scopeString
        .split(/\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

/**
 * Join scope array into string
 */
export function joinScopes(scopes: string[]): string {
    return scopes.join(' ');
}

/**
 * Merge scopes, removing duplicates and preserving order
 */
export function mergeScopes(scopes1: string[], scopes2: string[]): string[] {
    const merged = [...scopes1];
    
    for (const scope of scopes2) {
        if (!merged.includes(scope)) {
            merged.push(scope);
        }
    }
    
    return merged;
}

/**
 * Select scopes for authorization request
 * 
 * Priority:
 * 1. Scopes from WWW-Authenticate challenge (if present)
 * 2. Previously granted scopes + new required scopes (for re-auth)
 * 3. Default scopes from server config
 * 4. Empty (let server decide)
 */
export async function selectScopes(
    serverId: string,
    serverConfig?: McpServerOAuthConfig,
    challenge?: ScopeChallenge
): Promise<string[]> {
    console.log(`[ScopeHandler:${serverId}] Selecting scopes for authorization`);
    
    let selectedScopes: string[] = [];
    
    // Priority 1: Challenge scopes (insufficient_scope error)
    if (challenge?.scope) {
        const challengedScopes = parseScopeString(challenge.scope);
        console.log(`[ScopeHandler:${serverId}] Using scopes from challenge:`, challengedScopes);
        
        // Include previously granted scopes if available
        const grantedScopes = await getGrantedScopes(serverId);
        if (grantedScopes && grantedScopes.length > 0) {
            selectedScopes = mergeScopes(grantedScopes, challengedScopes);
            console.log(`[ScopeHandler:${serverId}] Merged with granted scopes:`, selectedScopes);
        } else {
            selectedScopes = challengedScopes;
        }
        
        // Store challenged scopes for tracking
        await storeChallengedScopes(serverId, challengedScopes);
        
        return selectedScopes;
    }
    
    // Priority 2: Re-authorization with granted + challenged scopes
    const [grantedScopes, challengedScopes] = await Promise.all([
        getGrantedScopes(serverId),
        getChallengedScopes(serverId)
    ]);
    
    if (grantedScopes && challengedScopes) {
        selectedScopes = mergeScopes(grantedScopes, challengedScopes);
        console.log(`[ScopeHandler:${serverId}] Re-auth: using granted + challenged:`, selectedScopes);
        return selectedScopes;
    }
    
    if (grantedScopes && grantedScopes.length > 0) {
        console.log(`[ScopeHandler:${serverId}] Re-auth: using granted scopes:`, grantedScopes);
        return grantedScopes;
    }
    
    // Priority 3: Default scopes from server config
    if (serverConfig?.scopes && serverConfig.scopes.length > 0) {
        console.log(`[ScopeHandler:${serverId}] Using default config scopes:`, serverConfig.scopes);
        return serverConfig.scopes;
    }
    
    // Priority 4: Empty (let server decide)
    console.log(`[ScopeHandler:${serverId}] No scopes specified, letting server decide`);
    return [];
}

/**
 * Handle WWW-Authenticate challenge from response
 * Returns the challenge if it's an insufficient_scope error
 */
export function handleWwwAuthenticateHeader(
    serverId: string,
    response: Response
): ScopeChallenge | null {
    const wwwAuth = response.headers.get('WWW-Authenticate');
    
    if (!wwwAuth) {
        return null;
    }
    
    const challenge = parseScopeChallenge(wwwAuth);
    
    if (!challenge) {
        return null;
    }
    
    console.log(`[ScopeHandler:${serverId}] WWW-Authenticate challenge:`, challenge);
    
    // Check if it's an insufficient_scope error
    if (challenge.error === 'insufficient_scope') {
        console.log(`[ScopeHandler:${serverId}] Insufficient scope error detected`);
        return challenge;
    }
    
    return challenge;
}

/**
 * Check if response indicates insufficient scope
 */
export function isInsufficientScopeError(response: Response): boolean {
    if (response.status !== 401 && response.status !== 403) {
        return false;
    }
    
    const wwwAuth = response.headers.get('WWW-Authenticate');
    if (!wwwAuth) {
        return false;
    }
    
    const challenge = parseScopeChallenge(wwwAuth);
    return challenge?.error === 'insufficient_scope';
}

/**
 * Update granted scopes after successful token exchange
 * Store the actual scopes that were granted
 */
export async function updateGrantedScopes(
    serverId: string,
    scopeString?: string
): Promise<void> {
    if (!scopeString) {
        console.log(`[ScopeHandler:${serverId}] No scope returned from token response`);
        return;
    }
    
    const scopes = parseScopeString(scopeString);
    await storeGrantedScopes(serverId, scopes);
    
    // Clear challenged scopes after successful grant
    const key = getChallengedScopesKey(serverId);
    await chrome.storage.local.remove(key);
}

