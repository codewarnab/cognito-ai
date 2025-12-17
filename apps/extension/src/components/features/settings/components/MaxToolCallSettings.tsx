import React, { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { createLogger } from '~logger';
import { getMaxToolCallLimit, setMaxToolCallLimit } from '@/utils/settings';

const log = createLogger('MaxToolCallSettings', 'UI_SETTINGS');

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
        <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center mb-1">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 uppercase tracking-wide">
                    <Settings size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    AI Configuration
                </h2>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-visible">
                <div className="flex flex-col items-start gap-4 p-3">
                    <div>
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Maximum Tool Call Limit</div>
                        <div className="text-xs text-[var(--text-secondary)]">
                            Maximum number of steps the AI can take in a single response (1-50). Higher values allow more complex multi-step operations but may increase response time.
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            className="w-20 px-3 py-2 text-sm border border-[var(--border-color)] rounded-md bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-center focus:outline-none focus:border-[var(--color-secondary)]"
                            value={maxLimit}
                            onChange={handleLimitChange}
                            min={1}
                            max={50}
                        />
                        <span className="text-sm text-[var(--text-secondary)] min-w-[60px]">
                            {maxLimit} steps
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

