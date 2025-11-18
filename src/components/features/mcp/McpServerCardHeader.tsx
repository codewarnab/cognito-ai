import React, { useState, useEffect, useRef } from "react"
import { Info } from "lucide-react"
import { Toggle } from "../../ui/primitives/toggle"

interface McpServerCardHeaderProps {
    name: string
    icon: React.ReactNode
    description: string
    paid?: boolean
    isEnabled: boolean
    isLoading: boolean
    isAuthenticated: boolean
    requiresAuth?: boolean
    isNarrowView: boolean
    onToggle: (checked: boolean) => Promise<string | void>
}

export const McpServerCardHeader: React.FC<McpServerCardHeaderProps> = ({
    name,
    icon,
    description,
    paid = false,
    isEnabled,
    isLoading,
    isAuthenticated,
    requiresAuth = true,
    isNarrowView,
    onToggle
}) => {
    const [showTooltip, setShowTooltip] = useState(false)
    const tooltipRef = useRef<HTMLDivElement>(null)

    // Handle clicking outside tooltip to close it
    useEffect(() => {
        if (!showTooltip) return

        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is outside the tooltip container
            if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                setShowTooltip(false)
            }
        }

        // Add listener on next tick to avoid immediate closure
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside)
        }, 0)

        return () => {
            clearTimeout(timeoutId)
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showTooltip])

    return (
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
                    <div className="mcp-card__info-container" ref={tooltipRef}>
                        <button
                            className="mcp-card__info-btn"
                            onClick={(e) => {
                                e.stopPropagation()
                                setShowTooltip(!showTooltip)
                            }}
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
                    onChange={onToggle}
                    label="Enable"
                    disabled={isLoading || (requiresAuth && !isAuthenticated)}
                />
            </div>
        </div>
    )
}
