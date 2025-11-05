import { useState, useEffect } from 'react';
import { createLogger } from '../logger';

const log = createLogger('useOnboarding');

/**
 * Hook to manage onboarding state and persistence
 */
export function useOnboarding() {
    const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
    const [showChatInterface, setShowChatInterface] = useState(false);

    // Check onboarding status on mount
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
                    log.info('Onboarding not completed, showing onboarding');
                }
            } catch (error) {
                log.error('Failed to check onboarding status', error);
                setShowOnboarding(false);
                setShowChatInterface(true);
            }
        };
        checkOnboardingStatus();
    }, []);

    const handleOnboardingComplete = async () => {
        try {
            await chrome.storage.local.set({ onboarding_completed: true });
            setShowOnboarding(false);
            setShowChatInterface(true);
            log.info('Onboarding completed, showing chat interface');
        } catch (error) {
            log.error('Failed to save onboarding status', error);
            setShowOnboarding(false);
            setShowChatInterface(true);
        }
    };

    const handleOnboardingSkip = async () => {
        try {
            await chrome.storage.local.set({ onboarding_completed: true });
            setShowOnboarding(false);
            setShowChatInterface(true);
            log.info('Onboarding skipped, showing chat interface');
        } catch (error) {
            log.error('Failed to save onboarding skip status', error);
            setShowOnboarding(false);
            setShowChatInterface(true);
        }
    };

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
        handleOnboardingComplete,
        handleOnboardingSkip,
        resetOnboarding,
    };
}
