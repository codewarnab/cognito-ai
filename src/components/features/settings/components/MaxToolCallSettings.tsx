import React, { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { createLogger } from '~logger';
import { getMaxToolCallLimit, setMaxToolCallLimit } from '@/utils/settings';

const log = createLogger('MaxToolCallSettings');

export const MaxToolCallSettings: React.FC = () => {
    const [maxLimit, setMaxLimit] = useState(20);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const limit = await getMaxToolCallLimit();
                setMaxLimit(limit);
            } catch (err) {
                log.error('Failed to load max tool call limit', err);
            }
        };
        loadSettings();
    }, []);

    const handleLimitChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (isNaN(value)) return;

        // Enforce min/max bounds
        const clampedValue = Math.max(1, Math.min(50, value));

        const previousLimit = maxLimit;
        setMaxLimit(clampedValue);

        try {
            await setMaxToolCallLimit(clampedValue);
            log.info('Max tool call limit updated', { limit: clampedValue });
        } catch (err) {
            log.error('Failed to save max tool call limit', err);
            setMaxLimit(previousLimit);
        }
    };

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2 className="settings-section-title">
                    <Settings size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    AI Configuration
                </h2>
            </div>
            <div className="settings-card">
                <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <div>
                        <div className="settings-item-title">Maximum Tool Call Limit</div>
                        <div className="settings-item-description">
                            Maximum number of steps the AI can take in a single response (1-50). Higher values allow more complex multi-step operations but may increase response time.
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                            type="text"
                            className="settings-input"
                            value={maxLimit}
                            onChange={handleLimitChange}
                            min={1}
                            max={50}
                            style={{
                                width: '80px',
                                padding: '8px 12px',
                                fontSize: '14px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                backgroundColor: 'var(--input-bg)',
                                color: 'var(--text-primary)',
                                textAlign: 'center',
                            }}
                        />
                        <span style={{
                            fontSize: '14px',
                            color: 'var(--text-secondary)',
                            minWidth: '60px',
                        }}>
                            {maxLimit} steps
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

