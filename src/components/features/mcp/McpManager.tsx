import React, { useState, useMemo, useEffect, useRef } from "react"
import { McpHeader } from "./McpHeader"
import { McpServerCard } from "./McpServerCard"
import { McpToolsManager } from "./McpToolsManager"
import { AddCustomMcp } from "./AddCustomMcp"
import { ToolCountWarning } from "./ToolCountWarning"
import { MCP_SERVERS, type ServerConfig } from "@/constants/mcpServers"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/primitives/popover"
import { getCloudToolsCount } from "@/ai/tools"
import { TOOLS_WARNING_THRESHOLD, HIDE_LOCAL_MODE } from "@/constants"
import { PlusIcon, type PlusIconHandle } from "@assets/icons/ui/plus"
import { McpServerDefault } from "@assets/brands/integrations/McpServerDefault"

interface McpManagerProps {
    onBack: () => void
}

interface ServerStatus {
    serverId: string
    isEnabled: boolean
    isAuthenticated: boolean
}

// Custom server stored in localStorage
interface CustomServerData {
    id: string
    name: string
    url: string
    description: string
    image?: string
    requiresAuthentication: boolean
    initialEnabled?: boolean
    initialAuthenticated?: boolean
    isCustom: boolean
}

// Helper to convert custom server data to ServerConfig
const customServerToConfig = (server: CustomServerData): ServerConfig => ({
    id: server.id,
    name: server.name,
    icon: server.image
        ? <img src={server.image} alt={server.name} style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
        : <McpServerDefault style={{ width: 24, height: 24 }} />,
    url: server.url,
    description: server.description,
    requiresAuthentication: server.requiresAuthentication,
    initialEnabled: server.initialEnabled ?? false,
    initialAuthenticated: server.initialAuthenticated ?? false,
    isCustom: true
})

export const McpManager: React.FC<McpManagerProps> = ({ onBack }) => {
    const [searchQuery, setSearchQuery] = useState("")
    const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({})
    const [activeView, setActiveView] = useState<'list' | 'tools' | 'add-custom'>('list')
    const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
    const [mcpToolCount, setMcpToolCount] = useState(0)
    const [cloudToolCount, setCloudToolCount] = useState(0)
    const [customServers, setCustomServers] = useState<ServerConfig[]>([])
    const plusIconRef = useRef<PlusIconHandle>(null)

    // Load custom servers from chrome.storage.local on mount and when returning from add-custom view
    useEffect(() => {
        const loadCustomServers = async () => {
            try {
                const result = await chrome.storage.local.get("customMcpServers")
                const stored = result.customMcpServers
                if (stored && Array.isArray(stored)) {
                    const configs = stored.map(customServerToConfig)
                    setCustomServers(configs)
                } else {
                    setCustomServers([])
                }
            } catch (error) {
                console.error('Failed to load custom MCP servers:', error)
                setCustomServers([])
            }
        }

        loadCustomServers()
    }, [activeView]) // Reload when view changes (e.g., after adding a new server)

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
            // Combine official and custom servers
            const allServers = [...MCP_SERVERS, ...customServers]

            // Fetch status for all servers in parallel
            const statusPromises = allServers.map(async (server) => {
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
            const newStatuses: Record<string, ServerStatus> = {}
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
        const handleMessage = (message: { type?: string; payload?: any }) => {
            // Match pattern: mcp/{serverId}/status/update
            const match = message.type?.match(/^mcp\/([^/]+)\/status\/update$/)
            if (match && match[1]) {
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
    }, [customServers])

    // Filter servers based on search query
    const filteredServers = useMemo(() => {
        // Combine custom servers (at top) with official servers
        const allServers = [...customServers, ...MCP_SERVERS]

        let results = !searchQuery.trim()
            ? allServers
            : allServers.filter(server =>
                server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                server.id.toLowerCase().includes(searchQuery.toLowerCase())
            )

        // Sort priority: custom servers first > enabled > authenticated > unauthenticated
        return results.sort((a, b) => {
            const aStatus = serverStatuses[a.id]
            const bStatus = serverStatuses[b.id]

            // Priority 0: Custom servers always at the top
            const aCustom = (a as ServerConfig & { isCustom?: boolean }).isCustom ? 1 : 0
            const bCustom = (b as ServerConfig & { isCustom?: boolean }).isCustom ? 1 : 0
            if (aCustom !== bCustom) return bCustom - aCustom

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
    }, [searchQuery, serverStatuses, customServers])

    const handleManageTools = (serverId: string) => {
        setSelectedServerId(serverId)
        setActiveView('tools')
    }

    const handleBackToList = () => {
        setActiveView('list')
        setSelectedServerId(null)
    }

    // Handler for deleting custom MCP servers
    const handleDeleteServer = async (serverId: string) => {
        try {
            const result = await chrome.storage.local.get("customMcpServers")
            const servers = result.customMcpServers || []
            const updatedServers = servers.filter((s: CustomServerData) => s.id !== serverId)
            await chrome.storage.local.set({ customMcpServers: updatedServers })

            // Notify background to reload custom servers cache
            await chrome.runtime.sendMessage({ type: 'mcp/custom-servers/reload' })

            // Update local state
            setCustomServers(prev => prev.filter(s => s.id !== serverId))
        } catch (error) {
            console.error('Failed to delete custom MCP server:', error)
        }
    }

    // Handler for plus icon click
    const handlePlusIconClick = () => {
        setActiveView('add-custom')

        // Trigger animation on click
        if (plusIconRef.current) {
            plusIconRef.current.startAnimation()
            setTimeout(() => {
                plusIconRef.current?.stopAnimation()
            }, 500)
        }
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

    if (activeView === 'add-custom') {
        return (
            <AddCustomMcp
                onBack={handleBackToList}
            />
        )
    }

    return (
        <div className="mcp-panel">
            <McpHeader title="MCP Server Management" onBack={onBack} />

            {/* Tool count warning */}
            {showWarning && (
                <ToolCountWarning
                    cloudToolCount={cloudToolCount}
                    mcpToolCount={mcpToolCount}
                    totalToolCount={totalToolCount}
                />
            )}

            {/* Note about local mode */}
            {!HIDE_LOCAL_MODE && (
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
            )}

            {/* Search Bar with Plus Icon */}
            <div className="mcp-search-container" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div className="mcp-search-wrapper" style={{ flex: 1 }}>
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

                {/* Plus Icon Button with Tooltip */}
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            onClick={handlePlusIconClick}
                            aria-label="Add custom MCP server"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '44px',
                                height: '44px',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                            }}
                        >
                            <PlusIcon
                                ref={plusIconRef}
                                size={24}
                                style={{
                                    color: 'var(--text-primary, #fff)',
                                    opacity: 0.8
                                }}
                            />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" sideOffset={8}>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap'
                        }}>
                            Add custom MCP server
                        </div>
                    </PopoverContent>
                </Popover>
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
                                    isCustom={server.isCustom}
                                    onManageTools={handleManageTools}
                                    onDelete={server.isCustom ? handleDeleteServer : undefined}
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
                            Try searching for a different server name or add a custom server
                        </p>
                        <button
                            onClick={handlePlusIconClick}
                            style={{
                                marginTop: '1rem',
                                padding: '0.625rem 1rem',
                                backgroundColor: 'rgb(59, 130, 246)',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgb(37, 99, 235)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgb(59, 130, 246)'
                            }}
                        >
                            Add Custom MCP Server
                        </button>
                        <div style={{
                            marginTop: '1rem',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary, rgba(255, 255, 255, 0.6))'
                        }}>
                            Can't find what you're looking for?{' '}
                            <a
                                href="https://tally.so/r/yPPB0B"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    color: 'rgb(59, 130, 246)',
                                    textDecoration: 'none',
                                    fontWeight: 500
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.textDecoration = 'underline'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.textDecoration = 'none'
                                }}
                            >
                                Request an integration
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
