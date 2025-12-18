import React, { useEffect, useRef } from "react"
import { cn } from "@/utils/ui"

interface ConfirmDialogProps {
    isOpen: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    onConfirm: () => void
    onCancel: () => void
    variant?: "danger" | "warning" | "default"
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
    onCancel,
    variant = "default"
}) => {
    const dialogRef = useRef<HTMLDivElement>(null)
    const firstFocusableRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (isOpen) {
            // Trap focus in dialog
            firstFocusableRef.current?.focus()

            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    onCancel()
                }
            }

            document.addEventListener("keydown", handleEscape)
            return () => document.removeEventListener("keydown", handleEscape)
        }

        return undefined
    }, [isOpen, onCancel])

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center animate-in fade-in-0"
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-message"
        >
            <div
                ref={dialogRef}
                className={cn(
                    "w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 shadow-lg",
                    "animate-in zoom-in-95 fade-in-0 duration-200"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 id="dialog-title" className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    {title}
                </h3>
                <p id="dialog-message" className="text-sm text-[var(--text-secondary)] mb-6">
                    {message}
                </p>
                <div className="flex justify-end items-center gap-2">
                    <button
                        ref={firstFocusableRef}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-150 border-none bg-white/[0.08] text-white/[0.85] hover:bg-white/[0.12]"
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        className={cn(
                            "inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-150 border-none",
                            variant === "danger"
                                ? "bg-red-500 text-white hover:bg-red-600"
                                : "bg-white text-black hover:bg-white/90"
                        )}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
