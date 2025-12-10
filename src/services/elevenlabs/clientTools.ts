/**
 * ElevenLabs Client Tools Handler
 * Maps ElevenLabs tool calls to internal browser tools
 *
 * ⚠️ CRITICAL: Tool names are case-sensitive and must EXACTLY match
 * the tool names configured in the ElevenLabs dashboard.
 */

import { createLogger } from '~logger';
import { getAllTools } from '@/ai/tools/registryUtils';
import { getEnabledTools } from './settings';

const log = createLogger('ElevenLabs-ClientTools');

/**
 * Internal tool result type - used internally before serialization
 * ElevenLabs expects tools to return string | number | void
 */
interface InternalToolResult {
  success: boolean;
  message?: string;
  error?: string;
  disabled?: boolean;
  [key: string]: unknown;
}

/**
 * ElevenLabs client tool return type
 * Must be string | number | void as per ElevenLabs SDK types
 */
type ElevenLabsToolReturn = string | number | void;

/**
 * Serialize a tool result to string for ElevenLabs
 * ElevenLabs expects string | number | void returns, not objects
 */
function serializeToolResult(result: InternalToolResult): string {
  // Return the message if available, otherwise JSON stringify the result
  if (result.message) {
    return result.message;
  }
  return JSON.stringify(result);
}

/**
 * Mapping from ElevenLabs tool names to internal tool names
 * This handles cases where our internal tool names differ
 */
const TOOL_NAME_MAP: Record<string, string> = {
  // ElevenLabs name -> Internal tool name
  scrollPage: 'scrollTo', // Our internal tool is named scrollTo
  // Add more mappings if needed
};

/**
 * Get the internal tool name for an ElevenLabs tool
 */
function getInternalToolName(elevenLabsName: string): string {
  return TOOL_NAME_MAP[elevenLabsName] || elevenLabsName;
}

/**
 * Execute a browser tool by name
 * Returns the result to be passed back to ElevenLabs conversation context
 */
async function executeToolByName(
  toolName: string,
  params: Record<string, unknown>
): Promise<InternalToolResult> {
  const internalName = getInternalToolName(toolName);

  try {
    const allTools = getAllTools();
    const tool = allTools[internalName];

    if (!tool) {
      log.error(`Tool not found: ${toolName} (internal: ${internalName})`);
      return {
        success: false,
        error: `Tool "${toolName}" not found`,
        message: `I couldn't find the ${toolName} tool. It may not be available.`,
      };
    }

    log.info(`Executing tool: ${toolName}`, { params, internalName });
    const result = await tool.execute(params);
    log.info(`Tool executed successfully: ${toolName}`, {
      resultType: typeof result,
      hasError: result?.error,
    });

    // Ensure we return a structured response for ElevenLabs
    if (typeof result === 'string') {
      return { success: true, message: result };
    }
    return { success: true, ...result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Tool execution failed: ${toolName}`, { error: errorMessage });
    return {
      success: false,
      error: errorMessage,
      message: `Failed to execute ${toolName}: ${errorMessage}`,
    };
  }
}

/**
 * Check if a tool is enabled in user settings
 */
async function isToolEnabled(toolName: string): Promise<boolean> {
  try {
    const enabledTools = await getEnabledTools();
    return enabledTools.includes(toolName);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to check if tool is enabled', { toolName, error: errorMessage });
    return false;
  }
}

/**
 * Create response for when a tool is disabled
 * This message will be spoken back to the user
 */
function createDisabledResponse(toolName: string): InternalToolResult {
  return {
    success: false,
    disabled: true,
    message:
      `The ${toolName} capability is currently disabled in your voice mode settings. ` +
      `You can enable it by clicking the settings icon in voice mode.`,
  };
}

/**
 * Build client tools object for ElevenLabs useConversation hook
 *
 * ⚠️ CRITICAL: Function names here MUST EXACTLY MATCH the tool names in ElevenLabs dashboard
 * ⚠️ CRITICAL: Parameter names MUST EXACTLY MATCH the parameter identifiers in dashboard
 *
 * From ElevenLabs docs: "The tool and parameter names in the agent configuration
 * are case-sensitive and must match those registered in your code."
 *
 * Note: ElevenLabs expects tools to return string | number | void, so we serialize results
 */
export function buildClientTools(): Record<
  string,
  (params: Record<string, unknown>) => Promise<ElevenLabsToolReturn>
> {
  return {
    /**
     * Navigate to a URL
     * Dashboard params: url (string, required), newTab (boolean, optional)
     */
    navigateTo: async (params: Record<string, unknown>) => {
      log.debug('navigateTo called', params);
      if (!(await isToolEnabled('navigateTo'))) {
        return serializeToolResult(createDisabledResponse('navigateTo'));
      }
      return serializeToolResult(await executeToolByName('navigateTo', params));
    },

    /**
     * Click on visible text
     * Dashboard params: text (string, required), elementType (string, optional)
     */
    clickByText: async (params: Record<string, unknown>) => {
      log.debug('clickByText called', params);
      if (!(await isToolEnabled('clickByText'))) {
        return serializeToolResult(createDisabledResponse('clickByText'));
      }
      return serializeToolResult(await executeToolByName('clickByText', params));
    },

    /**
     * Type into an input field
     * Dashboard params: text (string, required), target (string, required),
     *                   clearFirst (boolean, optional), pressEnter (boolean, optional)
     */
    typeInField: async (params: Record<string, unknown>) => {
      log.debug('typeInField called', params);
      if (!(await isToolEnabled('typeInField'))) {
        return serializeToolResult(createDisabledResponse('typeInField'));
      }
      return serializeToolResult(await executeToolByName('typeInField', params));
    },

    /**
     * Press a keyboard key
     * Dashboard params: key (string, required)
     */
    pressKey: async (params: Record<string, unknown>) => {
      log.debug('pressKey called', params);
      if (!(await isToolEnabled('pressKey'))) {
        return serializeToolResult(createDisabledResponse('pressKey'));
      }
      return serializeToolResult(await executeToolByName('pressKey', params));
    },

    /**
     * Scroll the page
     * Dashboard params: direction (string, required), amount (number, optional)
     * Note: Maps to internal 'scrollTo' tool
     */
    scrollPage: async (params: Record<string, unknown>) => {
      log.debug('scrollPage called', params);
      if (!(await isToolEnabled('scrollPage'))) {
        return serializeToolResult(createDisabledResponse('scrollPage'));
      }
      return serializeToolResult(await executeToolByName('scrollPage', params));
    },

    /**
     * Read page content
     * Dashboard params: none
     */
    readPageContent: async (params: Record<string, unknown> = {}) => {
      log.debug('readPageContent called', params);
      if (!(await isToolEnabled('readPageContent'))) {
        return serializeToolResult(createDisabledResponse('readPageContent'));
      }
      return serializeToolResult(await executeToolByName('readPageContent', params));
    },

    /**
     * Take a screenshot
     * Dashboard params: none
     */
    takeScreenshot: async (params: Record<string, unknown> = {}) => {
      log.debug('takeScreenshot called', params);
      if (!(await isToolEnabled('takeScreenshot'))) {
        return serializeToolResult(createDisabledResponse('takeScreenshot'));
      }
      return serializeToolResult(await executeToolByName('takeScreenshot', params));
    },

    /**
     * Get active tab info
     * Dashboard params: none
     */
    getActiveTab: async (params: Record<string, unknown> = {}) => {
      log.debug('getActiveTab called', params);
      if (!(await isToolEnabled('getActiveTab'))) {
        return serializeToolResult(createDisabledResponse('getActiveTab'));
      }
      return serializeToolResult(await executeToolByName('getActiveTab', params));
    },

    /**
     * Switch to a different tab
     * Dashboard params: pattern (string, required)
     */
    switchTabs: async (params: Record<string, unknown>) => {
      log.debug('switchTabs called', params);
      if (!(await isToolEnabled('switchTabs'))) {
        return serializeToolResult(createDisabledResponse('switchTabs'));
      }
      return serializeToolResult(await executeToolByName('switchTabs', params));
    },

    /**
     * Get search results from current page
     * Dashboard params: maxResults (number, optional)
     */
    getSearchResults: async (params: Record<string, unknown> = {}) => {
      log.debug('getSearchResults called', params);
      if (!(await isToolEnabled('getSearchResults'))) {
        return serializeToolResult(createDisabledResponse('getSearchResults'));
      }
      return serializeToolResult(await executeToolByName('getSearchResults', params));
    },

    /**
     * Get YouTube video transcript
     * Dashboard params: youtubeUrl (string, optional)
     */
    getYouTubeTranscript: async (params: Record<string, unknown> = {}) => {
      log.debug('getYouTubeTranscript called', params);
      if (!(await isToolEnabled('getYouTubeTranscript'))) {
        return serializeToolResult(createDisabledResponse('getYouTubeTranscript'));
      }
      // Use YouTube utility functions directly
      try {
        const { fetchTranscript, extractVideoId, getVideoDescription, formatDuration } =
          await import('@/ai/agents/youtube');

        const youtubeUrl = params.youtubeUrl as string | undefined;
        const includeDescription = (params.includeDescription as boolean) ?? true;

        // Get current tab URL if no URL provided
        let url = youtubeUrl;
        if (!url) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          url = tab?.url;
        }

        if (!url) {
          return serializeToolResult({
            success: false,
            error: 'No YouTube URL provided',
            message: 'Please provide a YouTube URL or navigate to a YouTube video.',
          });
        }

        const videoId = extractVideoId(url);
        if (!videoId) {
          return serializeToolResult({
            success: false,
            error: 'Invalid YouTube URL',
            message: 'The URL does not appear to be a valid YouTube video URL.',
          });
        }

        // Fetch transcript and metadata
        const [transcriptData, description] = await Promise.all([
          fetchTranscript(url),
          includeDescription ? getVideoDescription(url) : Promise.resolve(undefined),
        ]);

        if (!transcriptData) {
          return serializeToolResult({
            success: false,
            message: 'No transcript available for this video.',
          });
        }

        const durationFormatted = transcriptData.durationSeconds
          ? formatDuration(transcriptData.durationSeconds)
          : undefined;

        return serializeToolResult({
          success: true,
          message: `Found transcript for "${transcriptData.title || 'video'}"${durationFormatted ? ` (${durationFormatted})` : ''}. ${description ? `Description available.` : ''}`,
          title: transcriptData.title,
          author: transcriptData.author,
          transcript: transcriptData.transcript,
          duration: durationFormatted,
          description: description,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error('getYouTubeTranscript failed', { error: errorMessage });
        return serializeToolResult({
          success: false,
          error: errorMessage,
          message:
            'I was unable to fetch the YouTube transcript. Make sure you are on a YouTube video page.',
        });
      }
    },

    /**
     * Search browsing history
     * Dashboard params: query (string, required), maxResults (number, optional)
     */
    searchHistory: async (params: Record<string, unknown>) => {
      log.debug('searchHistory called', params);
      if (!(await isToolEnabled('searchHistory'))) {
        return serializeToolResult(createDisabledResponse('searchHistory'));
      }
      return serializeToolResult(await executeToolByName('searchHistory', params));
    },

    /**
     * Create a reminder
     * Dashboard params: message (string, required), triggerTime (string, optional), triggerUrl (string, optional)
     */
    createReminder: async (params: Record<string, unknown>) => {
      log.debug('createReminder called', params);
      if (!(await isToolEnabled('createReminder'))) {
        return serializeToolResult(createDisabledResponse('createReminder'));
      }
      return serializeToolResult(await executeToolByName('createReminder', params));
    },

    /**
     * List all reminders
     * Dashboard params: none
     */
    listReminders: async (params: Record<string, unknown> = {}) => {
      log.debug('listReminders called', params);
      if (!(await isToolEnabled('listReminders'))) {
        return serializeToolResult(createDisabledResponse('listReminders'));
      }
      return serializeToolResult(await executeToolByName('listReminders', params));
    },

    /**
     * Cancel a reminder
     * Dashboard params: reminderId (string, required)
     */
    cancelReminder: async (params: Record<string, unknown>) => {
      log.debug('cancelReminder called', params);
      if (!(await isToolEnabled('cancelReminder'))) {
        return serializeToolResult(createDisabledResponse('cancelReminder'));
      }
      return serializeToolResult(await executeToolByName('cancelReminder', params));
    },

    /**
     * Apply tab groups
     * Dashboard params: none (uses AI-determined grouping)
     */
    applyTabGroups: async (params: Record<string, unknown> = {}) => {
      log.debug('applyTabGroups called', params);
      if (!(await isToolEnabled('applyTabGroups'))) {
        return serializeToolResult(createDisabledResponse('applyTabGroups'));
      }
      return serializeToolResult(await executeToolByName('applyTabGroups', params));
    },
  };
}

/**
 * Debugging helper: Log all registered client tools
 */
export function logRegisteredTools(): void {
  const tools = buildClientTools();
  log.info('Registered ElevenLabs client tools:', Object.keys(tools));
}
