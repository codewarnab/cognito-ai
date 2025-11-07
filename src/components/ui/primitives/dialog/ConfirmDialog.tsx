import React, { useEffect, useRef } from "react"

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
            className="confirm-dialog-overlay"
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-message"
        >
            <div
                ref={dialogRef}
                className={`confirm-dialog confirm-dialog--${variant}`}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 id="dialog-title" className="confirm-dialog__title">
                    {title}
                </h3>
                <p id="dialog-message" className="confirm-dialog__message">
                    {message}
                </p>
                <div className="confirm-dialog__actions">
                    <button
                        ref={firstFocusableRef}
                        className="btn btn--secondary"
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        className={`btn btn--${variant === "danger" ? "danger" : "primary"}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
