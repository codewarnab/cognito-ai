import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { useState } from "react";

interface GetStartedPageProps {
    onBack: () => void;
    onComplete: () => Promise<void>;
}

export function GetStartedPage({ onBack, onComplete }: GetStartedPageProps) {
    const [isCompleting, setIsCompleting] = useState(false);

    const handleComplete = async () => {
        setIsCompleting(true);
        try {
            await onComplete();
        } catch (error) {
            console.error("Failed to complete onboarding:", error);
        } finally {
            setIsCompleting(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">You're All Set!</h2>
                <p className="text-muted-foreground">Ready to experience the future of browsing?</p>
            </div>

            <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-border/50">
                <CardContent className="pt-6 flex flex-col items-center text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                    </div>

                    <div className="space-y-2">
                        <p className="text-lg font-medium">Extension Installed & Ready</p>
                        <p className="text-sm text-muted-foreground">
                            Click the button below to open the side panel and start your first conversation.
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button className="w-full" size="lg" onClick={handleComplete} disabled={isCompleting}>
                        {isCompleting ? (
                            <>
                                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                                Finishing Up...
                            </>
                        ) : (
                            <>
                                Open Cognito
                                <ArrowRight className="ml-2 w-4 h-4" />
                            </>
                        )}
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={onBack} disabled={isCompleting}>
                        Back
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
