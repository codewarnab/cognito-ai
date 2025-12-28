/**
 * Secure MCP Server Registry
 * 
 * SECURITY CRITICAL: This registry defines the ONLY stdio commands that the backend
 * will execute. The frontend sends only a serverId, and the backend looks up the
 * actual command/args from this registry. This prevents arbitrary command execution.
 * 
 * Adding new servers here requires:
 * 1. Code review for security (verify the npm package is safe)
 * 2. Backend deployment
 * 3. Update frontend mcpServers.tsx to reference by ID
 */

/**
 * Configuration for a registered MCP server.
 */
export interface McpServerRegistryEntry {
    /** Unique identifier matching the serverId in mcpServers.tsx */
    id: string;
    /** The command to execute (e.g., 'npx', 'node') */
    command: string;
    /** Command arguments */
    args: string[];
    /** 
     * Environment variable name where the API key should be injected.
     * If set, the frontend's credentials.apiKey will be placed here.
     */
    envKeyName?: string;
    /** 
     * Maps credential field names to environment variables.
     * Used for multi-field servers (e.g., Plane requires apiKey + workspaceSlug).
     */
    envMapping?: Record<string, string>;
    /** Static environment variables (e.g., timeouts, defaults) */
    staticEnv?: Record<string, string>;
    /** Whether this server is enabled */
    enabled: boolean;
}

/**
 * Registry of allowed MCP stdio servers.
 * 
 * SECURITY: Only servers listed here can be executed by the backend.
 * Never add servers without reviewing their source code.
 */
export const MCP_SERVER_REGISTRY: Record<string, McpServerRegistryEntry> = {
    'magic-mcp': {
        id: 'magic-mcp',
        command: 'npx',
        args: ['-y', '@21st-dev/magic@latest'],
        envKeyName: 'API_KEY',
        enabled: true,
    },
    'brave-search': {
        id: 'brave-search',
        command: 'npx',
        args: ['-y', '@brave/brave-search-mcp-server'],
        envKeyName: 'BRAVE_API_KEY',
        enabled: true,
    },
    'perplexity': {
        id: 'perplexity',
        command: 'npx',
        args: ['-y', '@perplexity-ai/mcp-server'],
        envKeyName: 'PERPLEXITY_API_KEY',
        staticEnv: { 'PERPLEXITY_TIMEOUT_MS': '600000' },
        enabled: true,
    },
    'firecrawl': {
        id: 'firecrawl',
        command: 'npx',
        args: ['-y', 'firecrawl-mcp'],
        envKeyName: 'FIRECRAWL_API_KEY',
        enabled: true,
    },
    'google-maps': {
        id: 'google-maps',
        command: 'npx',
        args: ['-y', '@googlemaps/code-assist-mcp@latest'],
        // No envKeyName - no authentication required
        enabled: true,
    },
    'plane': {
        id: 'plane',
        command: 'npx',
        args: ['-y', '@makeplane/plane-mcp-server'],
        envMapping: {
            'apiKey': 'PLANE_API_KEY',
            'workspaceSlug': 'PLANE_WORKSPACE_SLUG',
        },
        staticEnv: {
            'PLANE_API_HOST_URL': 'https://api.plane.so/',
        },
        enabled: true,
    },
    // Add more servers here as needed.
    // Each new server requires:
    // 1. Security review of the npm package
    // 2. Backend deployment
    // 3. Frontend mcpServers.tsx update
};

/**
 * Request payload for MCP stdio operations.
 * Frontend sends only serverId + credentials, backend resolves command from registry.
 */
export interface McpStdioRequest {
    /** Server ID from the registry (e.g., 'magic-mcp') */
    serverId: string;
    /** User credentials to inject into environment */
    credentials?: {
        /** API key to inject (mapped to envKeyName from registry) */
        apiKey?: string;
        /** Additional credential fields for multi-field servers (mapped via envMapping) */
        fields?: Record<string, string>;
    };
}

/**
 * Request payload for MCP tool execution.
 */
export interface McpExecuteRequest extends McpStdioRequest {
    /** Tool name to execute */
    toolName: string;
    /** Arguments for the tool */
    toolArgs?: Record<string, unknown>;
}
