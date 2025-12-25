import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

interface WelcomePageProps {
    onNext: () => void;
}

export function WelcomePage({ onNext }: WelcomePageProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in zoom-in duration-500 slide-in-from-bottom-10">
            <div className="space-y-4 max-w-2xl">
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                    Welcome to Cognito
                </h1>
                <p className="text-xl text-muted-foreground">
                    Your private, AI-powered workspace assistant.
                </p>
            </div>

            <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>Getting Started</CardTitle>
                    <CardDescription>
                        Let's set up your personalized AI experience in just a few steps.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ul className="text-left space-y-3 text-sm text-muted-foreground">
                        <li className="flex items-center gap-3">
                            <span className="bg-primary/10 text-primary rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
                            <span>Explore powerful AI features</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="bg-primary/10 text-primary rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
                            <span>Understand capabilities & privacy</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="bg-primary/10 text-primary rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
                            <span>Connect your AI providers</span>
                        </li>
                    </ul>
                </CardContent>
                <CardFooter>
                    <Button className="w-full group" size="lg" onClick={onNext}>
                        Start Onboarding
                        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
