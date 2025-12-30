import React, { useState } from "react"
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerFooter
} from "@/components/ui/primitives/drawer"
import { ExternalLink, Key, Loader2, Sparkles } from "lucide-react"
import type { PatConfig } from "@/constants/mcpServers"
import { cn } from "@/utils/ui"

interface PatAuthDrawerProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (token: string, fields?: Record<string, string>) => Promise<void>
    patConfig: PatConfig
    serverName: string
    isLoading?: boolean
    error?: string
}

/**
 * Animated drawer for entering a Personal Access Token to authenticate with an MCP server.
 * Supports both single-token and multi-field configurations.
 */
export const PatAuthDrawer: React.FC<PatAuthDrawerProps> = ({
    isOpen,
    onClose,
    onSubmit,
    patConfig,
    serverName,
    isLoading = false,
    error
}) => {
    const [token, setToken] = useState('')
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
    const [localError, setLocalError] = useState<string | undefined>(error)
    const [isFocused, setIsFocused] = useState<string | null>(null)

    const hasMultiField = patConfig.fields && patConfig.fields.length > 0

    // Reset state when drawer opens/closes
    React.useEffect(() => {
        if (!isOpen) {
            setToken('')
            setFieldValues({})
            setLocalError(undefined)
            setIsFocused(null)
        }
    }, [isOpen])

    // Sync external error
    React.useEffect(() => {
        setLocalError(error)
    }, [error])

    const handleFieldChange = (fieldId: string, value: string) => {
        setFieldValues(prev => ({ ...prev, [fieldId]: value }))
        setLocalError(undefined)
    }

    const validateFields = (): boolean => {
        if (hasMultiField) {
            for (const field of patConfig.fields!) {
                if (field.required && !fieldValues[field.id]?.trim()) {
                    setLocalError(`${field.label} is required`)
                    return false
                }
            }
            return true
        } else {
            if (!token.trim()) {
                setLocalError('Token is required')
                return false
            }
            return true
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validateFields()) return

        setLocalError(undefined)

        if (hasMultiField) {
            // Trim all field values
            const trimmedFields: Record<string, string> = {}
            for (const [key, value] of Object.entries(fieldValues)) {
                trimmedFields[key] = value.trim()
            }
            await onSubmit('', trimmedFields)
        } else {
            await onSubmit(token.trim())
        }
    }

    const handleClose = () => {
        if (!isLoading) {
            onClose()
        }
    }

    const isSubmitDisabled = hasMultiField
        ? patConfig.fields!.some(f => f.required && !fieldValues[f.id]?.trim())
        : !token.trim()

    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DrawerContent className="max-w-lg mx-auto">
                <DrawerHeader>
                    <DrawerTitle>
                        <div className="relative">
                            {/* Animated glow behind icon */}
                            <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full animate-pulse" />
                            <Key className="w-6 h-6 text-blue-400 relative z-10" />
                        </div>
                        <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                            Connect to {serverName}
                        </span>
                    </DrawerTitle>
                    <DrawerDescription className="text-center">
                        {hasMultiField
                            ? 'Enter your credentials to authenticate.'
                            : 'Enter your personal access token to authenticate.'}
                    </DrawerDescription>
                </DrawerHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {hasMultiField ? (
                        // Multi-field rendering
                        patConfig.fields!.map((field, index) => (
                            <div
                                key={field.id}
                                className="space-y-2"
                                style={{
                                    animation: `slideUp 0.3s ease-out ${index * 0.1}s both`
                                }}
                            >
                                <label className="text-sm text-[var(--text-secondary)] block font-medium">
                                    {field.label}
                                    {field.required && <span className="text-red-400 ml-1">*</span>}
                                </label>
                                <div className="relative group">
                                    <input
                                        type={field.secret ? 'password' : 'text'}
                                        placeholder={field.placeholder}
                                        value={fieldValues[field.id] || ''}
                                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                        onFocus={() => setIsFocused(field.id)}
                                        onBlur={() => setIsFocused(null)}
                                        disabled={isLoading}
                                        autoComplete="off"
                                        className={cn(
                                            "w-full px-4 py-3 rounded-xl",
                                            "bg-[var(--bg-tertiary)]/50 backdrop-blur-sm",
                                            "border-2 transition-all duration-300",
                                            "text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]",
                                            "focus:outline-none",
                                            "disabled:opacity-50 disabled:cursor-not-allowed",
                                            isFocused === field.id
                                                ? "border-blue-500"
                                                : "border-[var(--border-color)]/50 hover:border-[var(--border-color)]"
                                        )}
                                    />
                                </div>
                            </div>
                        ))
                    ) : (
                        // Single token rendering
                        <div className="space-y-2" style={{ animation: 'slideUp 0.3s ease-out both' }}>
                            <label className="text-sm text-[var(--text-secondary)] block font-medium">
                                {patConfig.label}
                            </label>
                            <div className="relative group">
                                <input
                                    type="password"
                                    placeholder={patConfig.placeholder}
                                    value={token}
                                    onChange={(e) => {
                                        setToken(e.target.value)
                                        setLocalError(undefined)
                                    }}
                                    onFocus={() => setIsFocused('token')}
                                    onBlur={() => setIsFocused(null)}
                                    disabled={isLoading}
                                    autoComplete="off"
                                    autoFocus
                                    className={cn(
                                        "w-full px-4 py-3 rounded-xl",
                                        "bg-[var(--bg-tertiary)]/50 backdrop-blur-sm",
                                        "border-2 transition-all duration-300",
                                        "text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]",
                                        "focus:outline-none",
                                        "disabled:opacity-50 disabled:cursor-not-allowed",
                                        isFocused === 'token'
                                            ? "border-blue-500"
                                            : "border-[var(--border-color)]/50 hover:border-[var(--border-color)]"
                                    )}
                                />
                            </div>
                        </div>
                    )}

                    {patConfig.helpUrl && (
                        <a
                            href={patConfig.helpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                                "inline-flex items-center justify-center gap-2 w-full",
                                "text-sm text-blue-400 hover:text-blue-300",
                                "py-2 px-4 rounded-lg",
                                "bg-blue-500/10 hover:bg-blue-500/20",
                                "transition-all duration-200 cursor-pointer",
                                "hover:scale-[1.02] active:scale-[0.98]"
                            )}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            How to get credentials
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}

                    {localError && (
                        <div
                            className={cn(
                                "text-sm text-red-400",
                                "bg-red-500/10 border border-red-500/30",
                                "px-4 py-3 rounded-xl",
                                "animate-shake"
                            )}
                        >
                            {localError}
                        </div>
                    )}

                    <DrawerFooter>
                        <button
                            type="submit"
                            disabled={isSubmitDisabled || isLoading}
                            className={cn(
                                "relative w-full py-3 px-4 rounded-xl",
                                "text-sm font-semibold cursor-pointer",
                                "transition-all duration-300",
                                "overflow-hidden",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                "group",
                                // Gradient background
                                "bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600",
                                "bg-[length:200%_100%] hover:bg-[position:100%_0]",
                                // Text color
                                "text-white",
                                // Hover effect
                                "hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]",
                                "hover:scale-[1.02] active:scale-[0.98]"
                            )}
                        >
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />

                            <span className="relative flex items-center justify-center gap-2">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <Key className="w-4 h-4" />
                                        Connect
                                    </>
                                )}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isLoading}
                            className={cn(
                                "w-full py-3 px-4 rounded-xl",
                                "text-sm font-medium cursor-pointer",
                                "transition-all duration-200",
                                "bg-white/5 hover:bg-white/10",
                                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                                "border border-[var(--border-color)]/30 hover:border-[var(--border-color)]/50",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                "hover:scale-[1.02] active:scale-[0.98]"
                            )}
                        >
                            Cancel
                        </button>
                    </DrawerFooter>
                </form>

                {/* Keyframe animations */}
                <style>{`
                    @keyframes slideUp {
                        from {
                            opacity: 0;
                            transform: translateY(10px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    
                    @keyframes shake {
                        0%, 100% { transform: translateX(0); }
                        10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
                        20%, 40%, 60%, 80% { transform: translateX(2px); }
                    }
                    
                    .animate-shake {
                        animation: shake 0.5s ease-in-out;
                    }
                `}</style>
            </DrawerContent>
        </Drawer>
    )
}
