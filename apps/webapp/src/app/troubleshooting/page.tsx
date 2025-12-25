'use client';

import { useState } from 'react';
import { HelpCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { troubleshootingData } from '@/lib/troubleshootingData';
import { Header } from '@/components/shared/Header';
import { AnimatedAccordion } from '@/components/shared/AnimatedAccordion';

export default function TroubleshootingPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [openId, setOpenId] = useState<string | null>(null);

    const filteredItems = troubleshootingData.filter((item) =>
        item.issue.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.causes.some((cause) => cause.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.solutions.some((solution) => solution.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-[var(--bg-primary)]">
            <Header title="Troubleshooting" />
            <div className="container mx-auto max-w-3xl px-4 py-8">
                {/* Page Title */}
                <div className="mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
                            <HelpCircle size={24} className="text-orange-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Troubleshooting</h1>
                            <p className="text-[var(--text-secondary)] text-sm">Find solutions to common issues</p>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-8">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
                    <Input
                        type="text"
                        placeholder="Search issues..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Troubleshooting Items */}
                {filteredItems.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-[var(--text-secondary)]">No matching issues found.</p>
                        <p className="text-[var(--text-secondary)]/60 text-sm mt-2">Try a different search term.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredItems.map((item) => (
                            <TroubleshootingAccordion
                                key={item.id}
                                title={item.issue}
                                isOpen={openId === item.id}
                                onToggle={() => setOpenId(prev => prev === item.id ? null : item.id)}
                            >
                                {/* Causes */}
                                <div className="mb-4">
                                    <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                                        Possible Causes
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {item.causes.map((cause, index) => (
                                            <li
                                                key={index}
                                                className="text-sm text-[var(--text-secondary)] flex items-start gap-2"
                                            >
                                                <span className="text-orange-500/60 mt-0.5">•</span>
                                                {cause}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Solutions */}
                                <div>
                                    <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                                        Solutions
                                    </h4>
                                    <ul className="space-y-2">
                                        {item.solutions.map((solution, index) => (
                                            <li
                                                key={index}
                                                className="text-sm text-[var(--text-primary)] flex items-start gap-2 bg-[var(--bg-secondary)] p-2.5 rounded-lg"
                                            >
                                                <span className="text-green-600 font-medium shrink-0">
                                                    {index + 1}.
                                                </span>
                                                <span>{solution}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </TroubleshootingAccordion>
                        ))}
                    </div>
                )}

                {/* Help Footer */}
                <div className="mt-12 text-center">
                    <p className="text-[var(--text-secondary)]/60 text-sm">
                        Still having issues? Try creating a new chat or refreshing the extension.
                    </p>
                </div>
            </div>
        </div>
    );
}

function TroubleshootingAccordion({
    children,
    title,
    isOpen,
    onToggle,
}: {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <AnimatedAccordion
            title={title}
            isOpen={isOpen}
            onToggle={onToggle}
        >
            {children}
        </AnimatedAccordion>
    );
}
