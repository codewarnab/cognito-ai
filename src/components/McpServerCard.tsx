import React, { useState, useEffect, useRef } from "react"
import { StatusBadge } from "./ui/StatusBadge"
import { Toggle } from "./ui/Toggle"
import { ConfirmDialog } from "./ui/ConfirmDialog"
import type { NotionMcpStatus, NotionMcpMessage, NotionMcpResponse } from "../mcp/types"

interface McpServerCardProps {
    id: string
    name: string
    icon: React.ReactNode
    initialEnabled?: boolean
    initialAuthenticated?: boolean
}

export const McpServerCard: React.FC<McpServerCardProps> = ({
    id,
    name,
    icon,
    initialEnabled = false,
    initialAuthenticated = false
}) => {
    const [isEnabled, setIsEnabled] = useState(initialEnabled)
    const [isAuthenticated, setIsAuthenticated] = useState(initialAuthenticated)
    const [status, setStatus] = useState<NotionMcpStatus>({ state: 'disconnected' })
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [showDisableConfirm, setShowDisableConfirm] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [healthCheckStatus, setHealthCheckStatus] = useState<string>('')

	// Store timeout IDs to avoid state updates after unmount
	const clearSuccessTimeoutRef = useRef<number | null>(null)
	const clearHealthStatusTimeoutRef = useRef<number | null>(null)

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

    const isNotion = id === 'notion'

    useEffect(() => {
        if (!isNotion) return

        loadStatus()

        const handleMessage = (message: any) => {
            if (message.type === 'mcp/notion/status/update') {
                const newStatus = message.payload as NotionMcpStatus
                setStatus(newStatus)

                if (newStatus.state === 'authenticated' ||
                    newStatus.state === 'connected' ||
                    newStatus.state === 'connecting' ||
                    newStatus.state === 'token-refresh') {
                    setIsAuthenticated(true)
                } else if (newStatus.state === 'disconnected' || 
                           newStatus.state === 'needs-auth' || 
                           newStatus.state === 'invalid-token') {
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
    }, [isNotion])

    const loadStatus = async () => {
        if (!isNotion) return

        try {
            const response = await sendMessage({ type: 'mcp/notion/status/get' })
            if (response.success && response.data) {
                const currentStatus = response.data as NotionMcpStatus
                setStatus(currentStatus)

                if (currentStatus.state === 'authenticated' ||
                    currentStatus.state === 'connected' ||
                    currentStatus.state === 'connecting' ||
                    currentStatus.state === 'token-refresh') {
                    setIsAuthenticated(true)
                } else if (currentStatus.state === 'disconnected' || 
                           currentStatus.state === 'needs-auth' || 
                           currentStatus.state === 'invalid-token') {
                    setIsAuthenticated(false)
                    setIsEnabled(false)
                }

                if (currentStatus.state === 'connected') {
                    setIsEnabled(true)
                }
            }
        } catch (error) {
            console.error('Failed to load status:', error)
        }
    }

	const sendMessage = (message: NotionMcpMessage): Promise<NotionMcpResponse> => {
		return new Promise((resolve, reject) => {
			let settled = false
			// Short timeout to avoid hanging promises if callback is never invoked
			const timeoutId = setTimeout(() => {
				if (settled) return
				settled = true
				reject(new Error('Timeout: No response from background script'))
			}, 5000)

			try {
				chrome.runtime.sendMessage(message, (response) => {
					if (settled) return
					settled = true
					clearTimeout(timeoutId)

					const lastError = chrome.runtime.lastError
					if (lastError) {
						const errorMessage = lastError.message || 'Unknown runtime error'
						reject({ success: false, error: `chrome.runtime.lastError: ${errorMessage}` })
						return
					}

					if (response === undefined) {
						resolve({ success: false, error: 'No response' })
						return
					}

					resolve(response as NotionMcpResponse)
				})
			} catch (err) {
				if (settled) return
				settled = true
				clearTimeout(timeoutId)
				reject(err)
			}
		})
	}

    const handleToggle = async (checked: boolean) => {
        if (!isNotion) {
            setIsEnabled(checked)
            return
        }

        if (checked) {
            setIsLoading(true)
            setHealthCheckStatus('Enabling...')
            try {
                const response = await sendMessage({ type: 'mcp/notion/enable' })
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
                console.error('Enable error:', error)
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
        if (!isNotion || !isEnabled) return

        setIsLoading(true)
        setHealthCheckStatus('Checking...')
        try {
            const response = await sendMessage({ type: 'mcp/notion/health/check' })
            if (response.success) {
                const toolCount = response.data?.toolCount || 0
                setHealthCheckStatus(`✓ Healthy (${toolCount} tools available)`)
                console.log('[HealthCheck] Success:', response.data)
            } else {
                setHealthCheckStatus(`✗ Failed: ${response.error}`)
                console.error('[HealthCheck] Failed:', response.error)
            }
        } catch (error) {
            console.error('Health check error:', error)
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
        if (!isNotion) {
            setIsAuthenticated(true)
            return
        }

        setIsLoading(true)
        try {
            const response = await sendMessage({ type: 'mcp/notion/auth/start' })
            if (response.success) {
                setIsAuthenticated(true)
            } else {
                alert(response.error || 'Authentication failed')
            }
        } catch (error) {
            console.error('Auth error:', error)
            alert('Authentication failed')
        } finally {
            setIsLoading(false)
        }
    }

    const handleLogout = () => {
        setShowLogoutConfirm(true)
    }

    const confirmLogout = async () => {
        if (!isNotion) {
            setIsAuthenticated(false)
            setShowLogoutConfirm(false)
            return
        }

        setIsLoading(true)
        try {
            const response = await sendMessage({ type: 'mcp/notion/disconnect' })
            if (response.success) {
                setIsAuthenticated(false)
                setIsEnabled(false)
            }
        } catch (error) {
            console.error('Logout error:', error)
        } finally {
            setIsLoading(false)
            setShowLogoutConfirm(false)
        }
    }

    const confirmDisable = async () => {
        if (!isNotion) {
            setIsEnabled(false)
            setShowDisableConfirm(false)
            return
        }

        setIsLoading(true)
        try {
            const response = await sendMessage({ type: 'mcp/notion/disable' })
            if (response.success) {
                setIsEnabled(false)
            }
        } catch (error) {
            console.error('Disable error:', error)
        } finally {
            setIsLoading(false)
            setShowDisableConfirm(false)
        }
    }

    const getBadgeState = (): "authenticated" | "not-authenticated" => {
        if (!isNotion) {
            return isAuthenticated ? "authenticated" : "not-authenticated"
        }

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
            <div className="mcp-card">
                <div className="mcp-card__header">
                    <div className="mcp-card__left">
                        <div className="mcp-card__icon" aria-hidden="true">
                            {icon}
                        </div>
                        <h3 className="mcp-card__name">{name}</h3>
                    </div>
                    <div className="mcp-card__right">
                        <Toggle
                            checked={isEnabled}
                            onChange={handleToggle}
                            label="Enable"
                            disabled={isLoading || !isAuthenticated}
                        />
                    </div>
                </div>

                <div className="mcp-card__footer">
                    <StatusBadge
                        state={getBadgeState()}
                    />
                    {isNotion && status.error && (
                        <span className="mcp-card__error" style={{ fontSize: '12px', color: '#ef4444' }}>
                            {status.error}
                        </span>
                    )}
                    {isNotion && healthCheckStatus && (
                        <span className="mcp-card__health-status" style={{ 
                            fontSize: '12px', 
                            color: healthCheckStatus.startsWith('✓') ? '#10b981' : healthCheckStatus.startsWith('✗') ? '#ef4444' : '#6b7280',
                            fontWeight: 500
                        }}>
                            {healthCheckStatus}
                        </span>
                    )}
                    <div className="mcp-card__actions">
                        {isAuthenticated ? (
                            <>
                                {isNotion && isEnabled && (
                                    <button
                                        className="btn btn--secondary btn--sm"
                                        onClick={handleHealthCheck}
                                        disabled={isLoading}
                                        title="Check server health"
                                    >
                                        {isLoading && healthCheckStatus.includes('Checking') ? 'Checking...' : 'Health Check'}
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
