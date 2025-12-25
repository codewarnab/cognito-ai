import { useState, useEffect, useRef } from 'react';
import { createLogger } from '~logger';
import { WEBAPP_ROUTES } from '@/constants/webapp';

const log = createLogger('useOnboarding', 'SETTINGS');

/**
 * Hook to manage onboarding state and persistence
 */
export function useOnboarding() {
    const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
    const [showChatInterface, setShowChatInterface] = useState(false);

    const hasOpenedOnboarding = useRef(false);

    // Check onboarding status on mount and listen for changes
    useEffect(() => {
        const checkOnboardingStatus = async () => {
            try {
                const result = await chrome.storage.local.get(['onboarding_completed']);
                log.info('Onboarding status check', {
                    onboarding_completed: result.onboarding_completed,
                });
                if (result.onboarding_completed) {
                    setShowOnboarding(false);
                    setShowChatInterface(true);
                    log.info('Onboarding already completed, hiding onboarding');
                } else {
                    setShowOnboarding(true);
                    setShowChatInterface(false);
                    // Only redirect if this is likely the initial check or triggered by storage change to false (unlikely)
                    // But for now, we just log redirect intent. The actual redirect should happen maybe once per session?
                    // Re-opening the sidepanel triggers this effect.
                    log.info('Onboarding not completed, redirecting to webapp');

                    // Open webapp for onboarding if not already opened in this session
                    if (!hasOpenedOnboarding.current) {
                        hasOpenedOnboarding.current = true;
                        chrome.tabs.create({ url: WEBAPP_ROUTES.ONBOARDING });
                    }
                }
            } catch (error) {
                log.error('Failed to check onboarding status', error);
                // In case of error, default to showing chat interface to avoid blocking user
                setShowOnboarding(false);
                setShowChatInterface(true);
            }
        };

        checkOnboardingStatus();

        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.onboarding_completed) {
                log.info('Onboarding status changed in storage, re-checking');
                checkOnboardingStatus();
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);

        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, []);

    const resetOnboarding = async () => {
        try {
            await chrome.storage.local.remove(['onboarding_completed']);
            setShowOnboarding(true);
            setShowChatInterface(false);
            log.info('Onboarding reset');
        } catch (error) {
            log.error('Failed to reset onboarding', error);
        }
    };

    return {
        showOnboarding,
        showChatInterface,
        setShowOnboarding,
        setShowChatInterface,
        resetOnboarding,
    };
}
