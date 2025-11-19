import { useState, useEffect } from 'react';
import { createLogger } from '@logger';
import { getBehavioralPreferences } from '../memory/store';

const log = createLogger('useBehavioralPreferences');

/**
 * Hook to load and refresh behavioral preferences from memory store
 */
export function useBehavioralPreferences() {
    const [behavioralPreferences, setBehavioralPreferences] = useState<Record<string, unknown>>({});

    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const prefs = await getBehavioralPreferences();
                setBehavioralPreferences(prefs);
            } catch (error) {
                log.error("Failed to load behavioral preferences", error);
            }
        };

        loadPreferences();

        // Refresh every 5 minutes
        const interval = setInterval(loadPreferences, 300000);
        return () => clearInterval(interval);
    }, []);

    return behavioralPreferences;
}
