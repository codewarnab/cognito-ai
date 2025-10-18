import React, { useState, useMemo, useEffect } from "react"
import { McpHeader } from "./McpHeader"
import { McpServerCard } from "./McpServerCard"
import { MCP_SERVERS } from "../constants/mcpServers"

interface McpManagerProps {
    onBack: () => void
}

interface ServerStatus {
    serverId: string
    isEnabled: boolean
    isAuthenticated: boolean
}

export const McpManager: React.FC<McpManagerProps> = ({ onBack }) => {
    const [searchQuery, setSearchQuery] = useState("")
    const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({})

    // Fetch real authentication status on mount and listen for updates
    useEffect(() => {
        const loadStatuses = async () => {
            // For Notion, fetch real status from background
            try {
                const response = await chrome.runtime.sendMessage({ 
                    type: 'mcp/notion/status/get' 
                })
                if (response.success && response.data) {
                    const status = response.data
                    const isAuth = ['authenticated', 'connected', 'connecting', 'token-refresh'].includes(status.state)
                    setServerStatuses(prev => ({
                        ...prev,
                        notion: {
                            serverId: 'notion',
                            isEnabled: status.state === 'connected',
                            isAuthenticated: isAuth
                        }
                    }))
                }
            } catch (error) {
                console.error('Failed to load Notion status:', error)
            }
        }

        loadStatuses()

        // Listen for status updates
        const handleMessage = (message: any) => {
            if (message.type === 'mcp/notion/status/update') {
                const status = message.payload
                const isAuth = ['authenticated', 'connected', 'connecting', 'token-refresh'].includes(status.state)
                setServerStatuses(prev => ({
                    ...prev,
                    notion: {
                        serverId: 'notion',
                        isEnabled: status.state === 'connected',
                        isAuthenticated: isAuth
                    }
                }))
            }
        }

        chrome.runtime.onMessage.addListener(handleMessage)
        return () => chrome.runtime.onMessage.removeListener(handleMessage)
    }, [])

    // Filter servers based on search query
    const filteredServers = useMemo(() => {
        let results = !searchQuery.trim()
            ? MCP_SERVERS
            : MCP_SERVERS.filter(server =>
                server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                server.id.toLowerCase().includes(searchQuery.toLowerCase())
            )
        
        // Sort priority: enabled > authenticated > unauthenticated
        return results.sort((a, b) => {
            const aStatus = serverStatuses[a.id]
            const bStatus = serverStatuses[b.id]
            
            // Priority 1: Enabled servers first (use real status if available, fallback to initial)
            const aEnabled = aStatus?.isEnabled ?? a.initialEnabled ? 1 : 0
            const bEnabled = bStatus?.isEnabled ?? b.initialEnabled ? 1 : 0
            if (aEnabled !== bEnabled) return bEnabled - aEnabled
            
            // Priority 2: Authenticated servers next (use real status if available, fallback to initial)
            const aAuth = aStatus?.isAuthenticated ?? a.initialAuthenticated ? 1 : 0
            const bAuth = bStatus?.isAuthenticated ?? b.initialAuthenticated ? 1 : 0
            if (aAuth !== bAuth) return bAuth - aAuth
            
            // Keep original order for same priority
            return 0
        })
    }, [searchQuery, serverStatuses])

    return (
        <div className="mcp-panel">
            <McpHeader title="MCP Server Management" onBack={onBack} />

            {/* Search Bar */}
            <div className="mcp-search-container">
                <div className="mcp-search-wrapper">
                    <svg
                        className="mcp-search-icon"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        className="mcp-search-input"
                        placeholder="Search MCP servers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Search MCP servers"
                    />
                    {searchQuery && (
                        <button
                            className="mcp-search-clear"
                            onClick={() => setSearchQuery("")}
                            aria-label="Clear search"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="mcp-content">
                {filteredServers.length > 0 ? (
                    <ul className="mcp-list" role="list">
                        {filteredServers.map((server) => (
                            <li key={server.id}>
                                <McpServerCard
                                    id={server.id}
                                    name={server.name}
                                    icon={server.icon}
                                    initialEnabled={server.initialEnabled}
                                    initialAuthenticated={server.initialAuthenticated}
                                    requiresAuth={server.requiresAuthentication}
                                />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="mcp-no-results">
                        <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        <p className="mcp-no-results-text">No servers found</p>
                        <p className="mcp-no-results-subtext">
                            Try searching for a different server name
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
