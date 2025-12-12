import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { examplePrompts } from '@/constants/featuresData';

interface FeaturesProps {
    onBack: () => void;
    onPromptClick?: (prompt: string) => void;
}

export const Features: React.FC<FeaturesProps> = ({ onBack, onPromptClick }) => {
    const handlePromptClick = (prompt: string) => {
        if (onPromptClick) {
            onPromptClick(prompt);
            onBack(); // Close the features page after selecting a prompt
        }
    };

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
                        <h1 className="m-0 text-2xl font-semibold text-[var(--text-primary)] flex items-center gap-2 max-[480px]:text-xl">
                            Example Prompts
                        </h1>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 max-[480px]:p-4 scrollbar-thin scrollbar-track-[var(--glass-bg)] scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
                {(examplePrompts ?? []).map((category) => {
                    const IconComponent = category.icon;
                    return (
                        <div key={category.id} className="mb-8 last:mb-0">
                            <h2 className="m-0 mb-4 text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 max-[480px]:text-base">
                                <IconComponent size={20} className="text-[var(--text-secondary)] shrink-0" />
                                {category.category}
                            </h2>
                            <div className="grid gap-3 grid-cols-1 min-[768px]:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
                                {category.prompts.map((prompt) => (
                                    <button
                                        key={prompt}
                                        className="relative p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg cursor-pointer transition-all duration-200 text-left flex items-center gap-3 hover:bg-[var(--glass-bg-hover)] hover:border-[var(--glass-border-hover)] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] active:translate-y-0 group"
                                        onClick={() => handlePromptClick(prompt)}
                                    >
                                        <span className="flex-1 text-sm leading-relaxed text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">{prompt}</span>
                                        <span className="absolute right-4 opacity-0 transition-all duration-200 text-[var(--text-secondary)] text-xl font-semibold group-hover:opacity-100 group-hover:right-3">→</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

