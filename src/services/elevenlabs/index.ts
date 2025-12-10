/**
 * ElevenLabs Service Layer
 * Exports all ElevenLabs-related services
 */

// API Service
export {
  getSignedUrl,
  getAvailableVoices,
  checkWorkerHealth,
  type SignedUrlResponse,
  type ElevenLabsVoice,
  type VoicesResponse,
  type HealthResponse,
} from './api';

// Settings Storage
export {
  getSelectedVoiceId,
  setSelectedVoiceId,
  getEnabledTools,
  setEnabledTools,
  getVoiceSettings,
  setVoiceSettings,
  ALL_TOOLS,
  type ToolInfo,
  type VoiceSettings,
} from './settings';

// Dynamic Variables
export {
  buildCapabilitiesSection,
  buildDisabledToolsSection,
  buildDynamicVariables,
} from './dynamicVariables';

// Client Tools
export { buildClientTools, logRegisteredTools } from './clientTools';
