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
            description: "Context-aware conversations with your choice of AI models."
        },
        {
            icon: Zap,
            title: "Instant Actions",
            description: "Summarize, rewrite, and analyze web content with one click."
        },
        {
            icon: Mic,
            title: "Voice Mode",
            description: "Talk to your AI naturally with real-time voice interaction."
        },
        {
            icon: Globe,
            title: "Web Intelligence",
            description: "Read and understand any webpage or PDF instantly."
        }
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Powerful Features</h2>
                <p className="text-muted-foreground">Everything you need to boost productivity.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
                {features.map((feature, index) => (
                    <Card key={index} className="bg-card/50 backdrop-blur-sm border-border/50 hover:bg-card/80 transition-colors">
                        <CardHeader className="pb-2">
                            <feature.icon className="w-8 h-8 text-primary mb-2" />
                            <CardTitle className="text-lg">{feature.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>{feature.description}</CardDescription>
                        </CardContent>
                    </Card>
                ))}
            </div>

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
