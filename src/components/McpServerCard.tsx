import React, { useState } from "react"
import { StatusBadge } from "./ui/StatusBadge"
import { Toggle } from "./ui/Toggle"
import { ConfirmDialog } from "./ui/ConfirmDialog"

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
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [showDisableConfirm, setShowDisableConfirm] = useState(false)

    const handleToggle = (checked: boolean) => {
        if (checked) {
            setIsEnabled(true)
        } else {
            setShowDisableConfirm(true)
        }
    }

    const handleAuthenticate = () => {
        // Placeholder: toggle authentication state
        setIsAuthenticated(true)
    }

    const handleLogout = () => {
        setShowLogoutConfirm(true)
    }

    const confirmLogout = () => {
        setIsAuthenticated(false)
        setShowLogoutConfirm(false)
    }

    const confirmDisable = () => {
        setIsEnabled(false)
        setShowDisableConfirm(false)
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
                            disabled={false}
                        />
                    </div>
                </div>

                <div className="mcp-card__footer">
                    <StatusBadge
                        state={isAuthenticated ? "authenticated" : "not-authenticated"}
                    />
                    <div className="mcp-card__actions">
                        {isAuthenticated ? (
                            <button
                                className="btn btn--secondary btn--sm"
                                onClick={handleLogout}
                            >
                                Logout
                            </button>
                        ) : (
                            <button
                                className="btn btn--primary btn--sm"
                                onClick={handleAuthenticate}
                                disabled={!isEnabled}
                            >
                                Authenticate
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
