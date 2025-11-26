import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Info, X } from 'lucide-react';

interface ErrorNotificationProps {
    message: string;
    type?: 'error' | 'warning' | 'info';
    onDismiss: () => void;
}

export const ErrorNotification: React.FC<ErrorNotificationProps> = ({
    message,
    type = 'error',
    onDismiss,
}) => {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`error-notification error-notification-${type}`}
            >
                <div className="error-notification-content">
                    <div className="error-notification-icon">
                        {type === 'error' ? (
                            <AlertCircle size={16} />
                        ) : (
                            <Info size={16} />
                        )}
                    </div>
                    <div className="error-notification-message">{message}</div>
                    <button
                        className="error-notification-dismiss"
                        onClick={onDismiss}
                        aria-label="Dismiss notification"
                    >
                        <X size={16} />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
