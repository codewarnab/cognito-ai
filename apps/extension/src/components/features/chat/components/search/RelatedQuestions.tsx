/**
 * Related Questions Component
 * Displays AI-generated follow-up question suggestions
 */

import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export interface RelatedQuestion {
    /** The follow-up question text */
    query: string;
    /** Optional unique identifier */
    id?: string;
}

export interface RelatedQuestionsProps {
    /** Array of related questions */
    questions: RelatedQuestion[];
    /** Callback when a question is selected */
    onSelect: (query: string) => void;
    /** Whether questions are loading */
    isLoading?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/** Skeleton widths for loading state */
const SKELETON_WIDTHS = [85, 70, 90];

/**
 * Displays AI-generated follow-up questions.
 * Compact list format optimized for sidepanel width.
 */
export const RelatedQuestions: React.FC<RelatedQuestionsProps> = ({
    questions,
    onSelect,
    isLoading = false,
    className,
}) => {
    if (questions.length === 0 && !isLoading) return null;

    const containerClasses = ['mt-4 pt-3 border-t border-[var(--border-color)]', className].filter(Boolean).join(' ');

    if (isLoading) {
        return (
            <div className={containerClasses}>
                <div className="flex items-center gap-1.5 mb-2 text-xs text-[var(--text-secondary)]">
                    <Sparkles size={12} />
                    <span>Related</span>
                </div>
                <div className="flex flex-col gap-2">
                    {SKELETON_WIDTHS.map((width, i) => (
                        <div
                            key={i}
                            className="h-6 rounded bg-white/5 animate-pulse"
                            style={{ width: `${width}%` }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    const validQuestions = questions
        .filter((q) => q.query && q.query.trim().length > 0)
        .slice(0, 3);

    if (validQuestions.length === 0) return null;

    const handleKeyDown = (e: React.KeyboardEvent, query: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(query);
        }
    };

    return (
        <div className={containerClasses}>
            <div className="flex items-center gap-1.5 mb-2 text-xs text-[var(--text-secondary)]">
                <Sparkles size={12} />
                <span>Related</span>
            </div>

            <div className="flex flex-col gap-1">
                {validQuestions.map((question, index) => (
                    <button
                        key={question.id || index}
                        type="button"
                        onClick={() => onSelect(question.query)}
                        onKeyDown={(e) => handleKeyDown(e, question.query)}
                        aria-label={`Ask: ${question.query}`}
                        className="w-full flex items-start gap-2 p-2 text-left text-sm text-[var(--text-secondary)] bg-transparent border-none rounded-lg cursor-pointer transition-all duration-150 hover:bg-white/5 hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 group"
                    >
                        <ArrowRight size={14} className="shrink-0 mt-0.5 text-[var(--text-tertiary)] transition-colors duration-150 group-hover:text-blue-500" />
                        <span className="line-clamp-2">{question.query}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default RelatedQuestions;
