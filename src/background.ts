/**
 * MV3 Background Service Worker - Main Entry Point
 * 
 * Handles:
 * - Side panel initialization
 * - Extension lifecycle events
 * - Notion MCP OAuth and SSE connection
 */

import { McpSSEClient } from './mcp/notionClient';
import {
    generateState,
    createCodeVerifier,
    buildAuthUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    isTokenExpired,
    storeTokens,
    getStoredTokens,
    clearTokens
} from './mcp/oauth';
import type {
    NotionOAuthTokens,
    OAuthState,
    NotionMcpStatus,
    NotionMcpMessage,
    NotionMcpResponse,
    McpMessage
} from './mcp/types';
import { NOTION_CONFIG } from './constants';

// ============================================================================
// Notion MCP State
// ============================================================================

let notionMcpClient: McpSSEClient | null = null;
let notionTokens: NotionOAuthTokens | null = null;
let oauthState: OAuthState | null = null;
let notionStatus: NotionMcpStatus = { state: 'disconnected' };
let isEnabled = false;

// ============================================================================
// Notion MCP OAuth Functions
// ============================================================================

/**
 * Validate MCP client ID format (should be short alphanumeric, NOT a UUID)
 */
function validateMcpClientId(): void {
    const clientId = NOTION_CONFIG.OAUTH_CLIENT_ID;

    // Check if it looks like a UUID (with hyphens)
    if (clientId.includes('-') || clientId.length > 30) {
        throw new Error(
            'Invalid MCP client ID: appears to be an integration UUID. ' +
            'Use the MCP client ID from https://developers.notion.com/docs/mcp ' +
            '(short format like "Oh46dYkUrzferlRE")'
        );
    }

    // Check endpoints are correct
    if (NOTION_CONFIG.OAUTH_AUTH_URL.includes('api.notion.com')) {
        throw new Error(
            'Invalid OAuth endpoint: using api.notion.com instead of mcp.notion.com. ' +
            'Update NOTION_CONFIG to use MCP endpoints.'
        );
    }
}

/**
 * Start OAuth flow for Notion MCP with PKCE
 */
async function startNotionAuth(): Promise<NotionMcpResponse> {
    try {
        console.log('[Background] Starting Notion MCP OAuth flow (PKCE)');

        // Validate configuration before starting
        validateMcpClientId();

        // Generate state for CSRF protection
        const state = generateState();

        // Generate PKCE code verifier
        const codeVerifier = createCodeVerifier();

        // Store both in memory for the callback
        oauthState = {
            state,
            codeVerifier,
            created_at: Date.now()
        };

        // Build authorization URL with PKCE challenge
        const authUrl = await buildAuthUrl(state, codeVerifier);

        console.log('[Background] Launching OAuth with MCP URL:', authUrl);

        // Launch OAuth flow using Chrome Identity API
        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });

        if (!redirectUrl) {
            throw new Error('OAuth flow cancelled');
        }

        console.log('[Background] OAuth redirect URL:', redirectUrl);

        // Extract code and state from redirect URL
        const url = new URL(redirectUrl);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        if (!code) {
            throw new Error('No authorization code received');
        }

        // Verify state
        if (!oauthState || returnedState !== oauthState.state) {
            throw new Error('State mismatch - possible CSRF attack');
        }

        console.log('[Background] Exchanging code for tokens (PKCE)');

        // Exchange code for tokens using PKCE
        // Note: Notion MCP uses PKCE and may not require redirect_uri in token exchange
        const tokens = await exchangeCodeForTokens(
            code,
            oauthState.codeVerifier
            // Omitting redirect_uri - not needed for PKCE with code_verifier
        );

        // Store tokens
        notionTokens = tokens;
        await storeTokens(tokens);

        console.log('[Background] Tokens stored successfully');

        // Update status
        notionStatus = { state: 'authenticated' };
        broadcastStatusUpdate();

        console.log('[Background] Notion MCP OAuth successful');

        return { success: true, data: { state: 'authenticated' } };
    } catch (error) {
        console.error('[Background] Notion MCP OAuth error:', error);
        notionStatus = {
            state: 'error',
            error: error instanceof Error ? error.message : 'Authentication failed'
        };
        broadcastStatusUpdate();
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Authentication failed'
        };
    } finally {
        oauthState = null;
    }
}

/**
 * Refresh Notion access token
 */
async function refreshNotionToken(): Promise<boolean> {
    if (!notionTokens?.refresh_token) {
        console.error('[Background] No refresh token available');
        notionStatus = { state: 'needs-auth', error: 'No refresh token' };
        broadcastStatusUpdate();
        return false;
    }

    try {
        console.log('[Background] Refreshing Notion token');
        notionStatus = { state: 'token-refresh' };
        broadcastStatusUpdate();

        const newTokens = await refreshAccessToken(notionTokens.refresh_token);
        notionTokens = newTokens;
        await storeTokens(newTokens);

        notionStatus = { state: 'authenticated' };
        broadcastStatusUpdate();

        console.log('[Background] Token refreshed successfully');
        return true;
    } catch (error) {
        console.error('[Background] Token refresh failed:', error);
        // Clear invalid tokens
        await clearTokens();
        notionTokens = null;
        notionStatus = {
            state: 'needs-auth',
            error: 'Token refresh failed. Please re-authenticate.'
        };
        broadcastStatusUpdate();
        return false;
    }
}

/**
 * Ensure we have a valid access token
 */
async function ensureValidToken(): Promise<string | null> {
    if (!notionTokens) {
        // Try to load from storage
        notionTokens = await getStoredTokens();
    }

    if (!notionTokens) {
        return null;
    }

    // Check if token is expired
    if (isTokenExpired(notionTokens)) {
        const refreshed = await refreshNotionToken();
        if (!refreshed) {
            return null;
        }
    }

    return notionTokens.access_token;
}

// ============================================================================
// Notion MCP Connection Functions
// ============================================================================

/**
 * Connect to Notion MCP server
 */
async function connectNotionMcp(): Promise<NotionMcpResponse> {
    try {
        console.log('[Background] Connecting to Notion MCP');

        const accessToken = await ensureValidToken();
        if (!accessToken) {
            return {
                success: false,
                error: 'Authentication required'
            };
        }

        // Create SSE client
        notionMcpClient = new McpSSEClient(
            NOTION_CONFIG.MCP_SSE_URL,
            NOTION_CONFIG.MCP_BASE_URL,
            accessToken,
            {
                onStatusChange: (status) => {
                    notionStatus = status;
                    broadcastStatusUpdate();

                    // Handle token expiry
                    if (status.state === 'needs-auth') {
                        handleTokenExpiry();
                    }
                },
                onMessage: (message) => {
                    console.log('[Background] MCP message:', message);
                }
            }
        );

        // Connect
        await notionMcpClient.connect();

        // Initialize MCP protocol
        await notionMcpClient.initialize();

        return { success: true, data: notionMcpClient.getStatus() };
    } catch (error) {
        console.error('[Background] Notion MCP connection error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed'
        };
    }
}

/**
 * Disconnect from Notion MCP server
 */
function disconnectNotionMcp(): void {
    if (notionMcpClient) {
        notionMcpClient.disconnect();
        notionMcpClient = null;
    }
    notionStatus = { state: 'authenticated' };
    broadcastStatusUpdate();
}

/**
 * Handle token expiry - attempt refresh and reconnect
 */
async function handleTokenExpiry(): Promise<void> {
    console.log('[Background] Handling token expiry');

    // Disconnect current client
    if (notionMcpClient) {
        notionMcpClient.disconnect();
        notionMcpClient = null;
    }

    // Try to refresh
    const refreshed = await refreshNotionToken();

    // If enabled and refresh succeeded, reconnect
    if (refreshed && isEnabled) {
        await connectNotionMcp();
    }
}

/**
 * Enable Notion MCP (connect if authenticated)
 */
async function enableNotionMcp(): Promise<NotionMcpResponse> {
    isEnabled = true;

    // Store enabled state
    await chrome.storage.local.set({ 'mcp.notion.enabled': true });

    // If already connected, nothing to do
    if (notionMcpClient && notionStatus.state === 'connected') {
        return { success: true, data: notionStatus };
    }

    // If authenticated, connect
    if (notionTokens || await getStoredTokens()) {
        return await connectNotionMcp();
    }

    // Otherwise, need auth
    return {
        success: false,
        error: 'Authentication required. Please connect first.'
    };
}

/**
 * Disable Notion MCP (disconnect)
 */
async function disableNotionMcp(): Promise<NotionMcpResponse> {
    isEnabled = false;
    await chrome.storage.local.set({ 'mcp.notion.enabled': false });
    disconnectNotionMcp();
    return { success: true };
}

/**
 * Disconnect and clear authentication
 */
async function disconnectNotionAuth(): Promise<NotionMcpResponse> {
    disconnectNotionMcp();
    await clearTokens();
    notionTokens = null;
    notionStatus = { state: 'disconnected' };
    isEnabled = false;
    await chrome.storage.local.set({ 'mcp.notion.enabled': false });
    broadcastStatusUpdate();
    return { success: true };
}

/**
 * Get current Notion MCP status
 */
function getNotionStatus(): NotionMcpStatus {
    return notionStatus;
}

/**
 * Call a Notion MCP tool
 */
async function callNotionTool(name: string, args?: Record<string, any>): Promise<NotionMcpResponse> {
    if (!notionMcpClient) {
        return { success: false, error: 'Not connected' };
    }

    try {
        const result = await notionMcpClient.callTool(name, args);
        return { success: true, data: result };
    } catch (error) {
        console.error('[Background] Tool call error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Tool call failed'
        };
    }
}

/**
 * Broadcast status update to all listeners
 */
function broadcastStatusUpdate(): void {
    chrome.runtime.sendMessage({
        type: 'mcp/notion/status/update',
        payload: notionStatus
    }).catch(() => {
        // Ignore errors if no listeners
    });
}

// ============================================================================
// Message Handler
// ============================================================================

chrome.runtime.onMessage.addListener((message: NotionMcpMessage, sender, sendResponse) => {
    // Handle Notion MCP messages
    if (message.type?.startsWith('mcp/notion/')) {
        (async () => {
            let response: NotionMcpResponse;

            switch (message.type) {
                case 'mcp/notion/auth/start':
                    response = await startNotionAuth();
                    break;

                case 'mcp/notion/enable':
                    response = await enableNotionMcp();
                    break;

                case 'mcp/notion/disable':
                    response = await disableNotionMcp();
                    break;

                case 'mcp/notion/disconnect':
                    response = await disconnectNotionAuth();
                    break;

                case 'mcp/notion/status/get':
                    response = { success: true, data: getNotionStatus() };
                    break;

                case 'mcp/notion/tool/call':
                    response = await callNotionTool(
                        message.payload?.name,
                        message.payload?.arguments
                    );
                    break;

                default:
                    response = { success: false, error: 'Unknown message type' };
            }

            sendResponse(response);
        })();

        return true; // Will respond asynchronously
    }
});

// ============================================================================
// Runtime Listeners
// ============================================================================

/**
 * Extension install/update handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[Background] onInstalled:', details.reason);

    try {
        // Enable side panel on all existing tabs
        if (chrome.sidePanel) {
            chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
        }

        // Load saved state
        const stored = await chrome.storage.local.get(['mcp.notion.enabled']);
        isEnabled = stored['mcp.notion.enabled'] || false;

        // If enabled, try to restore connection
        if (isEnabled) {
            const tokens = await getStoredTokens();
            if (tokens) {
                notionTokens = tokens;
                await connectNotionMcp();
            }
        }

        console.log('[Background] Side panel configured');
    } catch (error) {
        console.error('[Background] onInstalled error:', error);
    }
});

/**
 * Extension startup handler
 */
chrome.runtime.onStartup.addListener(async () => {
    console.log('[Background] onStartup - Extension ready');

    // Load saved state
    const stored = await chrome.storage.local.get(['mcp.notion.enabled']);
    isEnabled = stored['mcp.notion.enabled'] || false;

    // If enabled, try to restore connection
    if (isEnabled) {
        const tokens = await getStoredTokens();
        if (tokens) {
            notionTokens = tokens;
            await connectNotionMcp();
        }
    }
});

/**
 * Action click handler - open side panel
 */
if (chrome.action) {
    chrome.action.onClicked.addListener(async (tab) => {
        if (chrome.sidePanel && tab.id) {
            try {
                await chrome.sidePanel.open({ tabId: tab.id });
            } catch (error) {
                console.error('[Background] Error opening side panel:', error);
            }
        }
    });
}

// ============================================================================
// Initialization
// ============================================================================

console.log('[Background] Service worker loaded - CopilotKit powered extension ready');

