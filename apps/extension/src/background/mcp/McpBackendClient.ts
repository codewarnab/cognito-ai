
import { createLogger } from '~logger';
import type { McpClient, McpServerStatus, McpTool } from '../../mcp/types';
import type { ServerConfig } from '@/constants/mcpServers';
import { ENV } from '@/utils/env';
import type { McpDiscoveryResponse, StdioMcpConfig } from '@cognito/shared';

const log = createLogger('MCP-Backend', 'MCP_CLIENT');

export class McpBackendClient implements McpClient {
    private currentStatus: McpServerStatus;

    constructor(
        private serverId: string,
        private config: ServerConfig,
        private accessToken: string | null
    ) {
        this.currentStatus = {
            serverId,
            state: 'disconnected'
        };
    }

    async connect(): Promise<void> {
        this.currentStatus.state = 'connecting';
        log.info(`[${this.serverId}] Connecting to Backend MCP...`);
        // We don't maintain a persistent connection, but we simulate it.
        // We check if we can reach the backend.
        // Or we just assume connected and discovery will validate.
        this.currentStatus.state = 'connected';
    }

    async initialize(): Promise<void> {
        // Discovery is part of initialization
        await this.discoverTools();
    }

    private async discoverTools(): Promise<void> {
        if (!this.config.stdioConfig) {
            throw new Error('StdIO config missing');
        }

        const backendUrl = ENV.BACKEND_API_URL;
        log.info(`[${this.serverId}] Discovering tools via backend: ${backendUrl}`);

        const payload: StdioMcpConfig = {
            command: this.config.stdioConfig.command,
            args: this.config.stdioConfig.args,
            env: {
                // Map frontend auth/env vars to backend env
                // For 'pat' auth (Magic MCP), likely mapped to API_KEY
                // Implementation detail for specific mapping needed?
                // For now pass basic env if configured
                ...(this.config.stdioConfig.env || {}),
                ...(this.accessToken ? { API_KEY: this.accessToken } : {})
                // Inject API Key if present in storage or state?
                // Auth handling is usually done before connect.
                // Manager passes 'accessToken' but here we handle it differently.
            }
        };


        try {   
            const response = await fetch(`${backendUrl}/api/ai/mcp/discover`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Pass current user auth if backend requires it (e.g. Rate Limit)
                    // The backend might need identification.
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Backend discovery failed: ${response.statusText}`);
            }

            const data: McpDiscoveryResponse = await response.json();

            this.currentStatus.tools = data.tools.map((t: any) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema || { type: 'object', properties: {} }
            })) as McpTool[]; // Cast to McpTool

            log.info(`[${this.serverId}] Discovered ${this.currentStatus.tools.length} tools`);

        } catch (error) {
            log.error(`[${this.serverId}] Discovery failed:`, error);
            this.currentStatus.state = 'error';
            this.currentStatus.error = error instanceof Error ? error.message : 'Unknown error';
            throw error;
        }
    }

    async listTools(): Promise<{ tools: any[] }> {
        return { tools: this.currentStatus.tools || [] };
    }

    async callTool(name: string, args?: Record<string, any>): Promise<any> {
        const backendUrl = ENV.BACKEND_API_URL;
        log.info(`[${this.serverId}] Executing tool on backend: ${name}`);

        const payload = {
            command: this.config.stdioConfig?.command,
            args: this.config.stdioConfig?.args,
            env: {
                ...(this.config.stdioConfig?.env || {}),
                ...(this.accessToken ? { API_KEY: this.accessToken } : {})
            },
            toolName: name,
            toolArgs: args || {}
        };

        try {
            const response = await fetch(`${backendUrl}/api/ai/mcp/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Backend tool execution failed: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            return data.result;

        } catch (error) {
            log.error(`[${this.serverId}] Tool execution failed:`, error);
            throw error;
        }
    }

    getStatus(): McpServerStatus {
        return this.currentStatus;
    }

    disconnect(): void {
        this.currentStatus.state = 'disconnected';
    }
}
