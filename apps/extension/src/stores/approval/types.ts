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
}

export interface ApprovalState extends ApprovalPreferences {
    // Initialization
    isInitialized: boolean;

    // Actions
    initialize: () => Promise<void>;

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

    // Clear all
    clearSessionApprovals: () => void;
    clearAllApprovals: () => Promise<void>;
}
