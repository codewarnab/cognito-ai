import React from 'react';
import integrationsImage from '@assets/images/intregations.png';

export const GetStartedPage: React.FC = () => {
    return (
        <div className="onboarding-page-content onboarding-page-content--get-started">
            <div className="onboarding-text">
                <h1 className="onboarding-title">Connect to 15+ Platforms</h1>
                <p className="onboarding-subtitle">
                    Seamlessly integrate with your favorite tools and services, with more platforms coming soon
                </p>
            </div>

            <div className="onboarding-image-container">
                <img
                    src={integrationsImage}
                    alt="Connect to 15+ Platforms"
                    className="onboarding-image"
                />
            </div>
        </div>
    );
};
