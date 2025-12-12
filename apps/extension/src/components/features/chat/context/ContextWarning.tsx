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
                    className={`fixed top-4 sm:top-3 left-1/2 -translate-x-1/2 z-[9999] max-w-[500px] sm:max-w-[90%] w-[calc(100%-32px)] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.15)] backdrop-blur-[10px] overflow-hidden bg-amber-400/15 border border-amber-400/40 ${severity === 'critical' ? 'animate-pulse' : ''}`}
                >
                    <div className="flex items-start gap-3 sm:gap-2.5 p-4 sm:p-3 text-amber-400">
                        <div className="shrink-0 flex items-center justify-center w-8 sm:w-7 h-8 sm:h-7 bg-amber-400/20 rounded-lg text-amber-400">
                            {warningContent.icon}
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                            <div className="text-sm sm:text-[13px] font-semibold leading-snug">
                                {warningContent.title} ({percent}%)
                            </div>
                            <div className="text-xs sm:text-[11px] leading-relaxed opacity-95">
                                {warningContent.message}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {onNewThread && (
                                <button
                                    className="px-3 sm:px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-medium bg-amber-400/25 border border-amber-400/30 rounded-md text-amber-400 cursor-pointer transition-all duration-200 whitespace-nowrap hover:bg-amber-400/35 hover:border-amber-400/40 hover:-translate-y-px active:translate-y-0"
                                    onClick={() => {
                                        onNewThread();
                                        onDismiss();
                                    }}
                                >
                                    New Thread
                                </button>
                            )}
                            <button
                                className="flex items-center justify-center w-7 h-7 bg-amber-400/20 border-none rounded-md text-amber-400 cursor-pointer transition-all duration-200 hover:bg-amber-400/30 hover:-translate-y-px active:translate-y-0"
                                onClick={onDismiss}
                                aria-label="Dismiss warning"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

