import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Shield, Eye, Lock } from "lucide-react";

interface CapabilitiesPageProps {
    onNext: () => void;
    onBack: () => void;
}

export function CapabilitiesPage({ onNext, onBack }: CapabilitiesPageProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Capabilities & Privacy</h2>
                <p className="text-muted-foreground">How Cognito works with your data.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-primary">
                            <Eye className="w-6 h-6" />
                            <CardTitle>What it can read</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                            <li>Current tab content when you ask</li>
                            <li>Selected text for instant actions</li>
                            <li>PDFs you explicitly open</li>
                            <li>YouTube video transcripts</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-primary">
                            <Shield className="w-6 h-6" />
                            <CardTitle>Privacy First</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                            <li>API keys stored locally in browser</li>
                            <li>No data collection on our servers</li>
                            <li>Your chats stay on your device</li>
                            <li>You choose the AI model provider</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>

            <Card className="w-full max-w-4xl bg-blue-500/10 border-blue-500/20">
                <CardContent className="flex items-center gap-4 p-4">
                    <Lock className="w-8 h-8 text-blue-500 shrink-0" />
                    <div className="space-y-1">
                        <p className="font-semibold text-blue-500">Secure by Design</p>
                        <p className="text-sm text-blue-500/80">Cognito acts as a bridge between you and your AI provider. We don't see your data.</p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex gap-4 w-full max-w-md">
                <Button variant="outline" className="flex-1" onClick={onBack}>
                    <ArrowLeft className="mr-2 w-4 h-4" />
                    Back
                </Button>
                <Button className="flex-1" onClick={onNext}>
                    Next
                    <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
