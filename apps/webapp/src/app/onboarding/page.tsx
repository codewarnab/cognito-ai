'use client';

import { useState } from "react";
import { WelcomePage } from "@/components/onboarding/WelcomePage";
import { FeaturesPage } from "@/components/onboarding/FeaturesPage";
import { CapabilitiesPage } from "@/components/onboarding/CapabilitiesPage";
import { GetStartedPage } from "@/components/onboarding/GetStartedPage";
import { useExtension } from "@/hooks/useExtension";
import { Loader2 } from "lucide-react";
import type { OnboardingMessageType, LifecycleMessageType } from "@cognito/shared";

export default function OnboardingPage() {
    const [step, setStep] = useState(1);
    const { sendMessage, isLoading } = useExtension();

    const handleNext = () => setStep((s) => s + 1);
    const handleBack = () => setStep((s) => s - 1);

    const handleComplete = async () => {
        try {
            // Send completion message
            await sendMessage({ type: 'SET_ONBOARDING_COMPLETE' as OnboardingMessageType });

            // Open sidepanel
            await sendMessage({ type: 'OPEN_SIDEPANEL' as LifecycleMessageType });

        } catch (error) {
            console.error("Error completing onboarding:", error);
            throw error; // Re-throw so child component handles state
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 min-h-screen flex flex-col">
            <header className="flex justify-between items-center py-4">
                <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Cognito</div>
            </header>

            <main className="flex-1 flex flex-col justify-center">
                {step === 1 && <WelcomePage onNext={handleNext} />}
                {step === 2 && <FeaturesPage onNext={handleNext} onBack={handleBack} />}
                {step === 3 && <CapabilitiesPage onNext={handleNext} onBack={handleBack} />}
                {step === 4 && <GetStartedPage onBack={handleBack} onComplete={handleComplete} />}
            </main>

            <footer className="py-6 text-center text-sm text-muted-foreground">
                © {new Date().getFullYear()} Cognito AI
            </footer>
        </div>
    );
}
