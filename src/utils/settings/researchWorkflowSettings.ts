/**
 * Research Workflow Settings
 * Settings storage for the research workflow configuration
 */
import { createLogger } from '~logger';

const log = createLogger('ResearchWorkflowSettings', 'STORAGE');

export const RESEARCH_WORKFLOW_STORAGE_KEY = 'researchWorkflowSettings';

export interface ResearchWorkflowSettings {
    /** Minimum number of sources to visit before completing research */
    minimumSources: number;
    /** Maximum number of steps allowed for research */
    stepCount: number;
}

export const DEFAULT_RESEARCH_WORKFLOW_SETTINGS: ResearchWorkflowSettings = {
    minimumSources: 5,
    stepCount: 30,
};

/**
 * Get the current research workflow settings from storage
 */
export async function getResearchWorkflowSettings(): Promise<ResearchWorkflowSettings> {
    try {
        const result = await chrome.storage.local.get(RESEARCH_WORKFLOW_STORAGE_KEY);
        return { ...DEFAULT_RESEARCH_WORKFLOW_SETTINGS, ...(result[RESEARCH_WORKFLOW_STORAGE_KEY] || {}) };
    } catch (error) {
        log.error('Failed to get settings:', error);
        return DEFAULT_RESEARCH_WORKFLOW_SETTINGS;
    }
}

/**
 * Save research workflow settings to storage
 */
export async function saveResearchWorkflowSettings(settings: ResearchWorkflowSettings): Promise<void> {
    try {
        await chrome.storage.local.set({ [RESEARCH_WORKFLOW_STORAGE_KEY]: settings });
        log.info('Settings saved', { minimumSources: settings.minimumSources, stepCount: settings.stepCount });
    } catch (error) {
        log.error('Failed to save settings:', error);
        throw error;
    }
}

/**
 * Get the minimum sources setting
 */
export async function getMinimumSources(): Promise<number> {
    const settings = await getResearchWorkflowSettings();
    return settings.minimumSources;
}

/**
 * Get the step count setting
 */
export async function getStepCount(): Promise<number> {
    const settings = await getResearchWorkflowSettings();
    return settings.stepCount;
}

/**
 * Update a specific research workflow setting
 */
export async function updateResearchWorkflowSetting<K extends keyof ResearchWorkflowSettings>(
    key: K,
    value: ResearchWorkflowSettings[K]
): Promise<ResearchWorkflowSettings> {
    const current = await getResearchWorkflowSettings();
    const updated = { ...current, [key]: value };
    await saveResearchWorkflowSettings(updated);
    return updated;
}
