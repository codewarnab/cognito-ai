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
        <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex flex-col gap-2 flex-1 min-w-0">
                {requiresAuth && (
                    <StatusBadge state={badgeState} />
                )}
                {status.error && (
                    <div className="flex flex-col gap-1 w-full">
                        <span className={`flex items-center gap-1 font-medium text-xs ${
                            status.state === 'cloudflare-error' ? 'text-amber-500' : 'text-red-500'
                        }`}>
                            {status.state === 'cloudflare-error' && (
                                <span className="text-sm">⚠️</span>
                            )}
                            {status.error}
                        </span>
                        {status.state === 'cloudflare-error' && (
                            <span className="text-[11px] text-gray-500 italic leading-snug">
                                This is a server-side issue with {serverName}. Not related to your setup or authentication. The extension will retry automatically.
                            </span>
                        )}
                    </div>
                )}
                {healthCheckStatus && (
                    <span className={`font-medium text-xs ${
                        healthCheckStatus.startsWith('✓') ? 'text-emerald-500' : 
                        healthCheckStatus.startsWith('✗') ? 'text-red-500' : 'text-gray-500'
                    }`}>
                        {healthCheckStatus}
                    </span>
                )}
            </div>
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
