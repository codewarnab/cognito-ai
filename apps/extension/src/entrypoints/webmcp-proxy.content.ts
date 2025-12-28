/**
 * WebMCP Proxy Content Script
 *
 * This content script acts as a bridge between web pages that implement the WebMCP protocol
 * and the Chrome extension's background service. It discovers WebMCP servers on pages,
 * registers their tools with the extension, and handles tool execution requests.
 *
 * Key responsibilities:
 * - Detect and connect to WebMCP servers exposed by web pages
 * - Discover available tools and report them to the background service
 * - Execute tool calls from the extension and return results
 * - Handle tool list change notifications
 * - Rate limit tool executions for security
 *
 * @module webmcp-proxy.content
 */
import { TabClientTransport } from '@mcp-b/transports';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import type { WebMCPTool } from '@/types/webmcp';
import { createLogger } from '~logger';

const log = createLogger('WebMCP-Proxy', 'CONTENT_SCRIPTS');

export default defineContentScript({
    matches: ['<all_urls>'],
    allFrames: false,
    runAt: 'document_idle',

    main(ctx) {
        // Module state
        let client: Client | null = null;
        let transport: TabClientTransport | null = null;
        let isConnected = false;
        let currentTabId: number | null = null;
        let connectionAttempted = false;

        // Rate limiting for tool execution
        const toolExecutionTimestamps = new Map<string, number>();
        // 100ms rate limit prevents rapid-fire tool calls that could overwhelm
        // the page's WebMCP server or be used for denial-of-service attacks
        const RATE_LIMIT_MS = 100;

        /**
         * Extract domain from URL for tool naming
         */
        function extractDomain(url: string): string {
            try {
                const urlObj = new URL(url);
                const hostname = urlObj.hostname;
                // Include port for localhost to differentiate dev servers
                if (hostname === 'localhost' || hostname === '127.0.0.1') {
                    return `localhost${urlObj.port ? '_' + urlObj.port : ''}`;
                }
                return hostname.replace(/\./g, '_');
            } catch {
                return 'unknown';
            }
        }

        /**
         * Get the favicon URL for the current page
         */
        function getFaviconUrl(): string | undefined {
            // Try to find favicon from link tags
            const iconLink = document.querySelector<HTMLLinkElement>(
                'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
            );
            if (iconLink?.href) {
                return iconLink.href;
            }

            // Fallback to default favicon location
            try {
                return new URL('/favicon.ico', window.location.origin).href;
            } catch {
                return undefined;
            }
        }

        /**
         * Sanitize tool name for safe use in our system
         * Only allows alphanumeric and underscore, max 64 chars
         */
        function sanitizeToolName(name: string): string {
            return name
                .replace(/[^a-zA-Z0-9_]/g, '_')
                .toLowerCase()
                .slice(0, 64);
        }

        /**
         * Validate and sanitize tool arguments
         */
        function validateToolArgs(args: unknown): Record<string, unknown> {
            if (!args || typeof args !== 'object' || Array.isArray(args)) {
                return {};
            }
            // Deep clone to prevent prototype pollution
            try {
                return JSON.parse(JSON.stringify(args));
            } catch {
                return {};
            }
        }


        /**
         * Check if tool execution is rate limited
         */
        function isRateLimited(toolName: string): boolean {
            const lastExecution = toolExecutionTimestamps.get(toolName) || 0;
            const now = Date.now();

            if (now - lastExecution < RATE_LIMIT_MS) {
                return true;
            }

            toolExecutionTimestamps.set(toolName, now);
            return false;
        }

        /**
         * Send discovered tools to background service
         */
        async function sendToolsToBackground(tools: WebMCPTool[]): Promise<void> {
            if (currentTabId === null) {
                log.debug('No tab ID, cannot send tools');
                return;
            }

            try {
                await browser.runtime.sendMessage({
                    type: 'webmcp/tools/register',
                    tools,
                    tabId: currentTabId,
                    domain: extractDomain(window.location.href),
                    url: window.location.href,
                });
                log.debug('Sent tools to background:', tools.length);
            } catch (error) {
                // Extension context may be invalidated
                log.debug('Failed to send tools:', error);
            }
        }

        /**
         * Fetch tools from the page's WebMCP server and report to background
         */
        async function fetchAndReportTools(): Promise<void> {
            if (!client || !isConnected) {
                log.debug('Not connected, cannot fetch tools');
                return;
            }

            try {
                const result = await client.listTools();
                const domain = extractDomain(window.location.href);

                const favicon = getFaviconUrl();
                const webmcpTools: WebMCPTool[] = result.tools.map((tool) => ({
                    ...tool,
                    originalName: tool.name,
                    name: `webmcp_${sanitizeToolName(domain)}_${sanitizeToolName(tool.name)}`,
                    domain,
                    tabId: currentTabId!,
                    url: window.location.href,
                    favicon,
                }));

                await sendToolsToBackground(webmcpTools);
                log.info('Discovered tools:', webmcpTools.map((t) => t.originalName));
            } catch (error) {
                log.debug('Failed to fetch tools:', error);
                // Send empty tools on error to clear any stale tools
                await sendToolsToBackground([]);
            }
        }

        /**
         * Execute a tool call from the background service
         */
        async function executeTool(
            originalToolName: string,
            args: Record<string, unknown>
        ): Promise<{ success: boolean; result?: unknown; error?: string }> {
            if (!client || !isConnected) {
                return { success: false, error: 'WebMCP client not connected' };
            }

            // Rate limit check
            if (isRateLimited(originalToolName)) {
                return { success: false, error: 'Tool execution rate limited' };
            }

            // Validate arguments
            const validatedArgs = validateToolArgs(args);

            try {
                log.info('Executing tool:', originalToolName, validatedArgs);

                const result = await client.callTool({
                    name: originalToolName,
                    arguments: validatedArgs,
                });

                log.info('Tool result:', originalToolName);
                return { success: true, result };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                log.error('Tool execution failed:', originalToolName, errorMessage);
                return { success: false, error: errorMessage };
            }
        }

        /**
         * Clean up resources
         */
        function cleanup(): void {
            if (transport) {
                try {
                    transport.close();
                } catch {
                    // Ignore cleanup errors
                }
            }
            client = null;
            transport = null;
            isConnected = false;
            connectionAttempted = false;
        }

        /**
         * Attempt to connect to the page's WebMCP server
         */
        async function attemptConnection(): Promise<void> {
            if (connectionAttempted) {
                log.debug('Connection already attempted');
                return;
            }

            connectionAttempted = true;

            // Skip pages that shouldn't have WebMCP
            const url = window.location.href;
            if (
                url.startsWith('chrome://') ||
                url.startsWith('chrome-extension://') ||
                url.startsWith('about:') ||
                url.startsWith('edge://') ||
                url.startsWith('brave://')
            ) {
                log.debug('Skipping protected page');
                return;
            }

            try {
                client = new Client({
                    name: 'ChromeAI-WebMCP-Proxy',
                    version: '1.0.0',
                });

                transport = new TabClientTransport({
                    targetOrigin: window.location.origin,
                });

                // Handle transport close
                transport.onclose = () => {
                    log.info('Transport closed');
                    isConnected = false;
                    client = null;
                    transport = null;
                    // Notify background that tools are gone
                    sendToolsToBackground([]);
                };

                // Attempt connection with timeout
                const connectionPromise = client.connect(transport);
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Connection timeout')), 5000);
                });

                await Promise.race([connectionPromise, timeoutPromise]);

                isConnected = true;
                log.info('Connected to page WebMCP server');

                // Get server capabilities
                const capabilities = client.getServerCapabilities?.() || {};

                // Initial tool fetch
                await fetchAndReportTools();

                // Listen for tool list changes if supported
                if (capabilities?.tools?.listChanged) {
                    client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
                        log.info('Tool list changed notification');
                        await fetchAndReportTools();
                    });
                }
            } catch (error) {
                // Most pages won't have WebMCP - this is expected
                log.debug('No WebMCP server on this page (expected for most sites)');
                cleanup();
            }
        }


        /**
         * Initialize the WebMCP proxy
         */
        async function initialize(): Promise<void> {
            try {
                // Get current tab ID from background
                const response = await browser.runtime.sendMessage({ type: 'GET_CURRENT_TAB_ID' });

                if (response?.tabId) {
                    currentTabId = response.tabId;
                    log.debug('Initialized with tab ID:', currentTabId);

                    // Attempt connection after a short delay to let page scripts initialize
                    ctx.setTimeout(() => {
                        attemptConnection();
                    }, 1000);
                } else {
                    log.debug('Could not get tab ID');
                }
            } catch (error) {
                // Extension context may not be ready
                log.debug('Initialization error:', error);
            }
        }

        // Handle messages from background service
        browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            // Handle tool execution request
            if (message.type === 'webmcp/tool/execute') {
                const { originalToolName, args, requestId } = message;

                executeTool(originalToolName, args || {})
                    .then((result) => {
                        sendResponse({
                            type: 'webmcp/tool/result',
                            requestId,
                            ...result,
                        });
                    })
                    .catch((error) => {
                        sendResponse({
                            type: 'webmcp/tool/result',
                            requestId,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    });

                return true; // Async response
            }

            // Handle tools refresh request
            if (message.type === 'webmcp/tools/refresh') {
                if (isConnected) {
                    fetchAndReportTools()
                        .then(() => sendResponse({ success: true }))
                        .catch(() => sendResponse({ success: false }));
                } else {
                    // Try to connect if not already connected
                    attemptConnection()
                        .then(() => sendResponse({ success: isConnected }))
                        .catch(() => sendResponse({ success: false }));
                }
                return true; // Async response
            }

            return false;
        });

        // Handle page unload - Use ctx.addEventListener for auto-cleanup
        ctx.addEventListener(window, 'beforeunload', cleanup);

        // Handle visibility changes (tab becomes hidden/visible)
        ctx.addEventListener(document, 'visibilitychange', () => {
            if (document.visibilityState === 'visible' && isConnected) {
                // Refresh tools when tab becomes visible
                fetchAndReportTools();
            }
        });

        // Cleanup when content script invalidates
        ctx.onInvalidated(() => {
            cleanup();
        });

        // Start initialization
        initialize();
    },
});
