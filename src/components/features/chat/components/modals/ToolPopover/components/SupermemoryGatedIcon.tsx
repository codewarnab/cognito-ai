import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Supermemory } from '@assets/brands/integrations/Supermemory';

interface SupermemoryGatedIconProps {
    showTooltip: boolean;
    onToggleTooltip: (show: boolean) => void;
}

export const SupermemoryGatedIcon: React.FC<SupermemoryGatedIconProps> = ({
    showTooltip,
    onToggleTooltip,
}) => (
    <div style={{ position: 'relative' }}>
        <div
            style={{ display: 'inline-flex', cursor: 'pointer' }}
            onClick={(e) => {
                e.stopPropagation();
                onToggleTooltip(!showTooltip);
            }}
            onMouseEnter={() => onToggleTooltip(true)}
            onMouseLeave={() => onToggleTooltip(false)}
        >
            <AlertCircle
                size={12}
                style={{ color: 'var(--text-warning)' }}
            />
        </div>
        {showTooltip && (
            <div
                style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: '8px',
                    padding: '10px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    zIndex: 100,
                    width: '180px',
                    textAlign: 'center'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '6px',
                    gap: '4px'
                }}>
                    <Supermemory />
                    <span style={{ fontWeight: 600, fontSize: '11px' }}>Supermemory</span>
                </div>
                <p style={{
                    fontSize: '10px',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: '1.4'
                }}>
                    Configure API key in Settings to enable
                </p>
            </div>
        )}
    </div>
);
