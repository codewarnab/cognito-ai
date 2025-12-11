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
                    className="error-toast"
                >
                    <div className="error-toast-content">
                        <div className="error-toast-icon">
                            <AlertCircle size={20} className="icon-error" />
                        </div>
                        <div className="error-toast-info">
                            <div className="error-toast-message">
                                {message}
                            </div>
                            {technicalDetails && (
                                <details className="error-toast-details">
                                    <summary>Technical Details</summary>
                                    <div className="error-toast-details-content">
                                        {technicalDetails}
                                    </div>
                                </details>
                            )}
                        </div>
                        <button
                            className="error-toast-close"
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
