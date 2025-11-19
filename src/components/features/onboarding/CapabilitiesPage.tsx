import React from 'react';
import researchImage from '@assets/images/research.png';

export const CapabilitiesPage: React.FC = () => {
    return (
        <div className="onboarding-page-content onboarding-page-content--capabilities">
            <div className="onboarding-text">
                <h1 className="onboarding-title">AI-Powered Research & Reports</h1>
                <p className="onboarding-subtitle">
                    Generate comprehensive insights on any topic, delivered as downloadable PDFs and Markdown files
                </p>
            </div>

            <div className="onboarding-image-container">
                <img
                    src={researchImage}
                    alt="AI-Powered Research & Reports Demo"
                    className="onboarding-image"
                />
            </div>
        </div>
    );
};
