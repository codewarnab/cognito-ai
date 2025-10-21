/**
 * ToolIconMapper - Maps tool names to their corresponding animated icons
 * Provides centralized icon mapping for all registered tools
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
import { ScanTextIcon } from '../../../assets/chat/reading-page-content'
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
 * Get the icon component for a given tool name
 * Falls back to ChromeIcon if no specific mapping exists
 */
export function getToolIcon(toolName: string): React.ComponentType<any> {
    return TOOL_ICON_MAP[toolName] || ChromeIcon;
}
