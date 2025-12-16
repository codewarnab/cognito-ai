/**
 * ElevenLabs Dynamic Variables Builder
 * Builds dynamic variables for ElevenLabs session based on enabled tools
 */

import { createLogger } from '~logger';
import { getEnabledTools } from './settings';

const log = createLogger('ElevenLabs-DynamicVars', 'VOICE_CLIENT');

interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters?: string;
}

// Complete tool definitions with categories and parameters
const TOOL_DEFINITIONS: ToolDefinition[] = [
  // Navigation
  {
    id: 'navigateTo',
    name: 'navigateTo',
    category: 'Navigation Tools',
    description: 'Navigate to any URL',
    parameters: 'url (required), newTab (optional)',
  },
  {
    id: 'switchTabs',
    name: 'switchTabs',
    category: 'Navigation Tools',
    description: 'Switch to a different browser tab',
    parameters: 'pattern (required)',
  },
  {
    id: 'getActiveTab',
    name: 'getActiveTab',
    category: 'Navigation Tools',
    description: 'Get information about the currently active tab',
  },

  // Content Extraction
  {
    id: 'readPageContent',
    name: 'readPageContent',
    category: 'Content Extraction Tools',
    description: 'Read and extract text content from the current page',
  },
  {
    id: 'takeScreenshot',
    name: 'takeScreenshot',
    category: 'Content Extraction Tools',
    description: 'Capture a screenshot of the current page',
  },
  {
    id: 'getSelectedText',
    name: 'getSelectedText',
    category: 'Content Extraction Tools',
    description: 'Get the text currently selected/highlighted by the user',
  },
  {
    id: 'getSearchResults',
    name: 'getSearchResults',
    category: 'Content Extraction Tools',
    description: 'Parse search engine results from Google/Bing',
    parameters: 'maxResults (optional, default 10)',
  },


  // Interaction
  {
    id: 'clickByText',
    name: 'clickByText',
    category: 'Interaction Tools',
    description: 'Click any visible text element (buttons, links, headings)',
    parameters: 'text (required), elementType (optional: button/link/any)',
  },
  {
    id: 'typeInField',
    name: 'typeInField',
    category: 'Interaction Tools',
    description: 'Type text into an input field',
    parameters: 'text (required), target (required), clearFirst (optional), pressEnter (optional)',
  },
  {
    id: 'pressKey',
    name: 'pressKey',
    category: 'Interaction Tools',
    description: 'Press a keyboard key',
    parameters: 'key (required - e.g., Enter, Tab, Escape, ArrowDown)',
  },
  {
    id: 'scrollPage',
    name: 'scrollPage',
    category: 'Interaction Tools',
    description: 'Scroll the page',
    parameters: 'direction (required: up/down/top/bottom), amount (optional pixels)',
  },

  // Tab Management
  {
    id: 'applyTabGroups',
    name: 'applyTabGroups',
    category: 'Tab Management Tools',
    description: 'Organize tabs into colored groups',
  },
  {
    id: 'ungroupTabs',
    name: 'ungroupTabs',
    category: 'Tab Management Tools',
    description: 'Remove tabs from their groups',
  },

  // History (tools removed - consolidated in search.tsx)

  // Reminders
  {
    id: 'createReminder',
    name: 'createReminder',
    category: 'Reminder Tools',
    description: 'Create a reminder',
    parameters: 'message (required), triggerTime or triggerUrl',
  },
  {
    id: 'listReminders',
    name: 'listReminders',
    category: 'Reminder Tools',
    description: 'List all active reminders',
  },
  {
    id: 'cancelReminder',
    name: 'cancelReminder',
    category: 'Reminder Tools',
    description: 'Cancel a reminder',
    parameters: 'reminderId (required)',
  },

  // YouTube
  {
    id: 'getYouTubeTranscript',
    name: 'getYouTubeTranscript',
    category: 'YouTube Tools',
    description: 'Fetch and analyze YouTube video transcripts',
    parameters: 'youtubeUrl (optional - uses active tab if on YouTube)',
  },
];

/**
 * Build the capabilities section markdown based on enabled tools
 */
export function buildCapabilitiesSection(enabledToolIds: string[]): string {
  const enabledTools = TOOL_DEFINITIONS.filter((t) => enabledToolIds.includes(t.id));

  if (enabledTools.length === 0) {
    return 'No tools are currently enabled. You cannot perform any browser actions.';
  }

  // Group by category
  const byCategory = new Map<string, ToolDefinition[]>();
  for (const tool of enabledTools) {
    const existing = byCategory.get(tool.category) || [];
    existing.push(tool);
    byCategory.set(tool.category, existing);
  }

  // Build markdown
  const sections: string[] = [];
  for (const [category, tools] of byCategory) {
    sections.push(`### ${category}`);
    for (const tool of tools) {
      let line = `- **${tool.name}** - ${tool.description}`;
      if (tool.parameters) {
        line += `. Parameters: ${tool.parameters}`;
      }
      sections.push(line);
    }
    sections.push(''); // blank line between categories
  }

  return sections.join('\n').trim();
}

/**
 * Build the disabled tools section
 */
export function buildDisabledToolsSection(enabledToolIds: string[]): string {
  const allIds = TOOL_DEFINITIONS.map((t) => t.id);
  const disabledIds = allIds.filter((id) => !enabledToolIds.includes(id));

  if (disabledIds.length === 0) {
    return 'All tools are enabled.';
  }

  const disabledTools = TOOL_DEFINITIONS.filter((t) => disabledIds.includes(t.id));
  return disabledTools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
}

/**
 * Build all dynamic variables for ElevenLabs session
 */
export async function buildDynamicVariables(): Promise<Record<string, string>> {
  try {
    const enabledToolIds = await getEnabledTools();

    const variables = {
      capabilities_section: buildCapabilitiesSection(enabledToolIds),
      disabled_tools_section: buildDisabledToolsSection(enabledToolIds),
    };

    log.info('Built dynamic variables', {
      enabledCount: enabledToolIds.length,
      capabilitiesLength: variables.capabilities_section.length,
    });

    return variables;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to build dynamic variables', { error: errorMessage });

    // Return safe defaults
    return {
      capabilities_section: 'Error loading capabilities. Please try again.',
      disabled_tools_section: '',
    };
  }
}
