import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { ThemeToggle } from "@/components/shared/ThemeToggle";


export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <OnboardingProvider>
            <div className="min-h-screen bg-background text-foreground flex flex-col">
                {/* Theme toggle in top-right corner */}
                <div className="absolute top-4 right-4 z-50">
                    <ThemeToggle />
                </div>
                {/* Header / Nav could go here if needed, but keeping it minimal for now */}
                <div className="flex-1 flex flex-col relative">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background dark:from-blue-900/20 dark:via-background dark:to-background pointer-events-none" />

                    <div className="relative z-10 flex-1 flex flex-col pt-8">
                        {children}
                    </div>
                </div>
            </div>
        </OnboardingProvider>
    );
}
