import { useEffect } from 'react';

export interface UseOnboardingTestHandlesProps {
    resetOnboarding: () => void;
    setShowOnboarding: (show: boolean) => void;
    setShowChatInterface: (show: boolean) => void;
}

/**
 * Hook to expose onboarding test functions globally for testing purposes
 */
export function useOnboardingTestHandles({
    resetOnboarding,
    setShowOnboarding,
    setShowChatInterface,
}: UseOnboardingTestHandlesProps) {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).resetOnboarding = resetOnboarding;
            (window as any).showOnboarding = () => {
                setShowOnboarding(true);
                setShowChatInterface(false);
            };
            (window as any).hideOnboarding = () => {
                setShowOnboarding(false);
                setShowChatInterface(true);
            };
        }
    }, [resetOnboarding, setShowOnboarding, setShowChatInterface]);
}
