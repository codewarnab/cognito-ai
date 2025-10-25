import React from 'react';
import agentImage from '../../../assets/agent.png';

export const FeaturesPage: React.FC = () => {
    return (
        <div className="onboarding-page-content" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            paddingTop: '0rem'
        }}>
            <div className="onboarding-text" style={{
                marginBottom: '0'
            }}>
                <h1 className="onboarding-title" style={{
                    marginBottom: '0.5rem',
                    fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
                    whiteSpace: 'nowrap',
                    overflow: 'visible'
                }}>One Prompt, Endless Possibilities</h1>
                <p className="onboarding-subtitle" style={{
                    marginBottom: '0.5rem',
                    fontSize: '0.85rem',
                    lineHeight: '1.3'
                }}>
                    Execute unlimited browser tasks with natural language - automate workflows, set reminders, save memories, and interact with any website
                </p>
            </div>

            <div className="onboarding-image-container" style={{
                marginTop: '0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                flex: 1,
                overflow: 'hidden'
            }}>
                <img
                    src={agentImage}
                    alt="Agentic demo "
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                    }}
                />
            </div>
        </div>
    );
};
