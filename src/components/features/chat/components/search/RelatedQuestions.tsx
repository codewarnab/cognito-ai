/**
 * Related Questions Component
 * Displays AI-generated follow-up question suggestions
 */

import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import '@/styles/features/search/related-questions.css';

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

    const containerClasses = ['related-questions', className].filter(Boolean).join(' ');

    if (isLoading) {
        return (
            <div className={containerClasses}>
                <div className="related-questions__header">
                    <Sparkles size={12} />
                    <span>Related</span>
                </div>
                <div className="related-questions__skeleton">
                    {SKELETON_WIDTHS.map((width, i) => (
                        <div
                            key={i}
                            className="related-questions__skeleton-item"
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
            <div className="related-questions__header">
                <Sparkles size={12} />
                <span>Related</span>
            </div>
            
            <div className="related-questions__list">
                {validQuestions.map((question, index) => (
                    <button
                        key={question.id || index}
                        type="button"
                        onClick={() => onSelect(question.query)}
                        onKeyDown={(e) => handleKeyDown(e, question.query)}
                        aria-label={`Ask: ${question.query}`}
                        className="related-questions__item"
                    >
                        <ArrowRight size={14} className="related-questions__icon" />
                        <span className="related-questions__text">{question.query}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default RelatedQuestions;
