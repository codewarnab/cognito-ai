'use client';

import { useState } from 'react';
import { Sparkles, Copy, Check, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { examplePrompts } from '@/lib/featuresData';

export default function FeaturesPage() {
    const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

    const handleCopyPrompt = async (prompt: string) => {
        try {
            await navigator.clipboard.writeText(prompt);
            setCopiedPrompt(prompt);
            setTimeout(() => setCopiedPrompt(null), 2000);
        } catch (error) {
            console.error('Failed to copy prompt', error);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
            <div className="container mx-auto max-w-4xl px-4 py-12">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6"
                    >
                        <ArrowLeft size={16} />
                        <span className="text-sm">Back to Home</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
                            <Sparkles size={24} className="text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Features & Examples</h1>
                            <p className="text-white/60 text-sm">
                                Discover what Cognito can do with these example prompts
                            </p>
                        </div>
                    </div>
                </div>

                {/* Feature Categories */}
                <div className="grid gap-6">
                    {examplePrompts.map((category) => {
                        const Icon = category.icon;
                        return (
                            <Card
                                key={category.id}
                                className="bg-white/[0.03] border-white/[0.06] overflow-hidden"
                            >
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <div className="p-2 bg-white/[0.05] rounded-lg">
                                            <Icon size={20} className="text-white/70" />
                                        </div>
                                        <span className="text-white">{category.category}</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-2">
                                        {category.prompts.map((prompt, index) => (
                                            <div
                                                key={index}
                                                className="group flex items-center justify-between gap-3 p-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] hover:border-white/[0.08] rounded-lg cursor-pointer transition-all"
                                                onClick={() => handleCopyPrompt(prompt)}
                                            >
                                                <p className="text-sm text-white/70 group-hover:text-white/90 transition-colors flex-1">
                                                    {prompt}
                                                </p>
                                                <button
                                                    className="shrink-0 p-1.5 text-white/30 hover:text-white hover:bg-white/10 rounded transition-all"
                                                    title="Copy prompt"
                                                >
                                                    {copiedPrompt === prompt ? (
                                                        <Check size={14} className="text-green-400" />
                                                    ) : (
                                                        <Copy size={14} />
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="mt-12 text-center">
                    <p className="text-white/40 text-sm">
                        Click any prompt to copy it, then paste it into the Cognito chat!
                    </p>
                </div>
            </div>
        </div>
    );
}
