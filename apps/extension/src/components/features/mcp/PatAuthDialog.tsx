import React, { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/primitives/dialog"
import { ExternalLink, Key, Loader2 } from "lucide-react"
import type { PatConfig } from "@/constants/mcpServers"
import { cn } from "@/utils/ui"

interface PatAuthDialogProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (token: string, fields?: Record<string, string>) => Promise<void>
    patConfig: PatConfig
    serverName: string
    isLoading?: boolean
    error?: string
}

/**
 * Dialog for entering a Personal Access Token to authenticate with an MCP server.
 * Supports both single-token and multi-field configurations.
 */
export const PatAuthDialog: React.FC<PatAuthDialogProps> = ({
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

    const hasMultiField = patConfig.fields && patConfig.fields.length > 0

    // Reset state when dialog opens/closes
    React.useEffect(() => {
        if (!isOpen) {
            setToken('')
            setFieldValues({})
            setLocalError(undefined)
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
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-blue-400" />
                        Connect to {serverName}
                    </DialogTitle>
                    <DialogDescription>
                        {hasMultiField
                            ? 'Enter your credentials to authenticate.'
                            : 'Enter your personal access token to authenticate.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    {hasMultiField ? (
                        // Multi-field rendering
                        patConfig.fields!.map((field) => (
                            <div key={field.id} className="space-y-2">
                                <label className="text-sm text-[var(--text-secondary)] block">
                                    {field.label}
                                    {field.required && <span className="text-red-400 ml-1">*</span>}
                                </label>
                                <input
                                    type={field.secret ? 'password' : 'text'}
                                    placeholder={field.placeholder}
                                    value={fieldValues[field.id] || ''}
                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                    disabled={isLoading}
                                    autoComplete="off"
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        ))
                    ) : (
                        // Single token rendering
                        <div className="space-y-2">
                            <label className="text-sm text-[var(--text-secondary)] block">
                                {patConfig.label}
                            </label>
                            <input
                                type="password"
                                placeholder={patConfig.placeholder}
                                value={token}
                                onChange={(e) => {
                                    setToken(e.target.value)
                                    setLocalError(undefined)
                                }}
                                disabled={isLoading}
                                autoComplete="off"
                                autoFocus
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                    )}

                    {patConfig.helpUrl && (
                        <a
                            href={patConfig.helpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            How to get credentials
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}

                    {localError && (
                        <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                            {localError}
                        </p>
                    )}

                    <DialogFooter>
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isLoading}
                            className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-150 border-none bg-white/[0.08] text-white/[0.85] hover:bg-white/[0.12] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitDisabled || isLoading}
                            className={cn(
                                "inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-150 border-none",
                                "bg-blue-500 text-white hover:bg-blue-600",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Validating...
                                </>
                            ) : (
                                'Connect'
                            )}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
