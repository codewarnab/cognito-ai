import React, { createContext, useContext, useState, useEffect } from 'react';
import { createLogger } from '../logger';

const log = createLogger('DocumentContext');

interface DocumentContextValue {
    currentPdf: { url: string; base64Data: string } | null;
    isProcessing: boolean;
    error: string | null;
    clearPdf: () => void;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

export function DocumentProvider({ children }: { children: React.ReactNode }) {
    const [currentPdf, setCurrentPdf] = useState<{ url: string; base64Data: string } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load PDF context from storage on mount
    useEffect(() => {
        const loadStoredPdfContext = async () => {
            try {
                const result = await chrome.storage.local.get('current_pdf_context');
                if (result.current_pdf_context) {
                    setCurrentPdf(result.current_pdf_context);
                    log.info('Loaded PDF context from storage');
                }
            } catch (err) {
                log.error('Failed to load stored PDF context', err);
            }
        };

        loadStoredPdfContext();
    }, []);

    // Listen for PDF messages from background
    useEffect(() => {
        const handleMessage = async (message: any) => {
            if (message.type === 'PDF_PROCESSED') {
                setCurrentPdf(message.data);
                setIsProcessing(false);
                setError(null);
                log.info('PDF processed successfully');
            } else if (message.type === 'PDF_PROCESSING') {
                setIsProcessing(true);
                setError(null);
                log.info('PDF processing started');
            } else if (message.type === 'PDF_ERROR') {
                setError(message.error || 'Failed to process PDF');
                setIsProcessing(false);
                log.error('PDF processing error', message.error);
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, []);

    const clearPdf = () => {
        setCurrentPdf(null);
        setError(null);
        setIsProcessing(false);
        chrome.storage.local.remove('current_pdf_context');
        log.info('PDF context cleared');
    };

    return (
        <DocumentContext.Provider
            value={{
                currentPdf,
                isProcessing,
                error,
                clearPdf
            }}
        >
            {children}
        </DocumentContext.Provider>
    );
}

export function useDocument() {
    const context = useContext(DocumentContext);
    if (!context) {
        throw new Error('useDocument must be used within DocumentProvider');
    }
    return context;
}
