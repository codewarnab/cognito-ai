import React, { useMemo, useEffect, useRef } from "react"
import { McpHeader } from "./McpHeader"
import { McpServerCard } from "./McpServerCard"
import { McpToolsManager } from "./McpToolsManager"
import { AddCustomMcp } from "./AddCustomMcp"
import { ToolCountWarning } from "./ToolCountWarning"
import { MCP_SERVERS, type ServerConfig } from "@/constants/mcpServers"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/primitives/popover"
import { TOOLS_WARNING_THRESHOLD, HIDE_LOCAL_MODE } from "@/constants"
import { PlusIcon, type PlusIconHandle } from "@assets/icons/ui/plus"
import { McpServerDefault } from "@assets/brands/integrations/McpServerDefault"
import { useMcpStore, type McpState } from "@/stores"

interface McpManagerProps {
    onBack: () => void
}

// Helper to convert custom server data to ServerConfig
const customServerToConfig = (server: { id: string; name: string; url: string; description: string; image?: string; requiresAuthentication: boolean; initialEnabled?: boolean; initialAuthenticated?: boolean }): ServerConfig => ({
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
    const plusIconRef = useRef<PlusIconHandle>(null)

    // Store state with typed selectors
    const serverStatuses = useMcpStore((state: McpState) => state.serverStatuses)
    const customServers = useMcpStore((state: McpState) => state.customServers)
    const mcpToolCount = useMcpStore((state: McpState) => state.mcpToolCount)
    const cloudToolCount = useMcpStore((state: McpState) => state.cloudToolCount)
    const totalToolCount = useMcpStore((state: McpState) => state.totalToolCount)
    const searchQuery = useMcpStore((state: McpState) => state.searchQuery)
    const activeView = useMcpStore((state: McpState) => state.activeView)
    const selectedServerId = useMcpStore((state: McpState) => state.selectedServerId)
    const isInitialized = useMcpStore((state: McpState) => state.isInitialized)

    // Store actions
    const initialize = useMcpStore((state: McpState) => state.initialize)
    const setSearchQuery = useMcpStore((state: McpState) => state.setSearchQuery)
    const navigateToTools = useMcpStore((state: McpState) => state.navigateToTools)
    const navigateToList = useMcpStore((state: McpState) => state.navigateToList)
    const navigateToAddCustom = useMcpStore((state: McpState) => state.navigateToAddCustom)
    const deleteCustomServer = useMcpStore((state: McpState) => state.deleteCustomServer)
    const loadCustomServers = useMcpStore((state: McpState) => state.loadCustomServers)

    // Initialize store on mount
    useEffect(() => {
        if (!isInitialized) {
            initialize()
        }
    }, [isInitialized, initialize])

    // Reload custom servers when returning from add-custom view
    useEffect(() => {
        if (activeView === 'list') {
            loadCustomServers()
        }
    }, [activeView, loadCustomServers])

    const showWarning = totalToolCount > TOOLS_WARNING_THRESHOLD

    // Convert custom servers to ServerConfig format
    const customServerConfigs = useMemo(() =>
        customServers.map(customServerToConfig),
        [customServers]
    )

    // Filter servers based on search query
    const filteredServers = useMemo(() => {
        const allServers = [...customServerConfigs, ...MCP_SERVERS]

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

            // Priority 1: Enabled servers first
            const aEnabled = aStatus?.isEnabled ?? a.initialEnabled ? 1 : 0
            const bEnabled = bStatus?.isEnabled ?? b.initialEnabled ? 1 : 0
            if (aEnabled !== bEnabled) return bEnabled - aEnabled

            // Priority 2: Authenticated servers next
            const aAuth = aStatus?.isAuthenticated ?? a.initialAuthenticated ? 1 : 0
            const bAuth = bStatus?.isAuthenticated ?? b.initialAuthenticated ? 1 : 0
            if (aAuth !== bAuth) return bAuth - aAuth

            return 0
        })
    }, [searchQuery, serverStatuses, customServerConfigs])

    const handleManageTools = (serverId: string) => {
        navigateToTools(serverId)
    }

    const handleBackToList = () => {
        navigateToList()
    }

    const handleDeleteServer = async (serverId: string) => {
        try {
            await deleteCustomServer(serverId)
        } catch (error) {
            console.error('Failed to delete custom MCP server:', error)
        }
    }

    const handlePlusIconClick = () => {
        navigateToAddCustom()

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
        <div className="flex flex-col h-screen max-h-screen bg-[var(--bg-primary,#0a0e1a)] text-[var(--text-primary,#ffffff)] overflow-hidden">
            <McpHeader title="MCP Server Management" onBack={onBack} />

            {showWarning && (
                <ToolCountWarning
                    cloudToolCount={cloudToolCount}
                    mcpToolCount={mcpToolCount}
                    totalToolCount={totalToolCount}
                />
            )}

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
            <div className="px-5 py-4 bg-[var(--bg-primary,#0a0e1a)] border-b border-[var(--border-color,rgba(255,255,255,0.08))]" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div className="relative flex items-center bg-[var(--bg-secondary,#0f1420)] border border-[var(--border-color,rgba(255,255,255,0.08))] rounded-[10px] transition-all duration-200 focus-within:bg-[var(--bg-tertiary,#141f30)] focus-within:border-[var(--blue-stride,#1264FF)] focus-within:ring-2 focus-within:ring-[rgba(18,100,255,0.1)]" style={{ flex: 1 }}>
                    <svg
                        className="absolute left-3.5 text-[var(--text-tertiary,rgba(255,255,255,0.4))] pointer-events-none transition-colors duration-200"
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
                        className="w-full py-3 pr-4 pl-11 bg-transparent border-none outline-none text-[var(--text-primary,#ffffff)] text-sm font-inherit placeholder:text-[var(--text-tertiary,rgba(255,255,255,0.4))]"
                        placeholder="Search MCP servers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Search MCP servers"
                    />
                    {searchQuery && (
                        <button
                            className="absolute right-2.5 flex items-center justify-center w-7 h-7 p-0 bg-transparent border-none rounded-md text-[#a3a3a3] cursor-pointer transition-all duration-200 hover:bg-[#404040] hover:text-white  focus-visible:outline-2 focus-visible:outline-[#3b82f6] focus-visible:outline-offset-2"
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

            <div className="mcp-scrollable flex-1 overflow-y-auto overflow-x-hidden p-5 bg-[#0a0e1a] min-h-0">
                {filteredServers.length > 0 ? (
                    <ul className="list-none m-0 p-0 flex flex-col gap-3" role="list">
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
                                    authConfig={server.authConfig}
                                    onManageTools={handleManageTools}
                                    onDelete={server.isCustom ? handleDeleteServer : undefined}
                                />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center justify-center py-[60px] px-5 text-center">
                        <svg
                            className="text-[#525252] mb-4 opacity-50"
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
                        <p className="m-0 mb-2 text-base font-semibold text-[#d4d4d4]">No servers found</p>
                        <p className="m-0 text-sm text-[#737373]">
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
