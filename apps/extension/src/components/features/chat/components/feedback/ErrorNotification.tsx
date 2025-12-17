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
                className="fixed top-[70px] right-2 z-[9999] max-w-[90%] w-auto min-w-[300px] backdrop-blur-[10px] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.1)] bg-[rgba(251,191,36,0.15)] border border-[rgba(251,191,36,0.4)]"
            >
                <div className="flex items-center gap-3 py-3 px-4">
                    <div className="shrink-0 flex items-center justify-center text-[#fbbf24]">
                        {type === 'error' ? (
                            <AlertCircle size={16} />
                        ) : (
                            <Info size={16} />
                        )}
                    </div>
                    <div className="flex-1 text-sm leading-[1.5] text-[rgba(251,191,36,0.9)]">{message}</div>
                    <button
                        className="shrink-0 bg-transparent border-none text-[rgba(251,191,36,0.5)] cursor-pointer p-1 rounded flex items-center justify-center transition-all duration-200 hover:bg-[rgba(251,191,36,0.1)] hover:text-[rgba(251,191,36,0.9)]"
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
