import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

interface WelcomePageProps {
    onNext: () => void;
}

export function WelcomePage({ onNext }: WelcomePageProps) {
    return (
        <div className="flex flex-col lg:flex-row items-center justify-center min-h-[60vh] gap-12 animate-in fade-in zoom-in duration-500 slide-in-from-bottom-10 max-w-6xl mx-auto w-full px-4">
            {/* Left side: Hero/Branding */}
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-6 lg:w-1/2">
                <img src="/onboarding/logo.png" alt="Cognito" className="w-24 h-24 object-contain" />

                <div className="space-y-4">
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-foreground">
                        Welcome to <span className="text-[#1264FF]">Cognito</span>
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-md">
                        Your private, AI-powered workspace assistant. Experience the future of browsing with intelligent automation.
                    </p>
                </div>

                <div className="hidden lg:block relative w-full h-64 mt-8 rounded-xl overflow-hidden border border-border shadow-2xl bg-card/50 backdrop-blur-sm">
                    <img src="/onboarding/agent.png" alt="AI Agent" className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                </div>
            </div>

            {/* Right side: Steps/Action */}
            <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-xl shadow-xl lg:w-1/2">
                <CardHeader>
                    <CardTitle className="text-xl">Getting Started</CardTitle>
                    <CardDescription>
                        Set up your personalized AI experience in just a few steps.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <ul className="space-y-4">
                        <li className="flex items-start gap-4">
                            <span className="flex-shrink-0 bg-[#1264FF]/20 text-[#1264FF] rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold border border-[#1264FF]/30">1</span>
                            <div className="space-y-1">
                                <span className="font-medium text-foreground">Explore Features</span>
                                <p className="text-sm text-muted-foreground">Discover what Cognito can do for you.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <span className="flex-shrink-0 bg-[#1264FF]/20 text-[#1264FF] rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold border border-[#1264FF]/30">2</span>
                            <div className="space-y-1">
                                <span className="font-medium text-foreground">Privacy First</span>
                                <p className="text-sm text-muted-foreground">Understand how your data stays secure.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <span className="flex-shrink-0 bg-[#1264FF]/20 text-[#1264FF] rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold border border-[#1264FF]/30">3</span>
                            <div className="space-y-1">
                                <span className="font-medium text-foreground">Connect Providers</span>
                                <p className="text-sm text-muted-foreground">Link your preferred AI models.</p>
                            </div>
                        </li>
                    </ul>
                </CardContent>
                <CardFooter>
                    <Button className="w-full text-white bg-[#1264FF] hover:bg-[#1264FF]/90 font-medium h-11" size="lg" onClick={onNext}>
                        Start Onboarding
                        <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
