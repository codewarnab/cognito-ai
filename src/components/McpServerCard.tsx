import React, { useState, useEffect } from "react"
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
                } else if (newStatus.state === 'disconnected' || newStatus.state === 'needs-auth') {
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
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                resolve(response || { success: false, error: 'No response' })
            })
        })
    }

    const handleToggle = async (checked: boolean) => {
        if (!isNotion) {
            setIsEnabled(checked)
            return
        }

        if (checked) {
            setIsLoading(true)
            try {
                const response = await sendMessage({ type: 'mcp/notion/enable' })
                if (response.success) {
                    setIsEnabled(true)
                } else {
                    alert(response.error || 'Failed to enable server')
                }
            } catch (error) {
                console.error('Enable error:', error)
                alert('Failed to enable server')
            } finally {
                setIsLoading(false)
            }
        } else {
            setShowDisableConfirm(true)
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
                    <div className="mcp-card__actions">
                        {isAuthenticated ? (
                            <button
                                className="btn btn--secondary btn--sm"
                                onClick={handleLogout}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Loading...' : 'Logout'}
                            </button>
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
                message={`Are you sure you want to logout from ? You will need to re-authenticate to use this server.`}
                confirmLabel="Logout"
                cancelLabel="Cancel"
                variant="warning"
                onConfirm={confirmLogout}
                onCancel={() => setShowLogoutConfirm(false)}
            />

            <ConfirmDialog
                isOpen={showDisableConfirm}
                title="Disable Server"
                message={`Are you sure you want to disable ?`}
                confirmLabel="Disable"
                cancelLabel="Cancel"
                variant="default"
                onConfirm={confirmDisable}
                onCancel={() => setShowDisableConfirm(false)}
            />
        </>
    )
}
