import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, XCircle } from 'lucide-react';

export interface ErrorToastProps {
    message: string;
    technicalDetails?: string;
    isVisible: boolean;
    onDismiss: () => void;
    duration?: number; // Auto-dismiss after this many ms (0 = no auto-dismiss)
}

/**
 * Error Toast Component
 * Displays error messages in a dismissible toast notification
 */
export const ErrorToast: React.FC<ErrorToastProps> = ({
    message,
    technicalDetails,
    isVisible,
    onDismiss,
    duration = 8000, // Default 8 seconds
}) => {
    // Auto-dismiss after duration
    useEffect(() => {
        if (isVisible && duration > 0) {
            const timer = setTimeout(() => {
                onDismiss();
            }, duration);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [isVisible, duration, onDismiss]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="fixed top-5 right-1 z-[10000] max-w-[380px] bg-amber-400/15 border border-amber-400/40 rounded-xl shadow-[0_8px_24px_rgba(218,165,32,0.3),0_0_40px_rgba(255,215,0,0.15)] backdrop-blur-[12px] overflow-hidden"
                >
                    <div className="flex items-start gap-3 px-4 py-3.5">
                        <div className="shrink-0 text-amber-400 flex items-center justify-center w-7 h-7 bg-amber-400/20 rounded-lg">
                            <AlertCircle size={20} className="text-amber-400 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-amber-400 leading-snug mb-1">
                                {message}
                            </div>
                            {technicalDetails && (
                                <details className="mt-2 text-xs group">
                                    <summary className="cursor-pointer text-amber-400/90 font-medium select-none list-none flex items-center gap-1 hover:text-amber-400">
                                        <span className="text-[10px] transition-transform duration-200 group-open:rotate-90">▶</span>
                                        Technical Details
                                    </summary>
                                    <div className="mt-1.5 p-2 bg-amber-400/10 rounded-md text-amber-400/95 font-mono text-[11px] leading-snug overflow-x-auto break-words">
                                        {technicalDetails}
                                    </div>
                                </details>
                            )}
                        </div>
                        <button
                            className="shrink-0 bg-amber-400/20 border-none text-amber-400 cursor-pointer p-1 w-7 h-7 flex items-center justify-center rounded-md transition-all duration-200 hover:bg-amber-400/30 hover:-translate-y-px active:scale-95 active:translate-y-0"
                            onClick={onDismiss}
                            aria-label="Dismiss error"
                        >
                            <XCircle size={18} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

