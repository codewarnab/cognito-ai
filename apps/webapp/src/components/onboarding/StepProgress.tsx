import { useOnboardingContext } from "@/components/onboarding/OnboardingProvider";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function StepProgress() {
    const { step, totalSteps } = useOnboardingContext();

    return (
        <div className="w-full max-w-md mx-auto mb-8 px-4">
            <div className="relative flex items-center justify-between">
                {/* Progress Bar Background */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-border rounded-full -z-10" />

                {/* Active Progress Bar */}
                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#1264FF] rounded-full -z-10 transition-all duration-500 ease-in-out"
                    style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
                />

                {/* Steps */}
                {Array.from({ length: totalSteps }).map((_, index) => {
                    const stepNumber = index + 1;
                    const isActive = stepNumber === step;
                    const isCompleted = stepNumber < step;

                    return (
                        <div key={stepNumber} className="flex flex-col items-center gap-2">
                            <div
                                className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all duration-300",
                                    isActive && "border-[#1264FF] bg-background text-[#1264FF] scale-110 shadow-[0_0_10px_rgba(18,100,255,0.5)]",
                                    isCompleted && "border-[#1264FF] bg-[#1264FF] text-white",
                                    !isActive && !isCompleted && "border-border bg-background text-muted-foreground"
                                )}
                            >
                                {isCompleted ? <Check className="w-4 h-4" /> : stepNumber}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
