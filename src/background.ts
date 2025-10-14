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
    registerDynamicClient,
    generateState,
    createCodeVerifier,
    buildAuthUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    isTokenExpired,
    storeTokens,
    getStoredTokens,
    clearTokens,
    storeClientCredentials,
    getStoredClientCredentials,
    clearClientCredentials,
    type DynamicClientCredentials
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
let notionClientCredentials: DynamicClientCredentials | null = null;
let oauthState: OAuthState | null = null;
let notionStatus: NotionMcpStatus = { state: 'disconnected' };
let isEnabled = false;

// ============================================================================
// Notion MCP OAuth Functions
// ============================================================================

/**
 * Validate MCP client ID format (should be short alphanumeric, NOT a UUID)
 */
// function validateMcpClientId(): void {
//     const clientId = NOTION_CONFIG.OAUTH_CLIENT_ID;

//     // Check if it looks like a UUID (with hyphens)
//     if (clientId.includes('-') || clientId.length > 30) {
//         throw new Error(
//             'Invalid MCP client ID: appears to be an integration UUID. ' +
//             'Use the MCP client ID from https://developers.notion.com/docs/mcp ' +
//             '(short format like "Oh46dYkUrzferlRE")'
//         );
//     }

//     // Check endpoints are correct
//     if (NOTION_CONFIG.OAUTH_AUTH_URL.includes('api.notion.com')) {
//         throw new Error(
//             'Invalid OAuth endpoint: using api.notion.com instead of mcp.notion.com. ' +
//             'Update NOTION_CONFIG to use MCP endpoints.'
//         );
//     }
// }

/**
 * Start OAuth flow for Notion MCP with dynamic client registration
 */
async function startNotionAuth(): Promise<NotionMcpResponse> {
    try {
        console.log('[Background] Starting Notion OAuth flow with dynamic client registration');

        // Step 1: Register a dynamic client
        console.log('[Background] Registering dynamic client...');
        notionStatus = { state: 'registering' };
        broadcastStatusUpdate();

        const clientCredentials = await registerDynamicClient(NOTION_CONFIG.OAUTH_REDIRECT_URI);
        
        // Store client credentials
        notionClientCredentials = clientCredentials;
        await storeClientCredentials(clientCredentials);

        console.log('[Background] Dynamic client registered:', clientCredentials.client_id);

        // Step 2: Generate state for CSRF protection
        const state = generateState();

        // Store state in memory for the callback
        oauthState = {
            state,
            codeVerifier: '', // Not needed for standard OAuth
            created_at: Date.now()
        };

        // Step 3: Build authorization URL using the dynamic client ID
        const authUrl = buildAuthUrl(
            clientCredentials.client_id,
            NOTION_CONFIG.OAUTH_REDIRECT_URI,
            state
        );

        console.log('[Background] Launching OAuth with URL:', authUrl);

        // Update status
        notionStatus = { state: 'authorizing' };
        broadcastStatusUpdate();

        // Step 4: Launch OAuth flow using Chrome Identity API
        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });

        if (!redirectUrl) {
            throw new Error('OAuth flow cancelled');
        }

        console.log('[Background] OAuth redirect URL:', redirectUrl);

        // Step 5: Extract code and state from redirect URL
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

        console.log('[Background] Exchanging code for tokens');

        // Step 6: Exchange code for tokens using dynamic client credentials
        const tokens = await exchangeCodeForTokens(
            code,
            clientCredentials.client_id,
            clientCredentials.client_secret,
            NOTION_CONFIG.OAUTH_REDIRECT_URI
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

    // Load client credentials if not in memory
    if (!notionClientCredentials) {
        notionClientCredentials = await getStoredClientCredentials();
    }

    if (!notionClientCredentials) {
        console.error('[Background] No client credentials available for token refresh');
        notionStatus = { state: 'needs-auth', error: 'No client credentials' };
        broadcastStatusUpdate();
        return false;
    }

    try {
        console.log('[Background] Refreshing Notion token');
        notionStatus = { state: 'token-refresh' };
        broadcastStatusUpdate();

        const newTokens = await refreshAccessToken(
            notionTokens.refresh_token,
            notionClientCredentials.client_id,
            notionClientCredentials.client_secret
        );
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
        // const refreshed = await refreshNotionToken();
        // if (!refreshed) {
        //     return null;
        // }
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
            accessToken,
            {
                onStatusChange: (status) => {
                    notionStatus = status;
                    broadcastStatusUpdate();

                    // Handle token expiry (but not format errors)
                    if (status.state === 'needs-auth') {
                        // handleTokenExpiry();
                    } else if (status.state === 'invalid-token') {
                        // Token format is invalid - clear tokens and require re-auth
                        // handleInvalidToken();
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
 * Handle invalid token format - clear tokens and require re-auth
 */
async function handleInvalidToken(): Promise<void> {
    console.log('[Background] Handling invalid token format');

    // Disconnect current client
    if (notionMcpClient) {
        notionMcpClient.disconnect();
        notionMcpClient = null;
    }

    // Clear invalid tokens and client credentials - don't try to refresh
    await clearTokens();
    await clearClientCredentials();
    notionTokens = null;
    notionClientCredentials = null;
    notionStatus = {
        state: 'invalid-token',
        error: 'Invalid token format - please re-authenticate'
    };
    isEnabled = false;
    await chrome.storage.local.set({ 'mcp.notion.enabled': false });
    broadcastStatusUpdate();
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
    await clearClientCredentials();
    notionTokens = null;
    notionClientCredentials = null;
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
            const credentials = await getStoredClientCredentials();
            if (tokens && credentials) {
                notionTokens = tokens;
                notionClientCredentials = credentials;
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
        const credentials = await getStoredClientCredentials();
        if (tokens && credentials) {
            notionTokens = tokens;
            notionClientCredentials = credentials;
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

