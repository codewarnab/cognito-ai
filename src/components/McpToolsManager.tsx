import React, { useState, useEffect, useCallback, useRef } from "react"
import { McpHeader } from "./McpHeader"
import { MCP_SERVERS } from "../constants/mcpServers"
import type { McpTool } from "../mcp/types"

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

    const truncateDescription = (description: string | undefined, maxLength: number = 100): { text: string, isTruncated: boolean } => {
        if (!description) return { text: 'No description available', isTruncated: false }
        if (description.length <= maxLength) return { text: description, isTruncated: false }
        return { text: description.substring(0, maxLength) + '...', isTruncated: true }
    }

    const handleRetry = () => {
        window.location.reload()
    }

    // Show warning if all tools are disabled
    const allToolsDisabled = tools.length > 0 && disabledTools.length === tools.length

    return (
        <div className="mcp-panel">
            <McpHeader title="Manage Tools" onBack={onBack} />

            {/* Server Info */}
            <div className="mcp-tools-header">
                <div className="mcp-tools-server-info">
                    <div className="mcp-tools-server-icon">
                        {serverConfig?.icon}
                    </div>
                    <div className="mcp-tools-server-details">
                        <h3 className="mcp-tools-server-name">{serverConfig?.name}</h3>
                        <p className="mcp-tools-server-description">
                            Select which tools the AI can access from this server
                        </p>
                        {!loading && tools.length > 0 && (
                            <div className="mcp-tools-stats">
                                <span className="mcp-tools-stat mcp-tools-stat--enabled">
                                    {tools.length - disabledTools.length} Enabled
                                </span>
                                <span className="mcp-tools-stat-separator">•</span>
                                <span className="mcp-tools-stat mcp-tools-stat--disabled">
                                    {disabledTools.length} Disabled
                                </span>
                                <span className="mcp-tools-stat-separator">•</span>
                                <span className="mcp-tools-stat mcp-tools-stat--total">
                                    {tools.length} Total
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {allToolsDisabled && (
                    <div className="mcp-tools-warning">
                        At least one tool should be enabled for this server to be useful
                    </div>
                )}
            </div>

            {/* Tools List */}
            <div className="mcp-content">
                {loading ? (
                    <div className="mcp-tools-loading">
                        <div className="mcp-tools-spinner"></div>
                        <p>Loading tools...</p>
                    </div>
                ) : error ? (
                    <div className="mcp-tools-error">
                        <p className="mcp-tools-error-text">{error}</p>
                        <button className="btn btn--primary btn--sm" onClick={handleRetry}>
                            Retry
                        </button>
                    </div>
                ) : tools.length === 0 ? (
                    <div className="mcp-tools-empty">
                        <p className="mcp-tools-empty-text">No tools available from this server</p>
                        <p className="mcp-tools-empty-subtext">
                            Make sure the server is connected and enabled
                        </p>
                    </div>
                ) : (
                    <div className="mcp-tools-list">
                        {tools.map((tool) => {
                            const isEnabled = !disabledTools.includes(tool.name)
                            const { text, isTruncated } = truncateDescription(tool.description)
                            const isExpanded = expandedDescriptions.has(tool.name)

                            return (
                                <div key={tool.name} className={`mcp-tool-item ${isEnabled ? 'mcp-tool-item--enabled' : 'mcp-tool-item--disabled'}`}>
                                    <div className="mcp-tool-main">
                                        <div className="mcp-tool-checkbox-wrapper">
                                            <input
                                                type="checkbox"
                                                id={`tool-${tool.name}`}
                                                className="mcp-tool-checkbox"
                                                checked={isEnabled}
                                                onChange={() => handleToggleTool(tool.name)}
                                            />
                                        </div>
                                        <div className="mcp-tool-info">
                                            <div className="mcp-tool-header">
                                                <label
                                                    htmlFor={`tool-${tool.name}`}
                                                    className="mcp-tool-name"
                                                >
                                                    {tool.name}
                                                </label>
                                                <div className={`mcp-tool-status ${isEnabled ? 'mcp-tool-status--enabled' : 'mcp-tool-status--disabled'}`}>
                                                    <span className="mcp-tool-status-dot"></span>
                                                    <span className="mcp-tool-status-text">
                                                        {isEnabled ? 'Enabled' : 'Disabled'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mcp-tool-description">
                                                {isExpanded || !isTruncated ? (tool.description || 'No description available') : text}
                                                {isTruncated && (
                                                    <button
                                                        className="mcp-tool-read-more"
                                                        onClick={() => toggleDescription(tool.name)}
                                                    >
                                                        {isExpanded ? 'Show less' : 'Show more'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
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
