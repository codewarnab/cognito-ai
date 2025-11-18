import React from "react"
import { StatusBadge } from "../../ui/feedback"
import { McpServerCardActions } from "./McpServerCardActions"
import type { McpServerStatus } from "../../../mcp/types"

interface McpServerCardFooterProps {
    serverId: string
    serverName: string
    status: McpServerStatus
    isEnabled: boolean
    isLoading: boolean
    isAuthenticated: boolean
    requiresAuth?: boolean
    isNarrowView: boolean
    healthCheckStatus: string
    badgeState: "authenticated" | "not-authenticated"
    onManageTools?: (serverId: string) => void
    onHealthCheck: () => void
    onAuthenticate: () => void
    onLogout: () => void
}

export const McpServerCardFooter: React.FC<McpServerCardFooterProps> = ({
    serverId,
    serverName,
    status,
    isEnabled,
    isLoading,
    isAuthenticated,
    requiresAuth = true,
    isNarrowView,
    healthCheckStatus,
    badgeState,
    onManageTools,
    onHealthCheck,
    onAuthenticate,
    onLogout
}) => {
    return (
        <div className="mcp-card__footer">
            {requiresAuth && (
                <StatusBadge state={badgeState} />
            )}
            {status.error && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                    <span
                        className="mcp-card__error"
                        style={{
                            fontSize: '12px',
                            color: status.state === 'cloudflare-error' ? '#f59e0b' : '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 500
                        }}
                    >
                        {status.state === 'cloudflare-error' && (
                            <span style={{ fontSize: '14px' }}>⚠️</span>
                        )}
                        {status.error}
                    </span>
                    {status.state === 'cloudflare-error' && (
                        <span
                            style={{
                                fontSize: '11px',
                                color: '#6b7280',
                                fontStyle: 'italic',
                                lineHeight: '1.4'
                            }}
                        >
                            This is a server-side issue with {serverName}. Not related to your setup or authentication. The extension will retry automatically.
                        </span>
                    )}
                </div>
            )}
            {healthCheckStatus && (
                <span className="mcp-card__health-status" style={{
                    fontSize: '12px',
                    color: healthCheckStatus.startsWith('✓') ? '#10b981' : healthCheckStatus.startsWith('✗') ? '#ef4444' : '#6b7280',
                    fontWeight: 500
                }}>
                    {healthCheckStatus}
                </span>
            )}
            <McpServerCardActions
                serverId={serverId}
                isEnabled={isEnabled}
                isLoading={isLoading}
                isAuthenticated={isAuthenticated}
                requiresAuth={requiresAuth}
                isNarrowView={isNarrowView}
                healthCheckStatus={healthCheckStatus}
                onManageTools={onManageTools}
                onHealthCheck={onHealthCheck}
                onAuthenticate={onAuthenticate}
                onLogout={onLogout}
            />
        </div>
    )
}
