import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface StreamingWarningDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onContinue: () => void;
}

export const StreamingWarningDialog = ({
    isOpen,
    onClose,
    onContinue,
}: StreamingWarningDialogProps) => {
    return (
        <>
            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                            onClick={onClose}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                transition={{ duration: 0.2 }}
                                className="bg-[#0a0e1a] border border-white/10 rounded-xl p-6 max-w-md mx-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="mb-4">
                                    <h3 className="text-lg font-semibold text-white mb-2">Message Being Streamed</h3>
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                        Starting a new thread while a message is being streamed will interrupt the current response.
                                    </p>
                                </div>

                                <div className="flex gap-3 justify-end">
                                    <button
                                        className="px-4 py-2 text-sm font-medium text-gray-300 bg-transparent border border-white/10 rounded-lg hover:bg-white/5 hover:text-white transition-all duration-200"
                                        onClick={onClose}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="px-4 py-2 text-sm font-medium text-white bg-red-500 border border-red-500 rounded-lg hover:bg-red-600 transition-all duration-200"
                                        onClick={onContinue}
                                    >
                                        Continue Anyway
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};

