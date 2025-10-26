import React from 'react';
import logoImage from '../../../assets/logo.png';

export const EmptyState: React.FC = () => {
    return (
        <div className="copilot-empty-state">
            <div className="copilot-empty-icon" style={{ marginTop: '60px', marginBottom: '0px' }}>
                <img 
                    src={logoImage} 
                    alt="Cognito" 
                    width={120} 
                    height={120}
                    style={{ objectFit: 'contain' }}
                />
            </div>
            <p>👋 Hi! I'm your autonomous AI assistant.</p>
            <p className="copilot-empty-subtitle">
                I can browse, click, fill forms, manage tabs, and execute tasks end-to-end. Just tell me what you need!
            </p>
        </div>
    );
};
