import React from 'react';
import agentImage from '@assets/images/agent.png';

export const FeaturesPage: React.FC = () => {
    return (
        <div className="onboarding-page-content onboarding-page-content--features">
            <div className="onboarding-text">
                <h1 className="onboarding-title">One Prompt, Endless Possibilities</h1>
                <p className="onboarding-subtitle">
                    Execute unlimited browser tasks with natural language - automate workflows, set reminders, save memories, and interact with any website
                </p>
            </div>

            <div className="onboarding-image-container">
                <img
                    src={agentImage}
                    alt="Agentic demo"
                    className="onboarding-image"
                />
            </div>
        </div>
    );
};
