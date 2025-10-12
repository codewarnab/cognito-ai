/**
 * Alarm management for periodic scheduling
 */

const ALARM_NAME = 'bg:schedule';
const ALARM_PERIOD_MINUTES = 1;

/**
 * Ensure alarms are created
 */
export async function ensureAlarms(): Promise<void> {
    const existing = await chrome.alarms.get(ALARM_NAME);

    if (!existing) {
        await chrome.alarms.create(ALARM_NAME, {
            periodInMinutes: ALARM_PERIOD_MINUTES,
        });
        console.log('[Alarms] Created:', ALARM_NAME);
    }
}

/**
 * Get scheduler alarm name
 */
export function getSchedulerAlarmName(): string {
    return ALARM_NAME;
}
