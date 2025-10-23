/**
 * ToolIconMapper - Maps tool names to their corresponding animated icons
 * Provides centralized icon mapping for all registered tools
 * 
 * Features:
 * - MCP tool support: Automatically maps MCP tools to their server icons
 * - Local tool mapping: Maps built-in browser automation tools
 * - Fallback hierarchy: MCP server icon → local tool icon → ChromeIcon
 */

import React from 'react';
import { CursorClickIcon } from '../../../assets/chat/click';
import { CompassIcon } from '../../../assets/chat/navigate-to';
import { HardDriveDownloadIcon } from '../../../assets/chat/save-memory';
import { SearchIcon } from '../../../assets/chat/search';
import { KeyboardIcon } from '../../../assets/chat/keyboard-type';
import { ArrowBigDownDashIcon } from '../../../assets/chat/scroll';
import { LinkIcon } from '../../../assets/chat/link';
import { GalleryHorizontalEndIcon } from '../../../assets/chat/switchh';
import { ChromeIcon } from '../../../assets/chat/chrome';
import { FoldersIcon } from '../../../assets/chat/folder';
import { HardDriveUploadIcon } from '../../../assets/chat/retrieve-memory';
import { DeleteIcon } from '../../../assets/chat/delete-memory';
import { WaypointsIcon } from '../../../assets/chat/suggest-memery';
import { HistoryIcon } from '../../../assets/chat/history';
import { YoutubeIcon } from '../../../assets/chat/youtube';
import { CircleCheckIcon } from '../../../assets/chat/circle-check';
import { PlusIcon } from '../../../assets/chat/new-tab';
import { ClockIcon } from '../../../assets/chat/wait-for';
import { BanIcon } from '../../../assets/chat/blocked';
import { ExpandIcon } from '../../../assets/chat/expand';
import { ScanTextIcon } from '../../../assets/chat/reading-page-content';
import { isMcpTool } from '../../utils/toolMetadataStore';
import { createLogger } from '../../logger';
import { Wrench } from 'lucide-react';
import { forwardRef, useImperativeHandle } from 'react';

const log = createLogger('ToolIconMapper');

// Wrench icon wrapper component for MCP tools with animation support
export interface WrenchIconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

const WrenchIcon = forwardRef<WrenchIconHandle, { size?: number; className?: string }>(
    ({ size = 16, className }, ref) => {
        // Expose dummy animation methods to match icon interface
        useImperativeHandle(ref, () => ({
            startAnimation: () => {
                // Wrench icon doesn't have animation, but we need this for compatibility
            },
            stopAnimation: () => {
                // Wrench icon doesn't have animation, but we need this for compatibility
            },
        }));

        return <Wrench size={size} className={className} />;
    }
);

WrenchIcon.displayName = 'WrenchIcon';

export const TOOL_ICON_MAP: Record<string, React.ComponentType<any>> = {
    // Interaction tools
    clickElement: CursorClickIcon,
    clickByText: CursorClickIcon,
    focusElement: CursorClickIcon,
    typeInField: KeyboardIcon,
    pressKey: KeyboardIcon,
    scroll: ArrowBigDownDashIcon,
    search: SearchIcon,
    chromeSearch: SearchIcon,
    getSearchResults: SearchIcon,
    openSearchResult: LinkIcon,
    extractText: ExpandIcon,
    scrollIntoView: ArrowBigDownDashIcon,
    findSearchBar: SearchIcon,
    waitFor: ClockIcon,
    readPageContent: ScanTextIcon,
    getSelectedText: ExpandIcon,    // Tab tools
    navigateTo: CompassIcon,
    switchTabs: GalleryHorizontalEndIcon,
    getActiveTab: ChromeIcon,
    applyTabGroups: FoldersIcon,
    organizeTabsByContext: FoldersIcon,
    ungroupTabs: FoldersIcon,
    listTabs: FoldersIcon,
    closeTab: BanIcon,
    openTab: PlusIcon,

    // Memory tools
    saveMemory: HardDriveDownloadIcon,
    getMemory: HardDriveUploadIcon,
    deleteMemory: DeleteIcon,
    listMemories: FoldersIcon,
    suggestSaveMemory: WaypointsIcon,

    // History tools
    getRecentHistory: HistoryIcon,
    getUrlVisits: HistoryIcon,
    searchHistory: SearchIcon,

    // YouTube tools
    youtube: YoutubeIcon,
    youtubeSearch: YoutubeIcon,
    youtubeTranscript: YoutubeIcon,
    getYoutubeTranscript: YoutubeIcon,
    youtubeAgentAsTool: YoutubeIcon,
    analyzeYouTubeVideo: YoutubeIcon,  // YouTube agent tool

    // Reminder tools
    createReminder: CircleCheckIcon,
    cancelReminder: BanIcon,
    listReminders: FoldersIcon,

    // Analysis tools
    analyzeContent: ExpandIcon,
    extractData: ExpandIcon,

    // Task tools
    createTask: CircleCheckIcon,
    updateTask: CircleCheckIcon,
    completeTask: CircleCheckIcon,
    listTasks: FoldersIcon,
};

/**
 * Heuristic to detect if a tool name looks like an MCP tool
 * Even if it's not registered in our store
 */
function looksLikeMcpTool(toolName: string): boolean {
    const lower = toolName.toLowerCase();

    // Check for known MCP server names in the tool name
    const mcpServerHints = [
        'notion', 'linear', 'github', 'figma', 'supabase',
        'netlify', 'sentry', 'paypal', 'webflow', 'ahrefs',
        'context7', 'deepwiki', 'coingecko', 'fetch', 'sequential',
        'edgeone', 'parallel', 'mcp'
    ];

    // If tool name contains any MCP server hint
    if (mcpServerHints.some(hint => lower.includes(hint))) {
        return true;
    }

    // If tool name has multiple underscores (typical MCP naming pattern)
    if ((toolName.match(/_/g) || []).length >= 2) {
        return true;
    }

    return false;
}

/**
 * Get the icon component for a given tool name
 * First checks if it's an MCP tool and uses server icon
 * Falls back to local tool mapping, then ChromeIcon
 */
export function getToolIcon(toolName: string): React.ComponentType<any> {
    log.debug(`🔍 Looking up icon for tool: "${toolName}"`);

    // Check if this is a registered MCP tool
    const isMcp = isMcpTool(toolName);
    log.debug(`  → Is registered MCP tool: ${isMcp}`);

    if (isMcp) {
        // All MCP tools should show the wrench icon
        log.debug(`  → 🔧 MCP tool detected, using Wrench icon`);
        return WrenchIcon;
    }

    // Check local tool mapping
    if (TOOL_ICON_MAP[toolName]) {
        log.debug(`  → ✅ Resolved to local tool icon`);
        return TOOL_ICON_MAP[toolName];
    }

    // Heuristic check: Does it LOOK like an MCP tool even if not registered?
    if (looksLikeMcpTool(toolName)) {
        log.debug(`  → 🔧 Looks like MCP tool (heuristic), using Wrench icon`);
        return WrenchIcon;
    }

    // Final fallback
    log.debug(`  → ⚠️ No icon found, using ChromeIcon fallback`);
    return ChromeIcon;
}
