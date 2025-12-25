import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { useState } from "react";

interface GetStartedPageProps {
    onBack: () => void;
    onComplete: (action: 'sidepanel' | 'settings' | 'providers') => Promise<void>;
}

export function GetStartedPage({ onBack, onComplete }: GetStartedPageProps) {
    const [isCompleting, setIsCompleting] = useState(false);

    const handleComplete = async (action: 'sidepanel' | 'settings' | 'providers') => {
        setIsCompleting(true);
        try {
            await onComplete(action);
        } catch (error) {
            console.error("Failed to complete onboarding:", error);
        } finally {
            setIsCompleting(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in slide-in-from-right-10 duration-500 max-w-6xl mx-auto w-full px-4">
            <div className="text-center space-y-4 max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl text-white">You're All Set!</h2>
                <p className="text-muted-foreground text-lg">Ready to experience the future of browsing?</p>
            </div>

            <Card className="w-full max-w-md bg-[#0f1420]/60 backdrop-blur-sm border-white/10 shadow-xl">
                <CardContent className="pt-8 flex flex-col items-center text-center space-y-8">
                    <div className="w-24 h-24 rounded-full bg-[#C6FE1E]/10 flex items-center justify-center animate-bounce duration-1000">
                        <CheckCircle2 className="w-12 h-12 text-[#C6FE1E]" />
                    </div>

                    <div className="space-y-3">
                        <p className="text-xl font-medium text-white">Extension Installed & Ready</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Click the button below to open the side panel and start your first conversation.
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 pb-8">
                    <Button
                        className="w-full text-white bg-[#1264FF] hover:bg-[#1264FF]/90 font-medium h-12 text-base"
                        size="lg"
                        onClick={() => handleComplete('sidepanel')}
                        disabled={isCompleting}
                    >
                        {isCompleting ? (
                            <>
                                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                                Finishing Up...
                            </>
                        ) : (
                            <>
                                Open Cognito Sidepanel
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </>
                        )}
                    </Button>

                    <Button
                        variant="secondary"
                        className="w-full font-medium h-12 text-base"
                        size="lg"
                        onClick={() => handleComplete('providers')}
                        disabled={isCompleting}
                    >
                        Configure AI Providers
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full font-medium h-12 text-base"
                        size="lg"
                        onClick={() => handleComplete('settings')}
                        disabled={isCompleting}
                    >
                        Go to Settings
                    </Button>
                    <Button
                        variant="ghost"
                        className="w-full text-muted-foreground hover:text-white"
                        onClick={onBack}
                        disabled={isCompleting}
                    >
                        Back
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
