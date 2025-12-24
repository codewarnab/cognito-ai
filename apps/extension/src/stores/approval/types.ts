/**
 * Approval Store Types
 *
 * Types for tool auto-approval preferences.
 * Synced with Chrome storage for persistence (except session approvals).
 */

/**
 * Auto-approval preferences stored per-user
 */
export interface ApprovalPreferences {
    /**
     * Tools approved for the current session only.
     * Resets when browser/extension restarts.
     * Key: toolName
     */
    sessionApprovedTools: string[];

    /**
     * Tools approved for specific domains/websites.
     * Persisted to Chrome storage.
     * Key: toolName, Value: array of approved domains
     * 
     * NOTE: Domain meaning varies by tool:
     * - navigateTo: the target URL's domain (where we're navigating to)
     * - typeInText, clickByText, etc.: the current page's domain (where action happens)
     */
    websiteApprovedTools: Record<string, string[]>;

    /**
     * Tools always approved without prompts.
     * Persisted to Chrome storage.
     */
    alwaysApprovedTools: string[];

    // ═══════════════════════════════════════════════════════════════════════════
    // MCP Server Tool Approvals
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * MCP servers that are fully trusted - all tools from these servers auto-approve.
     * Persisted to Chrome storage.
     * Key: serverId (e.g., "notion", "github")
     */
    mcpApprovedServers: string[];

    /**
     * Individual MCP tools that are always approved.
     * Persisted to Chrome storage.
     * Key: full tool name (e.g., "notion_createPage")
     */
    mcpApprovedTools: string[];

    /**
     * MCP tools approved for session only.
     * In-memory, resets on restart.
     */
    mcpSessionApprovedTools: string[];

    // ═══════════════════════════════════════════════════════════════════════════
    // WebMCP Website Tool Approvals
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Website domains that are fully trusted - all WebMCP tools from these domains auto-approve.
     * Persisted to Chrome storage.
     * Key: domain (e.g., "github.com", "notion.so")
     */
    webmcpApprovedDomains: string[];

    /**
     * Individual WebMCP tools that are always approved.
     * Persisted to Chrome storage.
     * Key: full tool name (e.g., "webmcp_github.com_createIssue")
     */
    webmcpApprovedTools: string[];

    /**
     * WebMCP tools approved for session only.
     * In-memory, resets on restart.
     */
    webmcpSessionApprovedTools: string[];
}

export interface ApprovalState extends ApprovalPreferences {
    // Initialization
    isInitialized: boolean;

    // Actions
    initialize: () => Promise<void>;

    // ═══════════════════════════════════════════════════════════════════════════
    // Built-in Tool Approvals (existing)
    // ═══════════════════════════════════════════════════════════════════════════

    // Add approvals
    addSessionApproval: (toolName: string) => void;
    addWebsiteApproval: (toolName: string, domain: string) => Promise<void>;
    addAlwaysApproval: (toolName: string) => Promise<void>;

    // Remove approvals
    removeSessionApproval: (toolName: string) => void;
    removeWebsiteApproval: (toolName: string, domain: string) => Promise<void>;
    removeAlwaysApproval: (toolName: string) => Promise<void>;

    // Check approvals
    isAutoApproved: (toolName: string, domain?: string) => boolean;
    getApprovalReason: (toolName: string, domain?: string) => string | null;

    // Clear all
    clearSessionApprovals: () => void;
    clearAllApprovals: () => Promise<void>;

    // ═══════════════════════════════════════════════════════════════════════════
    // MCP Server Tool Approvals
    // ═══════════════════════════════════════════════════════════════════════════

    // MCP Server-level approvals (trust entire server)
    addMcpServerApproval: (serverId: string) => Promise<void>;
    removeMcpServerApproval: (serverId: string) => Promise<void>;
    isMcpServerApproved: (serverId: string) => boolean;

    // MCP Tool-level approvals (always approve specific tool)
    addMcpToolApproval: (toolName: string) => Promise<void>;
    removeMcpToolApproval: (toolName: string) => Promise<void>;
    isMcpToolApproved: (toolName: string) => boolean;

    // MCP Session approvals (in-memory only)
    addMcpSessionApproval: (toolName: string) => void;
    removeMcpSessionApproval: (toolName: string) => void;

    // Combined check for MCP tools
    isMcpAutoApproved: (toolName: string, serverId: string) => boolean;
    getMcpApprovalReason: (toolName: string, serverId: string) => string | null;

    // ═══════════════════════════════════════════════════════════════════════════
    // WebMCP Website Tool Approvals
    // ═══════════════════════════════════════════════════════════════════════════

    // WebMCP Domain-level approvals (trust entire website)
    addWebmcpDomainApproval: (domain: string) => Promise<void>;
    removeWebmcpDomainApproval: (domain: string) => Promise<void>;
    isWebmcpDomainApproved: (domain: string) => boolean;

    // WebMCP Tool-level approvals (always approve specific tool)
    addWebmcpToolApproval: (toolName: string) => Promise<void>;
    removeWebmcpToolApproval: (toolName: string) => Promise<void>;
    isWebmcpToolApproved: (toolName: string) => boolean;

    // WebMCP Session approvals (in-memory only)
    addWebmcpSessionApproval: (toolName: string) => void;
    removeWebmcpSessionApproval: (toolName: string) => void;

    // Combined check for WebMCP tools
    isWebmcpAutoApproved: (toolName: string, domain: string) => boolean;
    getWebmcpApprovalReason: (toolName: string, domain: string) => string | null;
}
