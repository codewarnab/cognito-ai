
import { createLogger } from '~logger';
import type { McpClient, McpServerStatus, McpTool } from '../../mcp/types';
import { ENV } from '@/utils/env';
import type { McpDiscoveryResponse, McpStdioRequest, McpExecuteRequest } from '@cognito/shared';

const log = createLogger('MCP-Backend', 'MCP_CLIENT');

/**
 * MCP client for backend-proxied stdio servers.
 * 
 * SECURITY: This client sends only serverId + credentials to the backend.
 * The backend resolves the actual command from its secure registry.
 * This prevents arbitrary command execution attacks.
 */
export class McpBackendClient implements McpClient {
    private currentStatus: McpServerStatus;

    constructor(
        private serverId: string,
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
        const backendUrl = ENV.BACKEND_API_URL;
        log.info(`[${this.serverId}] Discovering tools via backend: ${backendUrl}`);

        // SECURITY: Send only serverId + credentials, NOT command/args
        const payload: McpStdioRequest = {
            serverId: this.serverId,
            credentials: this.accessToken ? { apiKey: this.accessToken } : undefined,
        };

        try {
            const response = await fetch(`${backendUrl}/api/ai/mcp/discover`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Backend discovery failed: ${response.statusText}`);
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

        // SECURITY: Send only serverId + credentials, NOT command/args
        const payload: McpExecuteRequest = {
            serverId: this.serverId,
            credentials: this.accessToken ? { apiKey: this.accessToken } : undefined,
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

