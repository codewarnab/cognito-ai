/**
 * Settings Handlers Index
 *
 * Barrel file for all settings handlers
 */

import { SEARCH_SETTINGS_MESSAGE_TYPES } from './searchSettingsHandler';
import { ASK_AI_SETTINGS_MESSAGE_TYPES } from './askAISettingsHandler';
import { TEXT_SETTINGS_MESSAGE_TYPES } from './textSettingsHandler';
import { SUPERMEMORY_SETTINGS_MESSAGE_TYPES } from './supermemorySettingsHandler';
import { RESEARCH_SETTINGS_MESSAGE_TYPES } from './researchSettingsHandler';
import { VOICE_SETTINGS_MESSAGE_TYPES } from './voiceSettingsHandler';
import { AI_CONFIG_MESSAGE_TYPES } from './aiConfigHandler';

export {
    handleSearchSettingsMessage,
    SEARCH_SETTINGS_MESSAGE_TYPES,
} from './searchSettingsHandler';

export {
    handleAskAISettingsMessage,
    ASK_AI_SETTINGS_MESSAGE_TYPES,
} from './askAISettingsHandler';

export {
    handleTextSettingsMessage,
    TEXT_SETTINGS_MESSAGE_TYPES,
} from './textSettingsHandler';

export {
    handleSupermemorySettingsMessage,
    SUPERMEMORY_SETTINGS_MESSAGE_TYPES,
} from './supermemorySettingsHandler';

export {
    handleResearchSettingsMessage,
    RESEARCH_SETTINGS_MESSAGE_TYPES,
} from './researchSettingsHandler';

export {
    handleVoiceSettingsMessage,
    VOICE_SETTINGS_MESSAGE_TYPES,
} from './voiceSettingsHandler';

export {
    handleAIConfigMessage,
    AI_CONFIG_MESSAGE_TYPES,
} from './aiConfigHandler';

/**
 * All settings-related message types
 */
export const ALL_SETTINGS_MESSAGE_TYPES = [
    ...SEARCH_SETTINGS_MESSAGE_TYPES,
    ...ASK_AI_SETTINGS_MESSAGE_TYPES,
    ...TEXT_SETTINGS_MESSAGE_TYPES,
    ...SUPERMEMORY_SETTINGS_MESSAGE_TYPES,
    ...RESEARCH_SETTINGS_MESSAGE_TYPES,
    ...VOICE_SETTINGS_MESSAGE_TYPES,
    ...AI_CONFIG_MESSAGE_TYPES,
] as const;
