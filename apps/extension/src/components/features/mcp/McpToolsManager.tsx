import React, { useState, useEffect, useCallback, useRef } from "react"
import { McpHeader } from "./McpHeader"
import { MCP_SERVERS } from "@/constants/mcpServers"
import { Toggle } from "../../ui/primitives/toggle/Toggle"
import { sendMcpMessage } from "@/lib/messaging"
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
                const toolsResponse = await sendMcpMessage(serverId, 'tools/list')

                if (!toolsResponse.success) {
                    throw new Error(toolsResponse.error || 'Failed to fetch tools')
                }

                // Fetch disabled tools config
                const configResponse = await sendMcpMessage(serverId, 'tools/config/get')

                if (!configResponse.success) {
                    throw new Error(configResponse.error || 'Failed to fetch tool configuration')
                }

                setTools(toolsResponse.data?.tools || [])
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
                const response = await sendMcpMessage(serverId, 'tools/config/set', {
                    disabledTools: newDisabledTools
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

    const truncateDescription = (description: string | undefined, maxLength: number = 80): { text: string, isTruncated: boolean } => {
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
        <div className="flex flex-col h-screen max-h-screen bg-gradient-to-b from-[var(--bg-primary,#0a0e1a)] to-[#0d1220] text-[var(--text-primary,#ffffff)] overflow-hidden">
            <McpHeader title="Manage Tools" onBack={onBack} />

            {/* Server Info - Minimal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-[rgba(59,130,246,0.15)] to-[rgba(139,92,246,0.1)] border border-[rgba(59,130,246,0.2)] rounded-lg text-[var(--blue-stride,#1264FF)] shrink-0 [&>svg]:w-5 [&>svg]:h-5 [&>img]:w-5 [&>img]:h-5">
                        {serverConfig?.icon}
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <h2 className="m-0 text-[17px] font-semibold text-white tracking-tight">{serverConfig?.name}</h2>
                        <p className="m-0 text-[13px] text-[rgba(255,255,255,0.5)] font-normal">Configure AI tool access</p>
                    </div>
                </div>

                {!loading && tools.length > 0 && (
                    <div className="flex items-center gap-1">
                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)] rounded-full">
                            <span className="text-xs font-bold text-[#22c55e] tabular-nums">{enabledCount}</span>
                            <span className="text-[10px] font-medium text-[rgba(34,197,94,0.8)] lowercase">active</span>
                        </div>
                        <span className="text-[10px] text-[rgba(255,255,255,0.2)] font-light">/</span>
                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-full muted">
                            <span className="text-xs font-bold text-[rgba(255,255,255,0.7)] tabular-nums">{tools.length}</span>
                            <span className="text-[10px] font-medium text-[rgba(255,255,255,0.4)] lowercase">total</span>
                        </div>
                    </div>
                )}
            </div>

            {allToolsDisabled && (
                <div className="flex items-center gap-2 mx-6 mb-4 p-2.5 bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] rounded-lg text-[#f59e0b] text-[13px] font-medium">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-90">
                        <path d="M8 5.5V8.5M8 10.5H8.005M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Enable at least one tool</span>
                </div>
            )}

            {/* Tools List */}
            <div className="mcp-scrollable flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6 pt-4 min-h-0 max-h-[calc(100vh-145px)]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-[60px] px-5 gap-4 text-center">
                        <div className="w-8 h-8 border-2 border-[rgba(255,255,255,0.1)] border-t-[#3b82f6] rounded-full animate-spin"></div>
                        <span className="text-sm font-medium text-[rgba(255,255,255,0.5)]">Loading tools...</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-[60px] px-5 gap-4 text-center">
                        <div className="text-[rgba(239,68,68,0.7)]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M12 7V13M12 16V16.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>
                        <p className="m-0 text-sm text-[rgba(255,255,255,0.6)] max-w-[280px]">{error}</p>
                        <button className="px-5 py-2 bg-[rgba(59,130,246,0.15)] border border-[rgba(59,130,246,0.3)] rounded-lg text-[#3b82f6] text-[13px] font-semibold cursor-pointer transition-all duration-200 hover:bg-[rgba(59,130,246,0.25)] hover:border-[rgba(59,130,246,0.4)]" onClick={handleRetry}>
                            Try again
                        </button>
                    </div>
                ) : tools.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-[60px] px-5 text-center">
                        <div className="flex items-center justify-center w-16 h-16 mb-4 bg-[rgba(255,255,255,0.05)] rounded-2xl text-[rgba(255,255,255,0.3)]">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h3 className="m-[0_0_6px] text-base font-semibold text-[rgba(255,255,255,0.8)]">No tools available</h3>
                        <p className="m-0 text-[13px] text-[rgba(255,255,255,0.4)]">Make sure the server is connected and enabled</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {tools.map((tool, index) => {
                            const isEnabled = !disabledTools.includes(tool.name)
                            const { text, isTruncated } = truncateDescription(tool.description)
                            const isExpanded = expandedDescriptions.has(tool.name)

                            return (
                                <div
                                    key={tool.name}
                                    className={`bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-[14px] transition-all  hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)] hover:shadow-xl animate-in slide-in-from-bottom-2 fade-in duration-300 ${isEnabled ? 'border-[rgba(59,130,246,0.2)] bg-gradient-to-br from-[rgba(59,130,246,0.05)] to-[rgba(255,255,255,0.03)] hover:border-[rgba(59,130,246,0.3)]' : ''}`}
                                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                                >
                                    <div className="p-[16px_18px]">
                                        <div className="flex items-center justify-between gap-3 mb-2">
                                            <h4 className={`m-0 text-sm font-semibold tracking-tight ${isEnabled ? 'text-white' : 'text-[rgba(255,255,255,0.6)]'}`}>{tool.name}</h4>
                                            <Toggle
                                                checked={isEnabled}
                                                onChange={() => handleToggleTool(tool.name)}
                                                disabled={false}
                                                size="sm"
                                            />
                                        </div>
                                        <p className={`m-0 text-[13px] leading-relaxed ${isEnabled ? 'text-[rgba(255,255,255,0.55)]' : 'text-[rgba(255,255,255,0.35)]'}`}>
                                            {isExpanded || !isTruncated ? (tool.description || 'No description available') : text}
                                            {isTruncated && (
                                                <button
                                                    className="bg-none border-none text-[#3b82f6] text-xs font-semibold cursor-pointer p-0 ml-1 opacity-90 transition-opacity hover:opacity-100 hover:underline"
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
