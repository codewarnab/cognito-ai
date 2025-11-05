import React from 'react';
import logoImage from '../../../../../assets/logo.png';

interface EmptyStateProps {
    isLocalMode?: boolean;
    onConfigureApiKey?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ isLocalMode, onConfigureApiKey }) => {
    return (
        <div className="copilot-empty-state">
            <div className="copilot-empty-icon" style={{ marginTop: '30px', marginBottom: '16px' }}>
                <img
                    src={logoImage}
                    alt="Cognito"
                    width={100}
                    height={100}
                    style={{ objectFit: 'contain' }}
                />
            </div>
            <p>👋 Hi! I'm your autonomous AI assistant.</p>
            <p className="copilot-empty-subtitle">
                I can browse, click, fill forms, manage tabs, and execute tasks end-to-end. Just tell me what you need!
            </p>
            {isLocalMode && onConfigureApiKey && (
                <div style={{
                    marginTop: '20px',
                    padding: '12px 16px',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '6px',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255, 152, 0, 0.08)',
                    border: '1px solid rgba(255, 152, 0, 0.2)',
                    borderRadius: '8px',
                    maxWidth: '400px',
                    margin: '20px auto 0',
                }}>
                    <span style={{ fontSize: '14px' }}>⚠️</span>
                    <span>Local mode has limited functionality.</span>
                    <button
                        onClick={onConfigureApiKey}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#4a6fa5',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: '0',
                            fontSize: 'inherit',
                            fontWeight: 500,
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#5a7fb5';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#4a6fa5';
                        }}
                    >
                        Configure
                    </button>
                    <span>for better performance.</span>
                </div>
            )}
        </div>
    );
};
