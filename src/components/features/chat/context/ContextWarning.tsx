import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, X } from 'lucide-react';

interface ContextWarningProps {
    percent: number;
    onDismiss: () => void;
    onNewThread?: () => void;
}

export const ContextWarning: React.FC<ContextWarningProps> = ({
    percent,
    onDismiss,
    onNewThread,
}) => {
    const severity = percent >= 95 ? 'critical' : 'warning';

    const getWarningMessage = () => {
        if (percent >= 95) {
            return {
                title: 'Context Limit Critical',
                message: 'You have used over 95% of the context window. The AI may start losing context soon. Consider starting a new thread.',
                icon: <AlertTriangle size={20} />,
            };
        } else if (percent >= 85) {
            return {
                title: 'Context Limit Warning',
                message: 'You are approaching the context limit. The conversation may become less coherent as the context fills up.',
                icon: <Info size={20} />,
            };
        }
        return null;
    };

    const warningContent = getWarningMessage();

    return (
        <AnimatePresence>
            {warningContent && (
                <motion.div
                    key="context-warning"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`context-warning context-warning-${severity}`}
                >
                    <div className="context-warning-content">
                        <div className="context-warning-icon">
                            {warningContent.icon}
                        </div>
                        <div className="context-warning-text">
                            <div className="context-warning-title">
                                {warningContent.title} ({percent}%)
                            </div>
                            <div className="context-warning-message">
                                {warningContent.message}
                            </div>
                        </div>
                        <div className="context-warning-actions">
                            {onNewThread && (
                                <button
                                    className="context-warning-action-button"
                                    onClick={() => {
                                        onNewThread();
                                        onDismiss();
                                    }}
                                >
                                    New Thread
                                </button>
                            )}
                            <button
                                className="context-warning-dismiss"
                                onClick={onDismiss}
                                aria-label="Dismiss warning"
                            >
                                <X size={16} />
                            </button>
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
