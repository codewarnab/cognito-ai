import React from "react"
import { Sliders } from "lucide-react"
import { HeartPulseIcon } from "@/components/shared/icons"

interface McpServerCardActionsProps {
    serverId: string
    isEnabled: boolean
    isLoading: boolean
    isAuthenticated: boolean
    requiresAuth?: boolean
    isNarrowView: boolean
    healthCheckStatus: string
    onManageTools?: (serverId: string) => void
    onHealthCheck: () => void
    onAuthenticate: () => void
    onLogout: () => void
}

// Button style constants
const btnBase = "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
const btnSecondary = `${btnBase} px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 hover:text-white`
const btnSecondaryIcon = `${btnBase} p-1.5 bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 hover:text-white`
const btnPrimary = `${btnBase} px-4 py-1.5 text-xs bg-[#2563eb] text-white hover:bg-[#1d4ed8]`

export const McpServerCardActions: React.FC<McpServerCardActionsProps> = ({
    serverId,
    isEnabled,
    isLoading,
    isAuthenticated,
    requiresAuth = true,
    isNarrowView,
    healthCheckStatus,
    onManageTools,
    onHealthCheck,
    onAuthenticate,
    onLogout
}) => {
    return (
        <div className="flex gap-2">
            {requiresAuth ? (
                isAuthenticated ? (
                    <>
                        {isEnabled && onManageTools && (
                            <button
                                className={isNarrowView ? btnSecondaryIcon : btnSecondary}
                                onClick={() => onManageTools(serverId)}
                                disabled={isLoading}
                                title="Manage Tools"
                            >
                                {isNarrowView ? (
                                    <Sliders size={16} />
                                ) : (
                                    'Manage Tools'
                                )}
                            </button>
                        )}
                        {isEnabled && (
                            <button
                                className={isNarrowView ? btnSecondaryIcon : btnSecondary}
                                onClick={onHealthCheck}
                                disabled={isLoading}
                                title="Check server health"
                            >
                                {isNarrowView ? (
                                    <HeartPulseIcon size={16} />
                                ) : (
                                    isLoading && healthCheckStatus.includes('Checking') ? 'Checking...' : 'Health Check'
                                )}
                            </button>
                        )}
                        <button
                            className={btnSecondary}
                            onClick={onLogout}
                            disabled={isLoading}
                        >
                            {isLoading && !healthCheckStatus.includes('Checking') ? 'Loading...' : 'Logout'}
                        </button>
                    </>
                ) : (
                    <button
                        className={btnPrimary}
                        onClick={onAuthenticate}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Connecting...' : 'Connect'}
                    </button>
                )
            ) : (
                <>
                    {isEnabled && onManageTools && (
                        <button
                            className={isNarrowView ? btnSecondaryIcon : btnSecondary}
                            onClick={() => onManageTools(serverId)}
                            disabled={isLoading}
                            title="Manage Tools"
                        >
                            {isNarrowView ? (
                                <Sliders size={16} />
                            ) : (
                                'Manage Tools'
                            )}
                        </button>
                    )}
                    {isEnabled && (
                        <button
                            className={isNarrowView ? btnSecondaryIcon : btnSecondary}
                            onClick={onHealthCheck}
                            disabled={isLoading}
                            title="Check server health"
                        >
                            {isNarrowView ? (
                                <HeartPulseIcon size={16} />
                            ) : (
                                isLoading && healthCheckStatus.includes('Checking') ? 'Checking...' : 'Health Check'
                            )}
                        </button>
                    )}
                </>
            )}
        </div>
    )
}
