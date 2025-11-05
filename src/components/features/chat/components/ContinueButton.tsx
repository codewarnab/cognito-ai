import React from 'react';

interface ContinueButtonProps {
    onContinue: () => void;
    isLoading?: boolean;
}

/**
 * Compact continue button shown when AI stops due to tool call limit
 * Similar styling to tool call UI elements
 */
export const ContinueButton: React.FC<ContinueButtonProps> = ({ onContinue, isLoading }) => {
    return (
        <div className="continue-button-container">
            <button
                className="continue-button"
                onClick={onContinue}
                disabled={isLoading}
                title="Continue iterating"
            >
                <span className="continue-button-text">Continue</span>
            </button>
        </div>
    );
};
