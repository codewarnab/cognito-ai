import React from "react"
import { Sliders } from "lucide-react"

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
        <div className="mcp-card__actions">
            {requiresAuth ? (
                isAuthenticated ? (
                    <>
                        {isEnabled && onManageTools && (
                            <button
                                className={`btn btn--secondary btn--sm ${isNarrowView ? 'btn--icon' : ''}`}
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
                                className={`btn btn--secondary btn--sm ${isNarrowView ? 'btn--icon' : ''}`}
                                onClick={onHealthCheck}
                                disabled={isLoading}
                                title="Check server health"
                            >
                                {isNarrowView ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                    </svg>
                                ) : (
                                    isLoading && healthCheckStatus.includes('Checking') ? 'Checking...' : 'Health Check'
                                )}
                            </button>
                        )}
                        <button
                            className="btn btn--secondary btn--sm"
                            onClick={onLogout}
                            disabled={isLoading}
                        >
                            {isLoading && !healthCheckStatus.includes('Checking') ? 'Loading...' : 'Logout'}
                        </button>
                    </>
                ) : (
                    <button
                        className="btn btn--primary btn--sm"
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
                            className={`btn btn--secondary btn--sm ${isNarrowView ? 'btn--icon' : ''}`}
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
                            className={`btn btn--secondary btn--sm ${isNarrowView ? 'btn--icon' : ''}`}
                            onClick={onHealthCheck}
                            disabled={isLoading}
                            title="Check server health"
                        >
                            {isNarrowView ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                </svg>
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
