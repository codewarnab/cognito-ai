import React from 'react';
import { MeshGradientSVG } from '../../MeshGradientSVG';

export const WelcomePage: React.FC = () => {
    return (
        <div className="onboarding-page-content">
            <div className="onboarding-text">
                <h1 className="onboarding-title">Welcome to Cognito</h1>
                <p className="onboarding-subtitle">
                    Your autonomous AI browser agent that navigates, clicks, fills forms, and executes tasks end-to-end
                </p>
            </div>

            <div className="onboarding-logo">
                <MeshGradientSVG size={280} />
            </div>
        </div>
    );
};
