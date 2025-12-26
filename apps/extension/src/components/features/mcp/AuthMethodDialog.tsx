import React from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/primitives/dialog"
import { Key, Globe } from "lucide-react"

interface AuthMethodDialogProps {
    isOpen: boolean
    onClose: () => void
    onSelectOAuth: () => void
    onSelectPat: () => void
    serverName: string
}

/**
 * Dialog for choosing between OAuth and PAT authentication methods
 */
export const AuthMethodDialog: React.FC<AuthMethodDialogProps> = ({
    isOpen,
    onClose,
    onSelectOAuth,
    onSelectPat,
    serverName
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Connect to {serverName}</DialogTitle>
                    <DialogDescription>
                        Choose how you want to authenticate
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 mt-4">
                    <button
                        onClick={onSelectOAuth}
                        className="w-full flex items-center gap-3 py-4 px-4 rounded-lg border border-[var(--border-color)] bg-transparent hover:bg-white/[0.05] transition-all cursor-pointer"
                    >
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Globe className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex flex-col items-start text-left">
                            <span className="font-medium text-[var(--text-primary)]">Sign in with {serverName}</span>
                            <span className="text-xs text-[var(--text-secondary)]">
                                Authenticate via browser
                            </span>
                        </div>
                    </button>

                    <button
                        onClick={onSelectPat}
                        className="w-full flex items-center gap-3 py-4 px-4 rounded-lg border border-[var(--border-color)] bg-transparent hover:bg-white/[0.05] transition-all cursor-pointer"
                    >
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <Key className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex flex-col items-start text-left">
                            <span className="font-medium text-[var(--text-primary)]">Use Personal Access Token</span>
                            <span className="text-xs text-[var(--text-secondary)]">
                                Enter your own API key
                            </span>
                        </div>
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
