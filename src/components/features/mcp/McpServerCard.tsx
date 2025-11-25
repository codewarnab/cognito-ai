import React, { useState, useEffect, useRef } from "react"
import { ConfirmDialog } from "../../ui/primitives/dialog"
import { McpServerCardHeader } from "./McpServerCardHeader"
import { McpServerCardFooter } from "./McpServerCardFooter"
import { useMcpServer } from "./hooks/useMcpServer"

interface McpServerCardProps {
    id: string
    name: string
    icon: React.ReactNode
    description: string
    initialEnabled?: boolean
    initialAuthenticated?: boolean
    requiresAuth?: boolean
    paid?: boolean
    isCustom?: boolean
    onManageTools?: (serverId: string) => void
    onDelete?: (serverId: string) => void
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
    isCustom = false,
    onManageTools,
    onDelete
}) => {
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [showDisableConfirm, setShowDisableConfirm] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isNarrowView, setIsNarrowView] = useState(false)
    const cardRef = useRef<HTMLDivElement>(null)

    // Use custom hook for server state management
    const {
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
    } = useMcpServer({
        id,
        initialEnabled,
        initialAuthenticated
    })

    // Monitor card width for responsive button display
    useEffect(() => {
        if (!cardRef.current) return

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width
                // Switch to icon view when card width is less than 330px
                setIsNarrowView(width < 330)
            }
        })

        resizeObserver.observe(cardRef.current)

        return () => {
            resizeObserver.disconnect()
        }
    }, [])

    const onToggle = async (checked: boolean) => {
        const result = await handleToggle(checked)
        if (result === 'show-disable-confirm') {
            setShowDisableConfirm(true)
        }
    }

    const onLogout = () => {
        setShowLogoutConfirm(true)
    }

    const confirmLogout = async () => {
        await handleLogout()
        setShowLogoutConfirm(false)
    }

    const confirmDisable = async () => {
        await handleDisable()
        setShowDisableConfirm(false)
    }

    const handleDelete = () => {
        setShowDeleteConfirm(true)
    }

    const confirmDelete = () => {
        onDelete?.(id)
        setShowDeleteConfirm(false)
    }

    return (
        <>
            <div className="mcp-card" ref={cardRef}>
                <McpServerCardHeader
                    name={name}
                    icon={icon}
                    description={description}
                    paid={paid}
                    isEnabled={isEnabled}
                    isLoading={isLoading}
                    isAuthenticated={isAuthenticated}
                    requiresAuth={requiresAuth}
                    isNarrowView={isNarrowView}
                    isCustom={isCustom}
                    onToggle={onToggle}
                    onDelete={handleDelete}
                />

                <McpServerCardFooter
                    serverId={id}
                    serverName={name}
                    status={status}
                    isEnabled={isEnabled}
                    isLoading={isLoading}
                    isAuthenticated={isAuthenticated}
                    requiresAuth={requiresAuth}
                    isNarrowView={isNarrowView}
                    healthCheckStatus={healthCheckStatus}
                    badgeState={getBadgeState()}
                    onManageTools={onManageTools}
                    onHealthCheck={handleHealthCheck}
                    onAuthenticate={handleAuthenticate}
                    onLogout={onLogout}
                />
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

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete Custom Server"
                message={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </>
    )
}
