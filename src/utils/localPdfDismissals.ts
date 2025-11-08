/**
 * LocalPDF Dismissals Management
 * 
 * Tracks which PDF files the user has dismissed from the suggestion badge
 * to avoid showing the same suggestion repeatedly in a session.
 * 
 * Phase 2: Dismissible State
 */

import { createLogger } from '../logger';

const storageLog = createLogger('PDFDismissals', 'STORAGE');

const STORAGE_KEY = 'dismissed-pdf-suggestions';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DismissedPdf {
    filePath: string;
    dismissedAt: number;
}

/**
 * Get all dismissed PDF suggestions from localStorage
 */
function getDismissedPdfs(): DismissedPdf[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        const parsed: DismissedPdf[] = JSON.parse(stored);

        // Filter out old dismissals (older than SESSION_DURATION)
        const now = Date.now();
        const valid = parsed.filter(
            (item) => now - item.dismissedAt < SESSION_DURATION_MS
        );

        // Update storage if we filtered anything out
        if (valid.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
        }

        return valid;
    } catch (error) {
        storageLog.error('Error reading dismissed PDF suggestions', error);
        return [];
    }
}

/**
 * Check if a PDF file path has been dismissed
 */
export function isPdfDismissed(filePath: string): boolean {
    const dismissed = getDismissedPdfs();
    return dismissed.some((item) => item.filePath === filePath);
}

/**
 * Mark a PDF file path as dismissed
 */
export function dismissPdf(filePath: string): void {
    try {
        const dismissed = getDismissedPdfs();

        // Don't add duplicate
        if (dismissed.some((item) => item.filePath === filePath)) {
            return;
        }

        dismissed.push({
            filePath,
            dismissedAt: Date.now(),
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
    } catch (error) {
        storageLog.error('Error dismissing PDF suggestion', error);
    }
}

/**
 * Clear all dismissed PDF suggestions (useful for testing or user preference)
 */
export function clearAllDismissals(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        storageLog.error('Error clearing PDF dismissals', error);
    }
}

/**
 * Remove a specific PDF from dismissals (un-dismiss)
 */
export function undismissPdf(filePath: string): void {
    try {
        const dismissed = getDismissedPdfs();
        const filtered = dismissed.filter((item) => item.filePath !== filePath);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
        storageLog.error('Error un-dismissing PDF', error);
    }
}
