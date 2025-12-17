import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle, AlertCircle } from 'lucide-react';
import type { ModelDownloadProgress } from '@/utils/ai';
import { createLogger } from '~logger';

const log = createLogger('ModelDownloadToast', 'NOTIFICATIONS');

interface ModelDownloadToastProps {
    model: 'language' | 'summarizer';
    progress: number;
    isComplete?: boolean;
    isError?: boolean;
    errorMessage?: string;
}

export const ModelDownloadToast: React.FC<ModelDownloadToastProps> = ({
    model,
    progress,
    isComplete = false,
    isError = false,
    errorMessage,
}) => {
    const [show, setShow] = useState(true);

    // Auto-hide after completion or error
    useEffect(() => {
        if (isComplete || isError) {
            const timer = setTimeout(() => {
                setShow(false);
            }, isError ? 5000 : 3000); // Show errors longer
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [isComplete, isError]);

    const modelName = model === 'language' ? 'Gemini Nano' : 'Summarizer';

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="min-w-[300px] max-w-[400px] pointer-events-auto rounded-xl py-3 px-4"
                    style={{
                        background: 'rgba(251, 191, 36, 0.15)',
                        border: '1px solid rgba(251, 191, 36, 0.4)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="shrink-0 flex items-center justify-center"
                            style={{ color: '#fbbf24' }}
                        >
                            {isError ? (
                                <AlertCircle
                                    size={20}
                                    style={{ animation: 'shake 0.5s ease-out' }}
                                />
                            ) : isComplete ? (
                                <CheckCircle
                                    size={20}
                                    style={{ animation: 'scale-in 0.3s ease-out' }}
                                />
                            ) : (
                                <Download
                                    size={20}
                                    style={{ animation: 'download-bounce 1.5s ease-in-out infinite' }}
                                />
                            )}
                        </div>
                        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                            <div
                                className="font-semibold text-sm"
                                style={{
                                    color: '#fbbf24',
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                {isError
                                    ? `${modelName} Download Failed`
                                    : isComplete
                                        ? `${modelName} Ready`
                                        : `Downloading ${modelName}`}
                            </div>
                            {isError && errorMessage && (
                                <div
                                    className="text-[11px] leading-relaxed mt-0.5"
                                    style={{ color: 'rgba(251, 191, 36, 0.95)' }}
                                >
                                    {errorMessage}
                                </div>
                            )}
                            {!isComplete && !isError && (
                                <>
                                    <div
                                        className="w-full h-1.5 rounded-sm overflow-hidden relative"
                                        style={{ background: 'rgba(251, 191, 36, 0.2)' }}
                                    >
                                        <div
                                            className="h-full rounded-sm relative overflow-hidden transition-[width] duration-300 ease-out"
                                            style={{
                                                width: `${progress}%`,
                                                background: 'linear-gradient(90deg, rgba(251, 191, 36, 0.8), rgba(251, 191, 36, 1))',
                                            }}
                                        >
                                            <div
                                                className="absolute inset-0"
                                                style={{
                                                    background: 'linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.3), transparent)',
                                                    animation: 'shimmer 1.5s infinite',
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div
                                        className="text-xs font-medium"
                                        style={{
                                            color: 'rgba(251, 191, 36, 0.9)',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        {progress}%
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

interface ModelDownloadToastContainerProps {
    // No props needed - listens to broadcasts directly
}

/**
 * Container to manage and display model download toasts
 * Listens to download progress broadcasts from background
 */
export const ModelDownloadToastContainer: React.FC<ModelDownloadToastContainerProps> = () => {
    const [downloads, setDownloads] = useState<{
        language?: { progress: number; isComplete: boolean; isError: boolean; errorMessage?: string };
        summarizer?: { progress: number; isComplete: boolean; isError: boolean; errorMessage?: string };
    }>({});

    useEffect(() => {
        log.debug('Setting up broadcast listener');

        // Listen for download progress updates relayed from background
        const listener = (
            message: any,
            _sender: chrome.runtime.MessageSender,
            _sendResponse: (response?: any) => void
        ): boolean | undefined => {
            if (message.type === 'MODEL_DOWNLOAD_PROGRESS_UPDATE') {
                const progress: ModelDownloadProgress = message.data;
                log.debug('Received update from background:', progress);

                setDownloads((prev) => ({
                    ...prev,
                    [progress.model]: {
                        progress: progress.progress,
                        isComplete: progress.status === 'complete',
                        isError: progress.status === 'error',
                        errorMessage: progress.status === 'error' ? progress.message : undefined,
                    },
                }));
            }
            return undefined;
        };

        chrome.runtime.onMessage.addListener(listener);

        // Cleanup listener on unmount
        return () => {
            chrome.runtime.onMessage.removeListener(listener);
        };
    }, []);

    return (
        <div
            className="fixed top-5 right-4 z-[10000] flex flex-col gap-2 pointer-events-none max-sm:right-2 max-sm:top-2 max-sm:left-2 "
        >
            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                @keyframes download-bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
                @keyframes scale-in {
                    0% { transform: scale(0); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
            {downloads.language && (
                <ModelDownloadToast
                    model="language"
                    progress={downloads.language.progress}
                    isComplete={downloads.language.isComplete}
                    isError={downloads.language.isError}
                    errorMessage={downloads.language.errorMessage}
                />
            )}
            {downloads.summarizer && (
                <ModelDownloadToast
                    model="summarizer"
                    progress={downloads.summarizer.progress}
                    isComplete={downloads.summarizer.isComplete}
                    isError={downloads.summarizer.isError}
                    errorMessage={downloads.summarizer.errorMessage}
                />
            )}
        </div>
    );
};
