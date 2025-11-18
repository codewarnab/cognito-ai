import { useState, useEffect, useRef } from "react"
import type { McpServerStatus, McpExtensionMessage, McpExtensionResponse } from "../../../../mcp/types"

interface UseMcpServerOptions {
    id: string
    initialEnabled?: boolean
    initialAuthenticated?: boolean
}

export const useMcpServer = ({
    id,
    initialEnabled = false,
    initialAuthenticated = false
}: UseMcpServerOptions) => {
    const [isEnabled, setIsEnabled] = useState(initialEnabled)
    const [isAuthenticated, setIsAuthenticated] = useState(initialAuthenticated)
    const [status, setStatus] = useState<McpServerStatus>({ serverId: id, state: 'disconnected' })
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

    const handleToggle = async (checked: boolean): Promise<string | void> => {
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
            return 'show-disable-confirm'
        }
    }

    const handleHealthCheck = async () => {
        if (!isEnabled) return

        setIsLoading(true)
        setHealthCheckStatus('Checking...')
        try {
            const response = await sendMessage({ type: `mcp/${id}/health/check` })
            if (response.success) {
                const toolCount = (response.data as { toolCount?: number })?.toolCount || 0
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

    const handleLogout = async () => {
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
        }
    }

    const handleDisable = async () => {
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

    return {
        isEnabled,
        isAuthenticated,
        status,
        isLoading,
        healthCheckStatus,
        handleToggle,
        handleHealthCheck,
        handleAuthenticate,
        handleLogout,
        handleDisable,
        getBadgeState
    }
}
