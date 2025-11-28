import { useCallback } from 'react';
import { createLogger } from '~logger';

const log = createLogger('useScreenshotCapture', 'AI_CHAT');

interface ScreenshotCaptureResult {
    handleScreenshotClick: () => Promise<void>;
}

/**
 * Hook to handle screenshot capture functionality.
 * Captures the visible tab and processes it as a file attachment.
 */
export const useScreenshotCapture = (
    processFiles: (files: File[]) => Promise<void>
): ScreenshotCaptureResult => {
    const handleScreenshotClick = useCallback(async () => {
        try {
            log.info('Taking screenshot...');

            // Get active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];

            if (!tab || !tab.id || !tab.windowId) {
                log.error('No active tab found');
                return;
            }

            // Capture screenshot
            const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

            // Convert data URL to File
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });

            // Process the file using the existing file attachment logic
            await processFiles([file]);

            log.info('Screenshot captured and attached');
        } catch (error) {
            log.error('Failed to capture screenshot:', error);
        }
    }, [processFiles]);

    return { handleScreenshotClick };
};

