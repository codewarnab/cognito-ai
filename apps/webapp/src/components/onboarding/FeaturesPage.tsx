import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, MessageSquare, Zap, Mic, Globe } from "lucide-react";

interface FeaturesPageProps {
    onNext: () => void;
    onBack: () => void;
}

export function FeaturesPage({ onNext, onBack }: FeaturesPageProps) {
    const features = [
        {
            icon: MessageSquare,
            title: "Smart Chat",
            description: "Context-aware conversations with your choice of AI models.",
            color: "text-[#1264FF]"
        },
        {
            icon: Zap,
            title: "Instant Actions",
            description: "Summarize, rewrite, and analyze web content with one click.",
            color: "text-[#C6FE1E]"
        },
        {
            icon: Mic,
            title: "Voice Mode",
            description: "Talk to your AI naturally with real-time voice interaction.",
            color: "text-[#1264FF]"
        },
        {
            icon: Globe,
            title: "Web Intelligence",
            description: "Read and understand any webpage or PDF instantly.",
            color: "text-[#C6FE1E]"
        }
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-in fade-in slide-in-from-right-10 duration-500 max-w-6xl mx-auto w-full px-4">
            <div className="text-center space-y-4 max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Powerful Features</h2>
                <p className="text-muted-foreground text-lg">Everything you need to boost productivity.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                {features.map((feature, index) => (
                    <Card key={index} className="bg-[#0f1420]/60 backdrop-blur-sm border-white/5 hover:bg-[#0f1420]/80 transition-all hover:-translate-y-1 hover:border-[#1264FF]/30 group">
                        <CardHeader>
                            <div className={`w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors`}>
                                <feature.icon className={`w-6 h-6 ${feature.color}`} />
                            </div>
                            <CardTitle className="text-lg text-white">{feature.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription className="text-muted-foreground/80 leading-relaxed">
                                {feature.description}
                            </CardDescription>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex gap-4 w-full max-w-md pt-4">
                <Button variant="outline" className="flex-1 border-white/10 hover:bg-white/5 hover:text-white" onClick={onBack}>
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
