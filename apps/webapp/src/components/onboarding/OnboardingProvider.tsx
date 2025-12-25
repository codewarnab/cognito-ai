'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useExtension } from '@/hooks/useExtension';
import type { OnboardingMessageType, LifecycleMessageType } from '@cognito/shared';

interface OnboardingContextType {
    step: number;
    totalSteps: number;
    nextStep: () => void;
    prevStep: () => void;
    setStep: (step: number) => void;
    completeOnboarding: (action?: 'sidepanel' | 'settings' | 'providers') => Promise<void>;
    isCompleting: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
    const [step, setStep] = useState(1);
    const [isCompleting, setIsCompleting] = useState(false);
    const router = useRouter();
    const { sendMessage } = useExtension();
    const totalSteps = 4;

    const nextStep = () => setStep((s) => Math.min(s + 1, totalSteps));
    const prevStep = () => setStep((s) => Math.max(s - 1, 1));

    const completeOnboarding = async (action: 'sidepanel' | 'settings' | 'providers' = 'sidepanel') => {
        setIsCompleting(true);
        try {
            // Send completion message
            await sendMessage({ type: 'SET_ONBOARDING_COMPLETE' as OnboardingMessageType });

            if (action === 'sidepanel') {
                // Open sidepanel
                await sendMessage({ type: 'OPEN_SIDEPANEL' as LifecycleMessageType });
                // Redirect to settings as fallback so webapp doesn't stay on onboarding
                router.push('/settings');
            } else if (action === 'providers') {
                // Redirect to settings with model tab (assuming settings page supports it, otherwise just settings)
                // TODO: Ensure settings page supports tab query param or similar
                router.push('/settings');
            } else {
                // Default to settings
                router.push('/settings');
            }

        } catch (error) {
            console.error("Error completing onboarding:", error);
            setIsCompleting(false);
            throw error;
        }
    };

    return (
        <OnboardingContext.Provider value={{
            step,
            totalSteps,
            nextStep,
            prevStep,
            setStep,
            completeOnboarding,
            isCompleting
        }}>
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboardingContext() {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error('useOnboardingContext must be used within an OnboardingProvider');
    }
    return context;
}
