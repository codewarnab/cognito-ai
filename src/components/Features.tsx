import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { examplePrompts } from './data';
import './Features.css';

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
        <div className="features-container">
            {/* Header */}
            <div className="features-header">
                <div className="features-header-content">
                    <button
                        className="features-back-button"
                        onClick={onBack}
                        aria-label="Go back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="features-header-text">
                        <h1 className="features-title">
                            Example Prompts
                        </h1>
                        {/* <p className="features-subtitle">
                            Try these prompts to see what Cognito can do for you
                        </p> */}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="features-content">
                {examplePrompts.map((category) => {
                    const IconComponent = category.icon;
                    return (
                        <div key={category.id} className="features-category">
                            <h2 className="features-category-title">
                                <IconComponent size={20} className="features-category-icon" />
                                {category.category}
                            </h2>
                            <div className="features-prompts-grid">
                                {category.prompts.map((prompt, idx) => (
                                    <button
                                        key={idx}
                                        className="features-prompt-card"
                                        onClick={() => handlePromptClick(prompt)}
                                    >
                                        <span className="features-prompt-text">{prompt}</span>
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
