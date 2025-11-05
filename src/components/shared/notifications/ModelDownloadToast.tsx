import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle, AlertCircle } from 'lucide-react';
import type { ModelDownloadProgress } from '../../../utils/modelDownloadBroadcast';

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
                    transition={{ duration: 0.2 }}
                    className={`model-download-toast ${isComplete ? 'complete' : ''} ${isError ? 'error' : ''}`}
                >
                    <div className="model-download-toast-content">
                        <div className="model-download-toast-icon">
                            {isError ? (
                                <AlertCircle size={20} className="icon-error" />
                            ) : isComplete ? (
                                <CheckCircle size={20} className="icon-success" />
                            ) : (
                                <Download size={20} className="icon-downloading" />
                            )}
                        </div>
                        <div className="model-download-toast-info">
                            <div className="model-download-toast-title">
                                {isError
                                    ? `${modelName} Download Failed`
                                    : isComplete
                                        ? `${modelName} Ready`
                                        : `Downloading ${modelName}`}
                            </div>
                            {isError && errorMessage && (
                                <div className="model-download-toast-error-message">
                                    {errorMessage}
                                </div>
                            )}
                            {!isComplete && !isError && (
                                <>
                                    <div className="model-download-toast-progress-bar">
                                        <div
                                            className="model-download-toast-progress-fill"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="model-download-toast-percentage">
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
        console.log('[ModelDownloadToast] Setting up broadcast listener');

        // Listen for download progress updates relayed from background
        const listener = (
            message: any,
            _sender: chrome.runtime.MessageSender,
            _sendResponse: (response?: any) => void
        ): boolean | undefined => {
            if (message.type === 'MODEL_DOWNLOAD_PROGRESS_UPDATE') {
                const progress: ModelDownloadProgress = message.data;
                console.log('[ModelDownloadToast] Received update from background:', progress);

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
        <div className="model-download-toast-container">
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
