import React from "react"
import { Popover, PopoverTrigger, PopoverContent } from "../../ui/primitives/popover"
import { TOOLS_WARNING_THRESHOLD } from "../../../constants"

interface ToolCountWarningProps {
    cloudToolCount: number
    mcpToolCount: number
    totalToolCount: number
}

export const ToolCountWarning: React.FC<ToolCountWarningProps> = ({
    cloudToolCount,
    mcpToolCount,
    totalToolCount
}) => {
    return (
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
    )
}
