'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WelcomePage } from "@/components/onboarding/WelcomePage";
import { FeaturesPage } from "@/components/onboarding/FeaturesPage";
import { CapabilitiesPage } from "@/components/onboarding/CapabilitiesPage";
import { GetStartedPage } from "@/components/onboarding/GetStartedPage";
import { StepProgress } from "@/components/onboarding/StepProgress";
import { useExtension } from "@/hooks/useExtension";
import { Loader2, Download } from "lucide-react";
import type { OnboardingMessageType } from "@cognito/shared";
import { Button } from "@/components/ui/button";
import { useOnboardingContext } from "@/components/onboarding/OnboardingProvider";

export default function OnboardingPage() {
    const router = useRouter();
    const { step, nextStep, prevStep, completeOnboarding } = useOnboardingContext();
    const { isInstalled, isLoading: isExtensionLoading, sendMessage } = useExtension();
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [isCompleted, setIsCompleted] = useState(false);

    // Check onboarding status
    useEffect(() => {
        const checkStatus = async () => {
            if (isExtensionLoading) return;

            if (!isInstalled) {
                setCheckingStatus(false);
                return;
            }

            try {
                const response = await sendMessage({ type: 'GET_ONBOARDING_STATUS' as OnboardingMessageType });
                if (response.success && response.data?.completed) {
                    setIsCompleted(true);
                    router.replace('/settings');
                }
            } catch (error) {
                console.error("Failed to check onboarding status:", error);
            } finally {
                setCheckingStatus(false);
            }
        };

        checkStatus();
    }, [isExtensionLoading, isInstalled, sendMessage, router]);

    if (isExtensionLoading || checkingStatus) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isInstalled) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                <div className="max-w-md space-y-6">
                    <h1 className="text-3xl font-bold">Extension Required</h1>
                    <p className="text-muted-foreground">
                        To continue with the onboarding process, you need to install the Cognito AI Chrome extension first.
                    </p>
                    <Button
                        size="lg"
                        onClick={() => window.open('https://chrome.google.com/webstore/detail/your-extension-id', '_blank')}
                        className="gap-2"
                    >
                        <Download className="w-5 h-5" />
                        Install Extension
                    </Button>
                </div>
            </div>
        );
    }

    // Don't render anything while redirecting
    if (isCompleted) {
        return null;
    }

    return (
        <div className="container mx-auto px-4 lg:px-12 py-8 flex flex-col h-full max-w-6xl">
            <header className="flex flex-col items-center justify-center py-4 mb-4">
                <div className="w-full max-w-md">
                    <StepProgress />
                </div>
            </header>

            <main className="flex-1 flex flex-col justify-center min-h-[500px]">
                {step === 1 && <WelcomePage onNext={nextStep} />}
                {step === 2 && <FeaturesPage onNext={nextStep} onBack={prevStep} />}
                {step === 3 && <CapabilitiesPage onNext={nextStep} onBack={prevStep} />}
                {step === 4 && <GetStartedPage onBack={prevStep} onComplete={completeOnboarding} />}
            </main>

            <footer className="py-6 text-center text-sm text-muted-foreground/50">
                © {new Date().getFullYear()} Cognito AI
            </footer>
        </div>
    );
}
