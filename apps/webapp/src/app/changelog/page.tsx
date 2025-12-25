'use client';

import { FileText, ArrowLeft, Star, Zap, Bug } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ChangelogEntry {
    version: string;
    date: string;
    highlights?: string;
    features?: string[];
    improvements?: string[];
    fixes?: string[];
}

const changelogData: ChangelogEntry[] = [
    {
        version: '1.0.0',
        date: 'December 2024',
        highlights: 'Initial Release 🎉',
        features: [
            'AI-powered browser assistant with Gemini integration',
            'MCP (Model Context Protocol) support for extending capabilities',
            'Voice mode with natural conversation flow',
            'Browser automation with Agent mode',
            'YouTube transcript analysis and summarization',
            'Smart reminders with natural language processing',
            'Local memory for preferences and context',
            'Tab groups management',
            'Ask AI floating button on any webpage',
            'Text summarization, rewriting, and writing assistance',
        ],
        improvements: [
            'Modern, responsive dark theme UI',
            'Keyboard shortcuts for quick access (Ctrl+Shift+H)',
            'Multiple AI models to choose from',
            'Configurable tool permissions',
        ],
    },
];

export default function ChangelogPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
            <div className="container mx-auto max-w-3xl px-4 py-12">
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
                        <div className="p-2.5 bg-gradient-to-br from-green-500/20 to-teal-500/20 rounded-xl">
                            <FileText size={24} className="text-green-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Changelog</h1>
                            <p className="text-white/60 text-sm">What&apos;s new in Cognito</p>
                        </div>
                    </div>
                </div>

                {/* Changelog Entries */}
                <div className="space-y-6">
                    {changelogData.map((entry) => (
                        <Card
                            key={entry.version}
                            className="bg-white/[0.03] border-white/[0.06] overflow-hidden"
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-xl text-white">
                                        v{entry.version}
                                    </CardTitle>
                                    <CardDescription className="text-white/50 text-sm">
                                        {entry.date}
                                    </CardDescription>
                                </div>
                                {entry.highlights && (
                                    <p className="text-white/80 font-medium">{entry.highlights}</p>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Features */}
                                {entry.features && entry.features.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Star size={16} className="text-yellow-400" />
                                            <h4 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                                                New Features
                                            </h4>
                                        </div>
                                        <ul className="space-y-2">
                                            {entry.features.map((feature, index) => (
                                                <li
                                                    key={index}
                                                    className="text-sm text-white/70 flex items-start gap-2 pl-6"
                                                >
                                                    <span className="text-yellow-400/60 mt-0.5">•</span>
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Improvements */}
                                {entry.improvements && entry.improvements.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Zap size={16} className="text-blue-400" />
                                            <h4 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                                                Improvements
                                            </h4>
                                        </div>
                                        <ul className="space-y-2">
                                            {entry.improvements.map((improvement, index) => (
                                                <li
                                                    key={index}
                                                    className="text-sm text-white/70 flex items-start gap-2 pl-6"
                                                >
                                                    <span className="text-blue-400/60 mt-0.5">•</span>
                                                    {improvement}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Bug Fixes */}
                                {entry.fixes && entry.fixes.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Bug size={16} className="text-green-400" />
                                            <h4 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                                                Bug Fixes
                                            </h4>
                                        </div>
                                        <ul className="space-y-2">
                                            {entry.fixes.map((fix, index) => (
                                                <li
                                                    key={index}
                                                    className="text-sm text-white/70 flex items-start gap-2 pl-6"
                                                >
                                                    <span className="text-green-400/60 mt-0.5">•</span>
                                                    {fix}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-12 text-center">
                    <p className="text-white/40 text-sm">
                        More updates coming soon! Follow our development on GitHub.
                    </p>
                </div>
            </div>
        </div>
    );
}
