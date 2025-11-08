import React, { createContext, useContext } from 'react';

interface DocumentContextValue {
    // Placeholder for future document-related features
    // File attachments are handled separately via file upload
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

export function DocumentProvider({ children }: { children: React.ReactNode }) {
    return (
        <DocumentContext.Provider value={{}}>
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
