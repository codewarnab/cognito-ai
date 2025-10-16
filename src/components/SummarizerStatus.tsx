import { useState, useEffect } from 'react';
import { checkSummarizerAvailability } from '../utils/summarizer';
import type { SummarizerAvailability } from '../utils/summarizer';

export function SummarizerStatus() {
    const [availability, setAvailability] = useState<SummarizerAvailability>('no');
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            setIsChecking(true);
            const status = await checkSummarizerAvailability();
            setAvailability(status);
            setIsChecking(false);
        };

        checkStatus();
    }, []);

    if (isChecking) {
        return null;
    }

    if (availability === 'no') {
        return null;
    }

    return (
        <div className="summarizer-status">
            {availability === 'readily' && (
                <div className="status-badge status-ready">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1" />
                        <path d="M4 6l1.5 1.5L8.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>AI Summarizer Ready</span>
                </div>
            )}
            {availability === 'after-download' && (
                <div className="status-badge status-downloading">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin">
                        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1" opacity="0.25" />
                        <path d="M11 6A5 5 0 016 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                    <span>AI Model Available</span>
                </div>
            )}
        </div>
    );
}
