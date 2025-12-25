import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Shield, Eye, Lock } from "lucide-react";

interface CapabilitiesPageProps {
    onNext: () => void;
    onBack: () => void;
}

export function CapabilitiesPage({ onNext, onBack }: CapabilitiesPageProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-in fade-in slide-in-from-right-10 duration-500 max-w-6xl mx-auto w-full px-4">
            <div className="text-center space-y-4 max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl text-foreground">Capabilities & Privacy</h2>
                <p className="text-muted-foreground text-lg">How Cognito works with your data.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
                <Card className="bg-card/60 backdrop-blur-sm border-border border-t-[3px] border-t-[#C6FE1E]">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#C6FE1E]/10 flex items-center justify-center">
                                <Eye className="w-5 h-5 text-[#C6FE1E]" />
                            </div>
                            <CardTitle className="text-foreground">What it can read</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#C6FE1E]"></div>
                                <span>Current tab content when you ask</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#C6FE1E]"></div>
                                <span>Selected text for instant actions</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#C6FE1E]"></div>
                                <span>PDFs you explicitly open</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#C6FE1E]"></div>
                                <span>YouTube video transcripts</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                <Card className="bg-card/60 backdrop-blur-sm border-border border-t-[3px] border-t-[#1264FF]">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#1264FF]/10 flex items-center justify-center">
                                <Shield className="w-5 h-5 text-[#1264FF]" />
                            </div>
                            <CardTitle className="text-foreground">Privacy First</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#1264FF]"></div>
                                <span>API keys stored locally in browser</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#1264FF]"></div>
                                <span>No data collection on our servers</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#1264FF]"></div>
                                <span>Your chats stay on your device</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#1264FF]"></div>
                                <span>You choose the AI model provider</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>

            <Card className="w-full max-w-5xl bg-[#1264FF]/10 border-[#1264FF]/20">
                <CardContent className="flex items-center gap-4 p-6">
                    <Lock className="w-8 h-8 text-[#1264FF] shrink-0" />
                    <div className="space-y-1">
                        <p className="font-semibold text-[#1264FF]">Secure by Design</p>
                        <p className="text-sm text-[#1264FF]/80">Cognito acts as a bridge between you and your AI provider. We don't see your data.</p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex gap-4 w-full max-w-md pt-4">
                <Button variant="outline" className="flex-1 border-border hover:bg-muted hover:text-foreground" onClick={onBack}>
                    <ArrowLeft className="mr-2 w-4 h-4" />
                    Back
                </Button>
                <Button className="flex-1 text-white bg-[#1264FF] hover:bg-[#1264FF]/90 font-medium" onClick={onNext}>
                    Next
                    <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
