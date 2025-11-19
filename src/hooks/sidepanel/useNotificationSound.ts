import { useState, useEffect } from 'react';
import { initializeNotificationSound } from '../../utils/soundNotification';
import { createLogger } from '~logger';

const log = createLogger('useNotificationSound');

/**
 * Hook to handle notification sound initialization on first user interaction
 */
export function useNotificationSound() {
    const [isSoundInitialized, setIsSoundInitialized] = useState(false);

    useEffect(() => {
        if (isSoundInitialized) return;

        const initSound = async () => {
            try {
                await initializeNotificationSound();
                setIsSoundInitialized(true);
                log.info('Notification sound initialized');
            } catch (error) {
                log.warn('Failed to initialize notification sound:', error);
            }
        };

        // Initialize on any user interaction (click, keypress, focus)
        const handleUserInteraction = () => {
            initSound();
            // Remove listeners after first interaction
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keypress', handleUserInteraction);
            window.removeEventListener('focus', handleUserInteraction);
        };

        document.addEventListener('click', handleUserInteraction);
        document.addEventListener('keypress', handleUserInteraction);
        window.addEventListener('focus', handleUserInteraction);

        return () => {
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keypress', handleUserInteraction);
            window.removeEventListener('focus', handleUserInteraction);
        };
    }, [isSoundInitialized]);

    return { isSoundInitialized };
}

