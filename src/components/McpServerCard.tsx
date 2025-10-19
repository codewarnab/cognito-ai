import React, { useState, useEffect, useRef } from "react"
import { Info, Sliders } from "lucide-react"
import { StatusBadge } from "./ui/StatusBadge"
import { Toggle } from "./ui/Toggle"
import { ConfirmDialog } from "./ui/ConfirmDialog"
import type { McpServerStatus, McpExtensionMessage, McpExtensionResponse } from "../mcp/types"

interface McpServerCardProps {
    id: string
    name: string
    icon: React.ReactNode
    description: string
    initialEnabled?: boolean
    initialAuthenticated?: boolean
    requiresAuth?: boolean
    paid?: boolean
    onManageTools?: (serverId: string) => void
}

export const McpServerCard: React.FC<McpServerCardProps> = ({
    id,
    name,
    icon,
    description,
    initialEnabled = false,
    initialAuthenticated = false,
    requiresAuth = true,
    paid = false,
    onManageTools
}) => {
    const [isEnabled, setIsEnabled] = useState(initialEnabled)
    const [isAuthenticated, setIsAuthenticated] = useState(initialAuthenticated)
    const [status, setStatus] = useState<McpServerStatus>({ serverId: id, state: 'disconnected' })
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [showDisableConfirm, setShowDisableConfirm] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [healthCheckStatus, setHealthCheckStatus] = useState<string>('')
    const [isNarrowView, setIsNarrowView] = useState(false)
    const [showTooltip, setShowTooltip] = useState(false)

    // Store timeout IDs to avoid state updates after unmount
    const clearSuccessTimeoutRef = useRef<number | null>(null)
    const clearHealthStatusTimeoutRef = useRef<number | null>(null)
    const cardRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        return () => {
            if (clearSuccessTimeoutRef.current !== null) {
                clearTimeout(clearSuccessTimeoutRef.current)
            }
            if (clearHealthStatusTimeoutRef.current !== null) {
                clearTimeout(clearHealthStatusTimeoutRef.current)
            }
        }
    }, [])

    // Monitor card width for responsive button display
    useEffect(() => {
        if (!cardRef.current) return

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width
                // Switch to icon view when card width is less than 400px
                setIsNarrowView(width < 330)
            }
        })

        resizeObserver.observe(cardRef.current)

        return () => {
            resizeObserver.disconnect()
        }
    }, [])

    useEffect(() => {
        loadStatus()

        const handleMessage = (message: any) => {
            if (message.type === `mcp/${id}/status/update`) {
                const newStatus = message.payload as McpServerStatus
                setStatus(newStatus)

                // Only set authenticated if we have completed auth or are fully connected
                // Do NOT set authenticated during intermediate states like 'registering' or 'authorizing'
                if (newStatus.state === 'authenticated' ||
                    newStatus.state === 'connected' ||
                    newStatus.state === 'token-refresh') {
                    setIsAuthenticated(true)
                } else if (newStatus.state === 'disconnected' ||
                    newStatus.state === 'needs-auth' ||
                    newStatus.state === 'invalid-token' ||
                    newStatus.state === 'error' ||
                    newStatus.state === 'registering' ||
                    newStatus.state === 'authorizing' ||
                    newStatus.state === 'connecting') {
                    setIsAuthenticated(false)
                    setIsEnabled(false)
                }

                if (newStatus.state === 'connected') {
                    setIsEnabled(true)
                }
            }
        }

        chrome.runtime.onMessage.addListener(handleMessage)

        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage)
        }
    }, [id])

    // Handle clicking outside tooltip to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showTooltip && !event.composedPath().some((el) => {
                const target = el as Element
                return target.classList?.contains('mcp-card__info-container') ||
                    target.classList?.contains('mcp-card__tooltip')
            })) {
                setShowTooltip(false)
            }
        }

        if (showTooltip) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showTooltip])


    const loadStatus = async () => {
        try {
            const response = await sendMessage({ type: `mcp/${id}/status/get` })
            if (response.success && response.data) {
                const currentStatus = response.data as McpServerStatus
                setStatus(currentStatus)

                // Only set authenticated if we have completed auth or are fully connected
                // Do NOT set authenticated during intermediate states like 'registering' or 'authorizing'
                if (currentStatus.state === 'authenticated' ||
                    currentStatus.state === 'connected' ||
                    currentStatus.state === 'token-refresh') {
                    setIsAuthenticated(true)
                } else if (currentStatus.state === 'disconnected' ||
                    currentStatus.state === 'needs-auth' ||
                    currentStatus.state === 'invalid-token' ||
                    currentStatus.state === 'error' ||
                    currentStatus.state === 'registering' ||
                    currentStatus.state === 'authorizing' ||
                    currentStatus.state === 'connecting') {
                    setIsAuthenticated(false)
                    setIsEnabled(false)
                }

                if (currentStatus.state === 'connected') {
                    setIsEnabled(true)
                }
            }
        } catch (error) {
            console.error(`[McpServerCard:${id}] Failed to load status:`, error)
        }
    }

    const sendMessage = (message: McpExtensionMessage): Promise<McpExtensionResponse> => {
        return new Promise((resolve, reject) => {
            let settled = false

            try {
                console.log(`[McpServerCard:${id}] Sending message:`, message.type)
                chrome.runtime.sendMessage(message, (response) => {
                    if (settled) return
                    settled = true

                    const lastError = chrome.runtime.lastError
                    if (lastError) {
                        const errorMessage = lastError.message || 'Unknown runtime error'
                        console.error(`[McpServerCard:${id}] Runtime error:`, errorMessage)
                        reject({ success: false, error: `chrome.runtime.lastError: ${errorMessage}` })
                        return
                    }

                    if (response === undefined) {
                        console.error(`[McpServerCard:${id}] No response received for:`, message.type)
                        resolve({ success: false, error: 'No response' })
                        return
                    }

                    console.log(`[McpServerCard:${id}] Response received:`, message.type, response)
                    resolve(response as McpExtensionResponse)
                })
            } catch (err) {
                if (settled) return
                settled = true
                console.error(`[McpServerCard:${id}] Send message error:`, err)
                reject(err)
            }
        })
    }

    const handleToggle = async (checked: boolean) => {
        if (checked) {
            setIsLoading(true)
            setHealthCheckStatus('Enabling...')
            try {
                const response = await sendMessage({ type: `mcp/${id}/enable` })
                if (response.success) {
                    setIsEnabled(true)
                    setHealthCheckStatus('✓ Connected and verified')
                    // Clear success message after 3 seconds
                    if (clearSuccessTimeoutRef.current !== null) {
                        clearTimeout(clearSuccessTimeoutRef.current)
                    }
                    clearSuccessTimeoutRef.current = window.setTimeout(() => setHealthCheckStatus(''), 3000)
                } else {
                    setHealthCheckStatus('')
                    alert(response.error || 'Failed to enable server')
                }
            } catch (error) {
                console.error(`[McpServerCard:${id}] Enable error:`, error)
                setHealthCheckStatus('')
                alert('Failed to enable server')
            } finally {
                setIsLoading(false)
            }
        } else {
            setShowDisableConfirm(true)
        }
    }

    const handleHealthCheck = async () => {
        if (!isEnabled) return

        setIsLoading(true)
        setHealthCheckStatus('Checking...')
        try {
            const response = await sendMessage({ type: `mcp/${id}/health/check` })
            if (response.success) {
                const toolCount = response.data?.toolCount || 0
                setHealthCheckStatus(`✓ Healthy (${toolCount} tools available)`)
                console.log(`[McpServerCard:${id}] Health check success:`, response.data)
            } else {
                setHealthCheckStatus(`✗ Failed: ${response.error}`)
                console.error(`[McpServerCard:${id}] Health check failed:`, response.error)
            }
        } catch (error) {
            console.error(`[McpServerCard:${id}] Health check error:`, error)
            setHealthCheckStatus('✗ Health check failed')
        } finally {
            setIsLoading(false)
            // Clear status after 5 seconds
            if (clearHealthStatusTimeoutRef.current !== null) {
                clearTimeout(clearHealthStatusTimeoutRef.current)
            }
            clearHealthStatusTimeoutRef.current = window.setTimeout(() => setHealthCheckStatus(''), 5000)
        }
    }

    const handleAuthenticate = async () => {
        setIsLoading(true)
        try {
            const response = await sendMessage({ type: `mcp/${id}/auth/start` })
            if (response.success) {
                // Authentication was successful - reload status to get the actual state
                await loadStatus()
            } else {
                // Authentication failed or was cancelled
                alert(response.error || 'Authentication failed')
                // Reload status to ensure UI reflects the actual server state
                await loadStatus()
            }
        } catch (error) {
            console.error(`[McpServerCard:${id}] Auth error:`, error)
            alert('Authentication failed')
            // Reload status to ensure UI reflects the actual server state
            await loadStatus()
        } finally {
            setIsLoading(false)
        }
    }

    const handleLogout = () => {
        setShowLogoutConfirm(true)
    }

    const confirmLogout = async () => {
        setIsLoading(true)
        try {
            const response = await sendMessage({ type: `mcp/${id}/disconnect` })
            if (response.success) {
                setIsAuthenticated(false)
                setIsEnabled(false)
            }
        } catch (error) {
            console.error(`[McpServerCard:${id}] Logout error:`, error)
        } finally {
            setIsLoading(false)
            setShowLogoutConfirm(false)
        }
    }

    const confirmDisable = async () => {
        setIsLoading(true)
        try {
            const response = await sendMessage({ type: `mcp/${id}/disable` })
            if (response.success) {
                setIsEnabled(false)
            }
        } catch (error) {
            console.error(`[McpServerCard:${id}] Disable error:`, error)
        } finally {
            setIsLoading(false)
            setShowDisableConfirm(false)
        }
    }

    const getBadgeState = (): "authenticated" | "not-authenticated" => {
        switch (status.state) {
            case 'connected':
            case 'connecting':
            case 'token-refresh':
            case 'authenticated':
                return 'authenticated'
            default:
                return 'not-authenticated'
        }
    }

    return (
        <>
            <div className="mcp-card" ref={cardRef}>
                <div className="mcp-card__header">
                    <div className="mcp-card__left">
                        <div className="mcp-card__icon" aria-hidden="true">
                            {icon}
                        </div>
                        <div className="mcp-card__name-container">
                            <h3 className="mcp-card__name">{name}</h3>
                            {paid && (
                                <span className="mcp-card__service-badge">
                                    PAID
                                </span>
                            )}
                        </div>
                        {!isNarrowView && (
                            <div className="mcp-card__info-container">
                                <button
                                    className="mcp-card__info-btn"
                                    onClick={() => setShowTooltip(!showTooltip)}
                                    aria-label={`Show information about ${name}`}
                                    title={`Show information about ${name}`}
                                >
                                    <Info size={16} />
                                </button>
                                {showTooltip && (
                                    <div className="mcp-card__tooltip">
                                        <div className="mcp-card__tooltip-content">
                                            {description}
                                        </div>
                                        <div className="mcp-card__tooltip-arrow"></div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="mcp-card__right">
                        <Toggle
                            checked={isEnabled}
                            onChange={handleToggle}
                            label="Enable"
                            disabled={isLoading || (requiresAuth && !isAuthenticated)}
                        />
                    </div>
                </div>

                <div className="mcp-card__footer">
                    {requiresAuth && (
                        <StatusBadge
                            state={getBadgeState()}
                        />
                    )}
                    {status.error && (
                        <span className="mcp-card__error" style={{ fontSize: '12px', color: '#ef4444' }}>
                            {status.error}
                        </span>
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
                    <div className="mcp-card__actions">
                        {requiresAuth ? (
                            isAuthenticated ? (
                                <>
                                    {isEnabled && onManageTools && (
                                        <button
                                            className={`btn btn--secondary btn--sm ${isNarrowView ? 'btn--icon' : ''}`}
                                            onClick={() => onManageTools(id)}
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
                                            onClick={handleHealthCheck}
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
                                        onClick={handleLogout}
                                        disabled={isLoading}
                                    >
                                        {isLoading && !healthCheckStatus.includes('Checking') ? 'Loading...' : 'Logout'}
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="btn btn--primary btn--sm"
                                    onClick={handleAuthenticate}
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
                                        onClick={() => onManageTools(id)}
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
                                        onClick={handleHealthCheck}
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
                </div>
            </div>

            <ConfirmDialog
                isOpen={showLogoutConfirm}
                title="Logout from Server"
                message={`Are you sure you want to logout from ${name}? You will need to re-authenticate to use this server.`}
                confirmLabel="Logout"
                cancelLabel="Cancel"
                variant="warning"
                onConfirm={confirmLogout}
                onCancel={() => setShowLogoutConfirm(false)}
            />

            <ConfirmDialog
                isOpen={showDisableConfirm}
                title="Disable Server"
                message={`Are you sure you want to disable ${name}?`}
                confirmLabel="Disable"
                cancelLabel="Cancel"
                variant="default"
                onConfirm={confirmDisable}
                onCancel={() => setShowDisableConfirm(false)}
            />
        </>
    )
}
