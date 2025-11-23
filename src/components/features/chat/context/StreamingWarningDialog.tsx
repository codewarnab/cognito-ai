import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StreamingWarningDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onContinue: () => void;
}

export const StreamingWarningDialog: React.FC<StreamingWarningDialogProps> = ({
    isOpen,
    onClose,
    onContinue,
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="streaming-warning-overlay"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="streaming-warning-dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="streaming-warning-content">
                            <h3 className="streaming-warning-title">Message Being Streamed</h3>
                            <p className="streaming-warning-message">
                                Starting a new thread while a message is being streamed will interrupt the current response.
                            </p>
                        </div>

                        <div className="streaming-warning-actions">
                            <button
                                className="streaming-warning-button streaming-warning-button-secondary"
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                            <button
                                className="streaming-warning-button streaming-warning-button-primary"
                                onClick={onContinue}
                            >
                                Continue Anyway
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
