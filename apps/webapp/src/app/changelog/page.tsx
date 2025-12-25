'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from '@/components/shared/Header';
import { cn } from '@/lib/utils';

interface ChangelogEntry {
    version: string;
    date: Date;
    title: string;
    tags?: string[];
    video?: string;
    highlights?: string[];
    features?: string[];
    fixes?: string[];
}

const changelogData: ChangelogEntry[] = [
    {
        version: '1.0',
        date: new Date('2024-12-25'),
        title: 'Initial Release 🎉',
        tags: ['Release', 'Features'],
        video: '/demo.mp4',
        highlights: [
            '**AI-powered browser assistant** with Gemini integration',
            '**MCP support** for extending capabilities',
            '**Voice mode** with natural conversation flow',
            '**Browser automation** with Agent mode',
        ],
        features: [
            'YouTube transcript analysis and summarization',
            'Smart reminders with natural language processing',
            'Local memory for preferences and context',
            'Tab groups management',
            'Ask AI floating button on any webpage',
            'Text summarization, rewriting, and writing assistance',
            'Keyboard shortcuts for quick access (Ctrl+Shift+H)',
            'Multiple AI models to choose from',
            'Configurable tool permissions',
        ],
    },
];

function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export default function ChangelogPage() {
    return (
        <div className="min-h-screen bg-[var(--bg-primary)]">
            <Header title="Changelog" />

            {/* Timeline Container */}
            <div className="max-w-5xl mx-auto px-6 lg:px-10 pt-10">
                <div className="relative">
                    {changelogData.map((entry) => (
                        <div key={entry.version} className="relative">
                            <div className="flex flex-col md:flex-row gap-y-6">
                                {/* Left side - Date & Version */}
                                <div className="md:w-48 flex-shrink-0">
                                    <div className="md:sticky md:top-8 pb-10">
                                        <time className="text-sm font-medium text-[var(--text-secondary)] block mb-3">
                                            {formatDate(entry.date)}
                                        </time>
                                        <div className="inline-flex relative z-10 items-center justify-center w-10 h-10 text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-bold bg-[var(--bg-secondary)]">
                                            {entry.version}
                                        </div>
                                    </div>
                                </div>

                                {/* Right side - Content */}
                                <div className="flex-1 md:pl-8 relative pb-10">
                                    {/* Vertical timeline line */}
                                    <div className="hidden md:block absolute top-2 left-0 w-px h-full bg-[var(--border-color)]">
                                        {/* Timeline dot */}
                                        <div className="absolute -translate-x-1/2 size-3 bg-[var(--text-primary)] rounded-full z-10" />
                                    </div>

                                    <div className="space-y-6">
                                        {/* Title & Tags */}
                                        <div className="relative z-10 flex flex-col gap-2">
                                            <h2 className="text-2xl font-semibold tracking-tight text-balance text-[var(--text-primary)]">
                                                {entry.title}
                                            </h2>

                                            {entry.tags && entry.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {entry.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="h-6 w-fit px-2 text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-full border border-[var(--border-color)] flex items-center justify-center"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Video */}
                                        {entry.video && (
                                            <video
                                                src={entry.video}
                                                className="rounded-md border border-[var(--border-color)] w-full"
                                                controls
                                                loop
                                            />
                                        )}

                                        {/* Highlights */}
                                        {entry.highlights && entry.highlights.length > 0 && (
                                            <ul className="space-y-2 text-[var(--text-primary)]">
                                                {entry.highlights.map((highlight, index) => (
                                                    <li
                                                        key={index}
                                                        className="flex items-start gap-2 text-sm"
                                                        dangerouslySetInnerHTML={{
                                                            __html: `<span class="text-[var(--text-secondary)]">•</span> ${highlight.replace(
                                                                /\*\*(.+?)\*\*/g,
                                                                '<strong>$1</strong>'
                                                            )}`,
                                                        }}
                                                    />
                                                ))}
                                            </ul>
                                        )}

                                        {/* Accordion sections */}
                                        <div className="space-y-2">
                                            {entry.features && entry.features.length > 0 && (
                                                <AccordionSection title="Features">
                                                    <ul className="list-disc space-y-2 pl-4 text-[var(--text-secondary)] text-sm">
                                                        {entry.features.map((feature, index) => (
                                                            <li key={index}>{feature}</li>
                                                        ))}
                                                    </ul>
                                                </AccordionSection>
                                            )}

                                            {entry.fixes && entry.fixes.length > 0 && (
                                                <AccordionSection title="Bug Fixes">
                                                    <ul className="list-disc space-y-2 pl-4 text-[var(--text-secondary)] text-sm">
                                                        {entry.fixes.map((fix, index) => (
                                                            <li key={index}>{fix}</li>
                                                        ))}
                                                    </ul>
                                                </AccordionSection>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="py-12 text-center">
                    <p className="text-[var(--text-secondary)]/60 text-sm">
                        More updates coming soon! Follow our development on GitHub.
                    </p>
                </div>
            </div>
        </div>
    );
}

function AccordionSection({ title, children }: { title: string; children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <motion.div
            layout
            className={cn(
                'bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden transition-colors',
                isOpen && 'bg-[var(--bg-tertiary)]'
            )}
        >
            <div className="p-4">
                <button
                    className="flex items-center justify-between w-full text-left cursor-pointer"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                >
                    <span className="text-sm font-medium text-[var(--text-primary)] pr-4">
                        {title}
                    </span>
                    <motion.span
                        animate={{ rotate: isOpen ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-[var(--text-secondary)] shrink-0"
                    >
                        <ChevronRight size={16} />
                    </motion.span>
                </button>
                <AnimatePresence initial={false}>
                    {isOpen && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            transition={{
                                type: 'spring',
                                stiffness: 180,
                                damping: 26,
                            }}
                            className="overflow-hidden"
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                transition={{ duration: 0.2 }}
                                className="pt-4"
                            >
                                {children}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
