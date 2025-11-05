import React, { useState, useMemo, useEffect } from "react"
import { McpHeader } from "./McpHeader"
import { McpServerCard } from "./McpServerCard"
import { McpToolsManager } from "./McpToolsManager"
import { MCP_SERVERS } from "../../../constants/mcpServers"
import { Popover, PopoverTrigger, PopoverContent } from "../../ui/Popover"
import { getCloudToolsCount } from "../../../ai/tools";
import { TOOLS_WARNING_THRESHOLD } from "../../../constants"

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
    const [activeView, setActiveView] = useState<'list' | 'tools'>('list')
    const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
    const [mcpToolCount, setMcpToolCount] = useState(0)
    const [cloudToolCount, setCloudToolCount] = useState(0)

    // Fetch MCP tool count on mount and when server statuses change
    useEffect(() => {
        const fetchMcpToolCount = async () => {
            try {
                const response = await chrome.runtime.sendMessage({ type: 'mcp/tools/list' })
                if (response.success && response.tools) {
                    const count = Object.keys(response.tools).length
                    setMcpToolCount(count)
                }
            } catch (error) {
                console.error('Failed to fetch MCP tools count:', error)
                setMcpToolCount(0)
            }
        }

        fetchMcpToolCount()
    }, [serverStatuses]) // Re-fetch when server statuses change

    // Get cloud tool count on mount
    useEffect(() => {
        try {
            const count = getCloudToolsCount()
            setCloudToolCount(count)
        } catch (error) {
            console.error('Failed to get cloud tools count:', error)
            setCloudToolCount(0)
        }
    }, [])

    const totalToolCount = cloudToolCount + mcpToolCount
    const showWarning = totalToolCount > TOOLS_WARNING_THRESHOLD

    // Fetch real authentication status on mount and listen for updates
    useEffect(() => {
        const loadStatuses = async () => {
            // Fetch status for all servers in parallel
            const statusPromises = MCP_SERVERS.map(async (server) => {
                try {
                    const response = await chrome.runtime.sendMessage({
                        type: `mcp/${server.id}/status/get`
                    })
                    if (response.success && response.data) {
                        const status = response.data
                        const isAuth = ['authenticated', 'connected', 'connecting', 'token-refresh'].includes(status.state)
                        return {
                            serverId: server.id,
                            status: {
                                serverId: server.id,
                                isEnabled: status.state === 'connected',
                                isAuthenticated: isAuth
                            }
                        }
                    }
                    return null
                } catch (error) {
                    console.error(`Failed to load ${server.name} status:`, error)
                    return null
                }
            })

            // Wait for all promises to complete
            const results = await Promise.all(statusPromises)

            // Build the statuses object from successful results
            const newStatuses: Record<string, any> = {}
            results.forEach(result => {
                if (result) {
                    newStatuses[result.serverId] = result.status
                }
            })

            // Update state once with all statuses
            setServerStatuses(prev => ({
                ...prev,
                ...newStatuses
            }))
        }

        loadStatuses()

        // Listen for status updates from any server
        const handleMessage = (message: any) => {
            // Match pattern: mcp/{serverId}/status/update
            const match = message.type?.match(/^mcp\/([^/]+)\/status\/update$/)
            if (match) {
                const serverId = match[1]
                const status = message.payload
                const isAuth = ['authenticated', 'connected', 'connecting', 'token-refresh'].includes(status.state)
                setServerStatuses(prev => ({
                    ...prev,
                    [serverId]: {
                        serverId,
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

    const handleManageTools = (serverId: string) => {
        setSelectedServerId(serverId)
        setActiveView('tools')
    }

    const handleBackToList = () => {
        setActiveView('list')
        setSelectedServerId(null)
    }

    // Conditional rendering based on active view
    if (activeView === 'tools' && selectedServerId) {
        return (
            <McpToolsManager
                serverId={selectedServerId}
                onBack={handleBackToList}
            />
        )
    }

    return (
        <div className="mcp-panel">
            <McpHeader title="MCP Server Management" onBack={onBack} />

            {/* Tool count warning */}
            {showWarning && (
                <div style={{
                    padding: '0.75rem 1rem',
                    margin: '1rem 1rem 0.5rem 1rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ color: 'rgb(239, 68, 68)', flexShrink: 0 }}
                        >
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span style={{ fontWeight: 500 }}>
                            Too many tools enabled ({totalToolCount} total)
                        </span>
                    </div>
                    <Popover>
                        <PopoverTrigger
                            style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                transition: 'all 150ms ease',
                                fontWeight: 500
                            }}
                            aria-label="Show tool count details"
                        >
                            Details
                        </PopoverTrigger>
                        <PopoverContent align="end" sideOffset={8}>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem'
                            }}>
                                <div>
                                    <h3 style={{
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        marginBottom: '0.5rem',
                                        color: 'var(--text-primary)'
                                    }}>
                                        Tool Count Warning
                                    </h3>
                                    <p style={{
                                        fontSize: '0.8rem',
                                        lineHeight: 1.5,
                                        color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))',
                                        margin: 0
                                    }}>
                                        There are too many tools enabled. LLMs might not use tools reliably when there are more than {TOOLS_WARNING_THRESHOLD} tools available.
                                    </p>
                                </div>
                                <div style={{
                                    padding: '0.5rem',
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '0.25rem'
                                    }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Cloud tools:</span>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cloudToolCount}</span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '0.25rem'
                                    }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>MCP tools:</span>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{mcpToolCount}</span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        paddingTop: '0.25rem',
                                        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                                    }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Total:</span>
                                        <span style={{ fontWeight: 700, color: 'rgb(239, 68, 68)' }}>{totalToolCount}</span>
                                    </div>
                                </div>
                                <p style={{
                                    fontSize: '0.75rem',
                                    lineHeight: 1.4,
                                    color: 'var(--text-secondary, rgba(255, 255, 255, 0.6))',
                                    margin: 0,
                                    fontStyle: 'italic'
                                }}>
                                    💡 Tip: Use the "Manage Tools" option on each server to disable unnecessary MCP tools.
                                </p>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            )}

            {/* Note about local mode */}
            <div style={{
                padding: '0.75rem 1rem',
                margin: '1rem 1rem 0.5rem 1rem',
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: 'var(--text-primary)'
            }}>
                Note: MCP servers only work in remote mode
            </div>

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
                                    description={server.description}
                                    initialEnabled={server.initialEnabled}
                                    initialAuthenticated={server.initialAuthenticated}
                                    requiresAuth={server.requiresAuthentication}
                                    paid={server.paid}
                                    onManageTools={handleManageTools}
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
