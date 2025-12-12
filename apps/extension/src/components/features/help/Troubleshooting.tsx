import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../ui/primitives/accordion';
import { troubleshootingData } from '@/constants/troubleshootingData';

interface TroubleshootingProps {
    onBack: () => void;
}

export const Troubleshooting: React.FC<TroubleshootingProps> = ({ onBack }) => {
    return (
        <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] max-[480px]:p-4">
                <div className="flex items-center gap-4">
                    <button
                        className="flex items-center justify-center w-9 h-9 shrink-0 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg text-[var(--text-secondary)] cursor-pointer transition-all duration-200 hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] hover:border-[var(--glass-border-hover)]"
                        onClick={onBack}
                        aria-label="Go back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1">
                        <h1 className="m-0 text-2xl font-semibold text-[var(--text-primary)] max-[480px]:text-xl">Troubleshooting Guide</h1>
                        <p className="mt-1 mb-0 text-sm text-[var(--text-secondary)] leading-normal">
                            Common issues and solutions to help you get back on track
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 max-[480px]:p-4 scrollbar-thin scrollbar-track-[var(--glass-bg)] scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
                <Accordion type="single">
                    {troubleshootingData.map((item) => (
                        <AccordionItem key={item.id} value={item.id}>
                            <AccordionTrigger>{item.issue}</AccordionTrigger>
                            <AccordionContent>
                                <div className="mt-4 first:mt-0">
                                    <h3 className="m-0 mb-2 text-[13px] font-semibold text-[var(--color-primary)] uppercase tracking-wide">
                                        Possible Causes:
                                    </h3>
                                    <ul className="m-0 pl-5 list-outside">
                                        {item.causes.map((cause, idx) => (
                                            <li key={`${item.id}-cause-${idx}`} className="mb-2 pl-1 leading-relaxed text-[var(--text-secondary)] last:mb-0">{cause}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="mt-4 first:mt-0">
                                    <h3 className="m-0 mb-2 text-[13px] font-semibold text-[var(--color-primary)] uppercase tracking-wide">
                                        Solutions:
                                    </h3>
                                    <ol className="m-0 pl-5 list-outside list-decimal marker:text-[var(--color-primary)] marker:font-semibold">
                                        {item.solutions.map((solution, idx) => (
                                            <li key={`${item.id}-solution-${idx}`} className="mb-2 pl-1 leading-relaxed text-[var(--text-secondary)] last:mb-0">{solution}</li>
                                        ))}
                                    </ol>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </div>
    );
};
