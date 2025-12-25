'use client';

import { useState } from 'react';
import { HelpCircle, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from '@/components/ui/accordion';
import { troubleshootingData } from '@/lib/troubleshootingData';

export default function TroubleshootingPage() {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredItems = troubleshootingData.filter((item) =>
        item.issue.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.causes.some((cause) => cause.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.solutions.some((solution) => solution.toLowerCase().includes(searchQuery.toLowerCase()))
    );

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
                        <div className="p-2.5 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl">
                            <HelpCircle size={24} className="text-orange-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Troubleshooting</h1>
                            <p className="text-white/60 text-sm">Find solutions to common issues</p>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-8">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" size={18} />
                    <Input
                        type="text"
                        placeholder="Search issues..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    />
                </div>

                {/* Troubleshooting Items */}
                {filteredItems.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-white/60">No matching issues found.</p>
                        <p className="text-white/40 text-sm mt-2">Try a different search term.</p>
                    </div>
                ) : (
                    <Accordion type="single" collapsible className="space-y-3">
                        {filteredItems.map((item) => (
                            <AccordionItem
                                key={item.id}
                                value={item.id}
                                className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 data-[state=open]:bg-white/[0.05] transition-colors"
                            >
                                <AccordionTrigger className="text-left hover:no-underline py-4">
                                    <span className="text-sm font-medium text-white pr-4">
                                        {item.issue}
                                    </span>
                                </AccordionTrigger>
                                <AccordionContent className="pb-4">
                                    {/* Causes */}
                                    <div className="mb-4">
                                        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                                            Possible Causes
                                        </h4>
                                        <ul className="space-y-1.5">
                                            {item.causes.map((cause, index) => (
                                                <li
                                                    key={index}
                                                    className="text-sm text-white/70 flex items-start gap-2"
                                                >
                                                    <span className="text-orange-400/60 mt-0.5">•</span>
                                                    {cause}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Solutions */}
                                    <div>
                                        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                                            Solutions
                                        </h4>
                                        <ul className="space-y-2">
                                            {item.solutions.map((solution, index) => (
                                                <li
                                                    key={index}
                                                    className="text-sm text-white/80 flex items-start gap-2 bg-white/[0.02] p-2.5 rounded-lg"
                                                >
                                                    <span className="text-green-400 font-medium shrink-0">
                                                        {index + 1}.
                                                    </span>
                                                    <span>{solution}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}

                {/* Help Footer */}
                <div className="mt-12 text-center">
                    <p className="text-white/40 text-sm">
                        Still having issues? Try creating a new chat or refreshing the extension.
                    </p>
                </div>
            </div>
        </div>
    );
}
