import React, { useState, useEffect, useCallback, useRef } from "react"
import { McpHeader } from "./McpHeader"
import { MCP_SERVERS } from "@/constants/mcpServers"
import type { McpTool } from "../../../mcp/types"

interface McpToolsManagerProps {
    serverId: string
    onBack: () => void
}

export const McpToolsManager: React.FC<McpToolsManagerProps> = ({ serverId, onBack }) => {
    const [tools, setTools] = useState<McpTool[]>([])
    const [disabledTools, setDisabledTools] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())
    const saveTimeoutRef = useRef<number | null>(null)

    const serverConfig = MCP_SERVERS.find(s => s.id === serverId)

    // Fetch tools and disabled config on mount
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            setError(null)

            try {
                // Fetch available tools
                const toolsResponse = await chrome.runtime.sendMessage({
                    type: `mcp/${serverId}/tools/list`
                })

                if (!toolsResponse.success) {
                    throw new Error(toolsResponse.error || 'Failed to fetch tools')
                }

                // Fetch disabled tools config
                const configResponse = await chrome.runtime.sendMessage({
                    type: `mcp/${serverId}/tools/config/get`
                })

                if (!configResponse.success) {
                    throw new Error(configResponse.error || 'Failed to fetch tool configuration')
                }

                setTools(toolsResponse.data || [])
                setDisabledTools(configResponse.data || [])
            } catch (err) {
                console.error('Error fetching tool data:', err)
                setError(err instanceof Error ? err.message : 'Failed to load tools')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [serverId])

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current !== null) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [])

    // Debounced save function
    const debouncedSave = useCallback((newDisabledTools: string[]) => {
        if (saveTimeoutRef.current !== null) {
            clearTimeout(saveTimeoutRef.current)
        }

        saveTimeoutRef.current = window.setTimeout(async () => {
            try {
                const response = await chrome.runtime.sendMessage({
                    type: `mcp/${serverId}/tools/config/set`,
                    payload: { disabledTools: newDisabledTools }
                })

                if (!response.success) {
                    console.error('Failed to save tool configuration:', response.error)
                }
            } catch (err) {
                console.error('Error saving tool configuration:', err)
            }
        }, 500)
    }, [serverId])

    const handleToggleTool = (toolName: string) => {
        const newDisabledTools = disabledTools.includes(toolName)
            ? disabledTools.filter(name => name !== toolName)
            : [...disabledTools, toolName]

        setDisabledTools(newDisabledTools)
        debouncedSave(newDisabledTools)
    }

    const toggleDescription = (toolName: string) => {
        setExpandedDescriptions(prev => {
            const next = new Set(prev)
            if (next.has(toolName)) {
                next.delete(toolName)
            } else {
                next.add(toolName)
            }
            return next
        })
    }

    const truncateDescription = (description: string | undefined, maxLength: number = 120): { text: string, isTruncated: boolean } => {
        if (!description) return { text: 'No description available', isTruncated: false }
        if (description.length <= maxLength) return { text: description, isTruncated: false }
        return { text: description.substring(0, maxLength) + '...', isTruncated: true }
    }

    const handleRetry = () => {
        window.location.reload()
    }

    // Show warning if all tools are disabled
    const allToolsDisabled = tools.length > 0 && disabledTools.length === tools.length
    const enabledCount = tools.length - disabledTools.length

    return (
        <div className="mcp-panel mcp-tools-panel">
            <McpHeader title="Manage Tools" onBack={onBack} />

            {/* Server Info - Minimal Header */}
            <div className="mcp-tools-header-v2">
                <div className="mcp-tools-server-card">
                    <div className="mcp-tools-server-icon-v2">
                        {serverConfig?.icon}
                    </div>
                    <div className="mcp-tools-server-meta">
                        <h2 className="mcp-tools-server-title">{serverConfig?.name}</h2>
                        <p className="mcp-tools-server-subtitle">Configure AI tool access</p>
                    </div>
                </div>

                {!loading && tools.length > 0 && (
                    <div className="mcp-tools-stats-v2">
                        <div className="mcp-tools-stat-pill">
                            <span className="mcp-tools-stat-number">{enabledCount}</span>
                            <span className="mcp-tools-stat-label">active</span>
                        </div>
                        <span className="mcp-tools-stat-divider">/</span>
                        <div className="mcp-tools-stat-pill mcp-tools-stat-pill--muted">
                            <span className="mcp-tools-stat-number">{tools.length}</span>
                            <span className="mcp-tools-stat-label">total</span>
                        </div>
                    </div>
                )}
            </div>

            {allToolsDisabled && (
                <div className="mcp-tools-warning-v2">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 5.5V8.5M8 10.5H8.005M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Enable at least one tool</span>
                </div>
            )}

            {/* Tools List */}
            <div className="mcp-content mcp-tools-content">
                {loading ? (
                    <div className="mcp-tools-loading-v2">
                        <div className="mcp-tools-loader"></div>
                        <span>Loading tools...</span>
                    </div>
                ) : error ? (
                    <div className="mcp-tools-error-v2">
                        <div className="mcp-tools-error-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M12 7V13M12 16V16.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>
                        <p className="mcp-tools-error-message">{error}</p>
                        <button className="mcp-tools-retry-btn" onClick={handleRetry}>
                            Try again
                        </button>
                    </div>
                ) : tools.length === 0 ? (
                    <div className="mcp-tools-empty-v2">
                        <div className="mcp-tools-empty-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h3>No tools available</h3>
                        <p>Make sure the server is connected and enabled</p>
                    </div>
                ) : (
                    <div className="mcp-tools-list-v2">
                        {tools.map((tool, index) => {
                            const isEnabled = !disabledTools.includes(tool.name)
                            const { text, isTruncated } = truncateDescription(tool.description)
                            const isExpanded = expandedDescriptions.has(tool.name)

                            return (
                                <div
                                    key={tool.name}
                                    className={`mcp-tool-card ${isEnabled ? 'mcp-tool-card--active' : ''}`}
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="mcp-tool-card-content">
                                        <div className="mcp-tool-card-header">
                                            <h4 className="mcp-tool-card-name">{tool.name}</h4>
                                            <label className="mcp-toggle" htmlFor={`tool-toggle-${tool.name}`}>
                                                <input
                                                    type="checkbox"
                                                    id={`tool-toggle-${tool.name}`}
                                                    checked={isEnabled}
                                                    onChange={() => handleToggleTool(tool.name)}
                                                />
                                                <span className="mcp-toggle-track">
                                                    <span className="mcp-toggle-thumb"></span>
                                                </span>
                                            </label>
                                        </div>
                                        <p className="mcp-tool-card-desc">
                                            {isExpanded || !isTruncated ? (tool.description || 'No description available') : text}
                                            {isTruncated && (
                                                <button
                                                    className="mcp-tool-expand-btn"
                                                    onClick={() => toggleDescription(tool.name)}
                                                >
                                                    {isExpanded ? 'Less' : 'More'}
                                                </button>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
