import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle } from 'lucide-react';
import { listenToDownloadProgress, type ModelDownloadProgress } from '../utils/modelDownloadBroadcast';

interface ModelDownloadToastProps {
    model: 'language' | 'summarizer';
    progress: number;
    isComplete?: boolean;
}

export const ModelDownloadToast: React.FC<ModelDownloadToastProps> = ({
    model,
    progress,
    isComplete = false,
}) => {
    const [show, setShow] = useState(true);

    // Auto-hide after completion
    useEffect(() => {
        if (isComplete) {
            const timer = setTimeout(() => {
                setShow(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isComplete]);

    const modelName = model === 'language' ? 'Gemini Nano' : 'Summarizer';

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`model-download-toast ${isComplete ? 'complete' : ''}`}
                >
                    <div className="model-download-toast-content">
                        <div className="model-download-toast-icon">
                            {isComplete ? (
                                <CheckCircle size={20} className="icon-success" />
                            ) : (
                                <Download size={20} className="icon-downloading" />
                            )}
                        </div>
                        <div className="model-download-toast-info">
                            <div className="model-download-toast-title">
                                {isComplete ? `${modelName} Ready` : `Downloading ${modelName}`}
                            </div>
                            {!isComplete && (
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
        language?: { progress: number; isComplete: boolean };
        summarizer?: { progress: number; isComplete: boolean };
    }>({});

    useEffect(() => {
        console.log('[ModelDownloadToast] Setting up broadcast listener');

        // Listen for download progress updates relayed from background
        const listener = (
            message: any,
            sender: chrome.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            if (message.type === 'MODEL_DOWNLOAD_PROGRESS_UPDATE') {
                const progress: ModelDownloadProgress = message.data;
                console.log('[ModelDownloadToast] Received update from background:', progress);

                setDownloads((prev) => ({
                    ...prev,
                    [progress.model]: {
                        progress: progress.progress,
                        isComplete: progress.status === 'complete' || progress.progress >= 100,
                    },
                }));
            }
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
                />
            )}
            {downloads.summarizer && (
                <ModelDownloadToast
                    model="summarizer"
                    progress={downloads.summarizer.progress}
                    isComplete={downloads.summarizer.isComplete}
                />
            )}
        </div>
    );
};
