import React, { useRef } from "react"
import { Info } from "lucide-react"
import { Toggle } from "../../ui/primitives/toggle"
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/primitives/tooltip"
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
    const deleteIconRef = useRef<DeleteIconHandle>(null)

    return (
        <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg text-white/80 [&>svg]:w-6 [&>svg]:h-6 [&>img]:w-6 [&>img]:h-6" aria-hidden="true">
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
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                className="flex items-center justify-center w-5 h-5 p-0 bg-transparent border-none rounded-full text-[var(--text-tertiary,rgba(255,255,255,0.4))] cursor-pointer transition-colors duration-200 hover:text-[var(--text-primary,#ffffff)]"
                                aria-label={`Show information about ${name}`}
                            >
                                <Info size={16} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-64">{description}</TooltipContent>
                    </Tooltip>
                )}
            </div>
            <div className="flex items-center gap-3 ml-4 shrink-0">
                {isCustom && onDelete && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                className="flex items-center justify-center w-8 h-8 p-0 bg-transparent border-none rounded-md text-[#ef4444] cursor-pointer opacity-70 transition-all duration-200 hover:bg-[rgba(239,68,68,0.1)] hover:opacity-100"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onDelete()
                                }}
                                onMouseEnter={() => deleteIconRef.current?.startAnimation()}
                                onMouseLeave={() => deleteIconRef.current?.stopAnimation()}
                                aria-label={`Delete ${name}`}
                            >
                                <DeleteIcon ref={deleteIconRef} size={18} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Delete {name}</TooltipContent>
                    </Tooltip>
                )}
                {requiresAuth && !isAuthenticated ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <Toggle
                                    checked={isEnabled}
                                    onChange={onToggle}
                                    label="Enable"
                                    disabled={isLoading || (requiresAuth && !isAuthenticated)}
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">Authenticate first to enable</TooltipContent>
                    </Tooltip>
                ) : (
                    <Toggle
                        checked={isEnabled}
                        onChange={onToggle}
                        label="Enable"
                        disabled={isLoading}
                    />
                )}
            </div>
        </div>
    )
}
