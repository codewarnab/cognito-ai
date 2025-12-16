import React, { useState, useEffect, useRef } from "react"
import { Info } from "lucide-react"
import { Toggle } from "../../ui/primitives/toggle"
import { DeleteIcon, type DeleteIconHandle } from "@assets/icons/ui/trash"

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
    isCustom?: boolean
    onToggle: (checked: boolean) => Promise<string | void>
    onDelete?: () => void
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
    isCustom = false,
    onToggle,
    onDelete
}) => {
    const [showTooltip, setShowTooltip] = useState(false)
    const tooltipRef = useRef<HTMLDivElement>(null)
    const deleteIconRef = useRef<DeleteIconHandle>(null)

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
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color,rgba(255,255,255,0.08))] bg-[var(--bg-tertiary,#141f30)]">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--bg-primary,#0a0e1a)] text-[var(--text-secondary,rgba(255,255,255,0.6))]" aria-hidden="true">
                    {icon}
                </div>
                <div className="flex flex-col min-w-0">
                    <h3 className="m-0 text-base font-semibold text-[var(--text-primary,#ffffff)] truncate">{name}</h3>
                    {paid && (
                        <span className="inline-flex items-center self-start px-1.5 py-0.5 mt-0.5 text-[10px] font-bold tracking-wider text-[#fbbf24] bg-[rgba(251,191,36,0.1)] rounded uppercase">
                            PAID
                        </span>
                    )}
                </div>
                {!isNarrowView && (
                    <div className="relative flex items-center ml-1" ref={tooltipRef}>
                        <button
                            className="flex items-center justify-center w-5 h-5 p-0 bg-transparent border-none rounded-full text-[var(--text-tertiary,rgba(255,255,255,0.4))] cursor-pointer transition-colors duration-200 hover:text-[var(--text-primary,#ffffff)]"
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
                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 z-[100] origin-left animate-in fade-in zoom-in-95 duration-200">
                                <div className="relative p-3 text-xs leading-relaxed text-[var(--text-secondary,rgba(255,255,255,0.8))] bg-[#262626] rounded-lg shadow-xl border border-[var(--border-color,rgba(255,255,255,0.08))]">
                                    {description}
                                    <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-[1px] w-2 h-2 bg-[#262626] rotate-45 border-l border-b border-[var(--border-color,rgba(255,255,255,0.08))]"></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-3 ml-4 shrink-0">
                {isCustom && onDelete && (
                    <button
                        className="flex items-center justify-center w-8 h-8 p-0 bg-transparent border-none rounded-md text-[#ef4444] cursor-pointer opacity-70 transition-all duration-200 hover:bg-[rgba(239,68,68,0.1)] hover:opacity-100"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete()
                        }}
                        onMouseEnter={() => deleteIconRef.current?.startAnimation()}
                        onMouseLeave={() => deleteIconRef.current?.stopAnimation()}
                        aria-label={`Delete ${name}`}
                        title={`Delete ${name}`}
                    >
                        <DeleteIcon ref={deleteIconRef} size={18} />
                    </button>
                )}
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
