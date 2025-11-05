/**
 * VoiceModeDebugPanel - Debug panel for tool integration testing
 */

import React from 'react';

interface VoiceModeDebugPanelProps {
    debugReport: string;
    onRunTest: () => void;
}

export const VoiceModeDebugPanel: React.FC<VoiceModeDebugPanelProps> = ({
    debugReport,
    onRunTest
}) => {
    return (
        <div style={{
            position: 'absolute',
            top: '70px',
            right: '20px',
            width: '420px',
            maxHeight: '520px',
            background: 'rgba(15, 20, 35, 0.95)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '16px',
            padding: '20px',
            color: 'white',
            fontSize: '12px',
            fontFamily: 'ui-monospace, monospace',
            overflow: 'auto',
            zIndex: 1000,
            backdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
        }}>
            <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '15px',
                fontWeight: '600',
                color: 'rgba(216, 180, 254, 0.95)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <span>🔧</span>
                <span>Tool Integration Test</span>
            </h3>
            <button
                onClick={onRunTest}
                style={{
                    width: '100%',
                    padding: '12px',
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(139, 92, 246, 0.25) 100%)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    borderRadius: '10px',
                    color: 'white',
                    cursor: 'pointer',
                    marginBottom: '16px',
                    fontWeight: '500',
                    fontSize: '13px',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(139, 92, 246, 0.35) 100%)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.3)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(139, 92, 246, 0.25) 100%)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                }}
            >
                Run Test
            </button>
            {debugReport && (
                <pre style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontSize: '11px',
                    lineHeight: '1.6',
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.9)',
                    maxHeight: '350px',
                    overflow: 'auto'
                }}>
                    {debugReport}
                </pre>
            )}
        </div>
    );
};
