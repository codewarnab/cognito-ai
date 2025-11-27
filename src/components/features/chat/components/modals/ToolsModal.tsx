import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Search, ChevronDown, ChevronRight, Info, AlertCircle, MessageSquare, Bot, AlertTriangle, Server } from 'lucide-react';
import { createLogger } from '~logger';
import { DEFAULT_ENABLED_TOOLS, TOOLS_DISABLED_BY_DEFAULT } from '@/ai/tools/enabledTools';
import { getEnabledToolsOverride, setEnabledToolsOverride, getToolsMode, setToolsMode } from '@/utils/settings';
import { Toggle } from '@/components/shared/inputs/Toggle';
import { TOOL_CATEGORIES, SUPERMEMORY_TOOLS, WORKFLOW_ONLY_TOOLS } from '@/constants/toolDescriptions';
import { isSupermemoryReady } from '@/utils/supermemory';
import { Supermemory } from '@assets/brands/integrations/Supermemory';
import { motion, AnimatePresence } from 'framer-motion';
import type { ToolsMode } from '@/types/settings';
import type { McpTool } from '@/mcp/types';

const log = createLogger('ToolsPopover');

// Tool count warning threshold
const TOOL_WARNING_THRESHOLD = 40;

// MCP Tool with server metadata
interface McpToolWithServer extends McpTool {
    serverId: string;
    serverName: string;
}

// Re-export ToolsMode type for internal use
type ToolMode = ToolsMode;

// Chat mode: minimal tools for simple Q&A, reading, and basic navigation
const CHAT_MODE_TOOLS: string[] = [
    'readPageContent',
    'takeScreenshot',
    'getActiveTab',
    'getAllTabs',
    'switchTabs',
    'searchHistory',
    'getYouTubeTranscript',
];

// Agent mode: full browser automation capabilities
const AGENT_MODE_TOOLS: string[] = [
    // Navigation & Tab Management
    'navigateTo',
    'switchTabs',
    'getActiveTab',
    'getAllTabs',
    'applyTabGroups',
    'ungroupTabs',
    'organizeTabsByContext',
    // Content Reading & Extraction
    'takeScreenshot',
    'readPageContent',
    'extractText',
    'findSearchBar',
    'analyzeDom',
    // Interaction Tools
    'typeInField',
    'clickByText',
    'pressKey',
    'focusElement',
    'scrollTo',
    'executeScript',
    // Search Functionality
    'chromeSearch',
    'getSearchResults',
    'openSearchResult',
    // History
    'searchHistory',
    'getUrlVisits',
    // Reminders
    'createReminder',
    'listReminders',
    'cancelReminder',
    // Agent Tools
    'getYouTubeTranscript',
    // Note: generatePDF and getReportTemplate are workflow-only tools
    // They are automatically enabled during the Research workflow
];

interface ToolsPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    onCountChange?: (extensionCount: number, mcpCount: number) => void;
}

export const ToolsModal: React.FC<ToolsPopoverProps> = ({ isOpen, onClose, onCountChange }) => {
    const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
    const [toolSearchQuery, setToolSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [showInfoTooltip, setShowInfoTooltip] = useState(false);
    const [supermemoryConfigured, setSupermemoryConfigured] = useState(false);
    const [showSupermemoryTooltip, setShowSupermemoryTooltip] = useState<string | null>(null);
    const [currentMode, setCurrentMode] = useState<ToolMode>('agent');
    const [hasUserModified, setHasUserModified] = useState(false);
    const [mcpTools, setMcpTools] = useState<McpToolWithServer[]>([]);
    const [mcpDisabledTools, setMcpDisabledTools] = useState<Record<string, string[]>>({});
    const [mcpLoading, setMcpLoading] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    // Filter out workflow-only tools from display
    const allTools = useMemo(() =>
        DEFAULT_ENABLED_TOOLS.filter(t => !WORKFLOW_ONLY_TOOLS.includes(t)),
        []);

    // Helper to check if current tools match a preset
    const getToolsMatchingMode = useCallback((toolMap: Record<string, boolean>): ToolMode | null => {
        const enabledList = Object.entries(toolMap).filter(([, v]) => v).map(([k]) => k);

        // Check Chat mode
        const chatSet = new Set(CHAT_MODE_TOOLS);
        const isChatMode = enabledList.length === CHAT_MODE_TOOLS.length &&
            enabledList.every(t => chatSet.has(t));
        if (isChatMode) return 'chat';

        // Check Agent mode
        const agentSet = new Set(AGENT_MODE_TOOLS);
        const isAgentMode = enabledList.length === AGENT_MODE_TOOLS.length &&
            enabledList.every(t => agentSet.has(t));
        if (isAgentMode) return 'agent';

        return null;
    }, []);

    // Handle mode selection
    const handleModeChange = useCallback(async (mode: ToolMode) => {
        if (mode === 'custom') return; // Custom mode is auto-selected, not manually

        let toolsToEnable: string[] = [];
        if (mode === 'chat') {
            toolsToEnable = [...CHAT_MODE_TOOLS];
        } else if (mode === 'agent') {
            toolsToEnable = [...AGENT_MODE_TOOLS];
        }

        // Filter out Supermemory tools if not configured
        if (!supermemoryConfigured) {
            toolsToEnable = toolsToEnable.filter(t => !SUPERMEMORY_TOOLS.includes(t));
        }

        const newMap: Record<string, boolean> = {};
        allTools.forEach(t => {
            newMap[t] = toolsToEnable.includes(t);
        });

        setEnabledMap(newMap);
        setCurrentMode(mode);
        setHasUserModified(false);

        // Save to storage - both tools and mode
        await setEnabledToolsOverride(toolsToEnable);
        await setToolsMode(mode);

        log.info('Mode changed', { mode, toolCount: toolsToEnable.length });
    }, [allTools, supermemoryConfigured]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        // Delay to prevent immediate close
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    // Hide voice FAB when popover is open
    useEffect(() => {
        const voiceFab = document.querySelector('.voice-mode-fab') as HTMLElement;
        if (voiceFab) {
            if (isOpen) {
                voiceFab.style.visibility = 'hidden';
            } else {
                voiceFab.style.visibility = '';
            }
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            loadTools();
            checkSupermemory();
            loadMcpTools();
        }
    }, [isOpen]);

    const checkSupermemory = async () => {
        try {
            const ready = await isSupermemoryReady();
            setSupermemoryConfigured(ready);
        } catch (err) {
            log.error('Failed to check Supermemory status', err);
            setSupermemoryConfigured(false);
        }
    };

    // Load MCP tools from all connected servers
    const loadMcpTools = async () => {
        setMcpLoading(true);
        try {
            const response = await chrome.runtime.sendMessage({ type: 'mcp/tools/list' });
            if (response?.success && response.data?.tools) {
                setMcpTools(response.data.tools);

                // Load disabled tools config for each unique server
                const serverIds = [...new Set(response.data.tools.map((t: McpToolWithServer) => t.serverId))];
                const disabledByServer: Record<string, string[]> = {};

                for (const serverId of serverIds) {
                    try {
                        const configResponse = await chrome.runtime.sendMessage({
                            type: `mcp/${serverId}/tools/config/get`
                        });
                        if (configResponse?.success && Array.isArray(configResponse.data)) {
                            disabledByServer[serverId as string] = configResponse.data;
                        }
                    } catch (err) {
                        log.error(`Failed to load disabled tools for server ${serverId}`, err);
                    }
                }
                setMcpDisabledTools(disabledByServer);
            }
        } catch (err) {
            log.error('Failed to load MCP tools', err);
        } finally {
            setMcpLoading(false);
        }
    };

    const loadTools = async () => {
        try {
            const override = await getEnabledToolsOverride();
            const savedMode = await getToolsMode();
            const initialMap: Record<string, boolean> = {};
            const disabledByDefaultSet = new Set(TOOLS_DISABLED_BY_DEFAULT);

            if (override && Array.isArray(override)) {
                const set = new Set(override);
                allTools.forEach(t => {
                    initialMap[t] = set.has(t);
                });
            } else {
                allTools.forEach(t => {
                    initialMap[t] = !disabledByDefaultSet.has(t);
                });
            }
            setEnabledMap(initialMap);

            // Use saved mode, or detect from tools if not saved
            if (savedMode && savedMode !== 'custom') {
                // User has a saved mode preference
                setCurrentMode(savedMode);
                setHasUserModified(false);
            } else {
                // Detect current mode based on loaded tools
                const detectedMode = getToolsMatchingMode(initialMap);
                if (detectedMode) {
                    setCurrentMode(detectedMode);
                    setHasUserModified(false);
                } else {
                    // Tools don't match any preset - user has customized
                    setHasUserModified(true);
                }
            }
        } catch (err) {
            log.error('Failed to load enabled tools', err);
        }
    };

    const handleToggleTool = async (tool: string, checked: boolean) => {
        // Prevent enabling Supermemory tools if not configured
        if (checked && SUPERMEMORY_TOOLS.includes(tool) && !supermemoryConfigured) {
            setShowSupermemoryTooltip(tool);
            return;
        }

        setEnabledMap(prev => {
            const next = { ...prev, [tool]: checked };
            // Always save the explicit list to ensure persistence
            const enabledList = Object.entries(next).filter(([, v]) => v).map(([k]) => k);
            void setEnabledToolsOverride(enabledList);

            // Check if the new selection matches any preset
            const matchedMode = getToolsMatchingMode(next);
            if (matchedMode) {
                setCurrentMode(matchedMode);
                setHasUserModified(false);
                // Save the matched mode
                void setToolsMode(matchedMode);
            } else {
                setHasUserModified(true);
                // Save custom mode
                void setToolsMode('custom');
            }

            return next;
        });
    };

    const handleToggleCategory = (e: React.MouseEvent, _category: string, tools: string[]) => {
        e.stopPropagation();
        const allEnabled = tools.every(t => enabledMap[t] ?? true);
        const newState = !allEnabled;

        // Filter out Supermemory tools if trying to enable and not configured
        const toolsToUpdate = newState && !supermemoryConfigured
            ? tools.filter(t => !SUPERMEMORY_TOOLS.includes(t))
            : tools;

        if (toolsToUpdate.length === 0) {
            setShowSupermemoryTooltip(tools[0] || null);
            return;
        }

        setEnabledMap(prev => {
            const next = { ...prev };
            toolsToUpdate.forEach(t => {
                next[t] = newState;
            });
            // Always save the explicit list to ensure persistence
            const enabledList = Object.entries(next).filter(([, v]) => v).map(([k]) => k);
            void setEnabledToolsOverride(enabledList);

            // Check if the new selection matches any preset
            const matchedMode = getToolsMatchingMode(next);
            if (matchedMode) {
                setCurrentMode(matchedMode);
                setHasUserModified(false);
                // Save the matched mode
                void setToolsMode(matchedMode);
            } else {
                setHasUserModified(true);
                // Save custom mode
                void setToolsMode('custom');
            }

            return next;
        });
    };

    // Handle toggling MCP tools
    const handleToggleMcpTool = async (serverId: string, toolName: string, checked: boolean) => {
        const currentDisabled = mcpDisabledTools[serverId] || [];
        let newDisabled: string[];

        if (checked) {
            // Enable: remove from disabled list
            newDisabled = currentDisabled.filter(t => t !== toolName);
        } else {
            // Disable: add to disabled list
            newDisabled = [...currentDisabled, toolName];
        }

        // Update local state
        setMcpDisabledTools(prev => ({
            ...prev,
            [serverId]: newDisabled
        }));

        // Persist to background
        try {
            await chrome.runtime.sendMessage({
                type: `mcp/${serverId}/tools/config/set`,
                payload: { disabledTools: newDisabled }
            });
        } catch (err) {
            log.error('Failed to save MCP tool config', err);
        }
    };

    // Handle toggling all tools for an MCP server
    const handleToggleMcpCategory = (e: React.MouseEvent, serverId: string, serverTools: McpToolWithServer[]) => {
        e.stopPropagation();
        const currentDisabled = mcpDisabledTools[serverId] || [];
        const enabledCount = serverTools.filter(t => !currentDisabled.includes(t.name)).length;
        const allEnabled = enabledCount === serverTools.length;

        let newDisabled: string[];
        if (allEnabled) {
            // Disable all tools
            newDisabled = serverTools.map(t => t.name);
        } else {
            // Enable all tools
            newDisabled = [];
        }

        setMcpDisabledTools(prev => ({
            ...prev,
            [serverId]: newDisabled
        }));

        // Persist to background
        chrome.runtime.sendMessage({
            type: `mcp/${serverId}/tools/config/set`,
            payload: { disabledTools: newDisabled }
        }).catch(err => log.error('Failed to save MCP tool config', err));
    };

    // Filter tools based on search query
    const filteredTools = useMemo(() => {
        if (!toolSearchQuery) return allTools;
        return allTools.filter(t => t.toLowerCase().includes(toolSearchQuery.toLowerCase()));
    }, [allTools, toolSearchQuery]);

    // Filter MCP tools based on search query
    const filteredMcpTools = useMemo(() => {
        if (!toolSearchQuery) return mcpTools;
        return mcpTools.filter(t => t.name.toLowerCase().includes(toolSearchQuery.toLowerCase()));
    }, [mcpTools, toolSearchQuery]);

    // Group MCP tools by server
    const mcpServerGroups = useMemo(() => {
        const groups: Record<string, { name: string; tools: McpToolWithServer[] }> = {};

        filteredMcpTools.forEach(tool => {
            if (!groups[tool.serverId]) {
                groups[tool.serverId] = {
                    name: tool.serverName,
                    tools: []
                };
            }
            groups[tool.serverId]!.tools.push(tool);
        });

        return groups;
    }, [filteredMcpTools]);

    // Group filtered tools by category
    const groupedTools = useMemo(() => {
        const groups: Record<string, string[]> = {};

        filteredTools.forEach(tool => {
            let category = 'Other';
            for (const [cat, tools] of Object.entries(TOOL_CATEGORIES)) {
                if (tools.includes(tool)) {
                    category = cat;
                    break;
                }
            }

            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category]!.push(tool);
        });

        return groups;
    }, [filteredTools]);

    // Auto-expand categories when searching
    useEffect(() => {
        if (toolSearchQuery) {
            const newExpanded: Record<string, boolean> = {};
            Object.keys(groupedTools).forEach(category => {
                newExpanded[category] = true;
            });
            setExpandedCategories(newExpanded);
        }
    }, [toolSearchQuery, groupedTools]);

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    // Count enabled extension tools
    const enabledExtensionCount = Object.values(enabledMap).filter(v => v).length;

    // Count enabled MCP tools
    const enabledMcpCount = useMemo(() => {
        let count = 0;
        mcpTools.forEach(tool => {
            const serverDisabled = mcpDisabledTools[tool.serverId] || [];
            if (!serverDisabled.includes(tool.name)) {
                count++;
            }
        });
        return count;
    }, [mcpTools, mcpDisabledTools]);

    // Total enabled tools
    const totalEnabledCount = enabledExtensionCount + enabledMcpCount;
    const totalToolCount = allTools.length + mcpTools.length;
    const isTooManyTools = totalEnabledCount > TOOL_WARNING_THRESHOLD;

    // Notify parent of count changes (only when modal is open)
    useEffect(() => {
        if (isOpen && onCountChange) {
            onCountChange(enabledExtensionCount, enabledMcpCount);
        }
    }, [isOpen, enabledExtensionCount, enabledMcpCount, onCountChange]);

    // Determine which mode to display
    const displayMode: ToolMode = hasUserModified ? 'custom' : currentMode;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={popoverRef}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="tools-popover"
                >
                    {/* Arrow pointer */}
                    <div className="tools-popover-arrow" />

                    {/* Search */}
                    <div className="tools-popover-search">
                        <Search size={12} className="tools-popover-search-icon" />
                        <input
                            className="tools-popover-search-input"
                            value={toolSearchQuery}
                            onChange={(e) => setToolSearchQuery(e.target.value)}
                            placeholder="Search tools..."
                            autoFocus
                        />
                    </div>

                    {/* Mode Selector */}
                    <div className="tools-mode-selector">
                        <button
                            className={`tools-mode-btn ${displayMode === 'chat' ? 'active' : ''}`}
                            onClick={() => handleModeChange('chat')}
                        >
                            <MessageSquare size={12} />
                            <span>Chat</span>
                        </button>
                        <button
                            className={`tools-mode-btn ${displayMode === 'agent' ? 'active' : ''}`}
                            onClick={() => handleModeChange('agent')}
                        >
                            <Bot size={12} />
                            <span>Agent</span>
                        </button>
                        {hasUserModified && (
                            <div className="tools-mode-custom-badge">
                                Custom
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="tools-popover-content">
                        {Object.entries(groupedTools).map(([category, tools]) => {
                            const isExpanded = expandedCategories[category] ?? false;
                            const catEnabledCount = tools.filter(tool => enabledMap[tool] ?? true).length;
                            const totalCount = tools.length;
                            const allOn = catEnabledCount === totalCount;

                            return (
                                <div key={category} className="tools-popover-category">
                                    <div
                                        onClick={() => toggleCategory(category)}
                                        className="tools-popover-category-header"
                                    >
                                        <div className="tools-popover-category-left">
                                            {isExpanded ?
                                                <ChevronDown size={12} className="tools-popover-chevron" /> :
                                                <ChevronRight size={12} className="tools-popover-chevron" />
                                            }
                                            <span className="tools-popover-category-name">{category}</span>
                                            <span className={`tools-popover-category-count ${catEnabledCount < totalCount ? 'partial' : ''}`}>
                                                ({catEnabledCount}/{totalCount})
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => handleToggleCategory(e, category, tools)}
                                            className={`tools-popover-toggle-btn ${allOn ? 'all-on' : 'all-off'}`}
                                        >
                                            {allOn ? 'All on' : 'All off'}
                                        </button>
                                    </div>

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="tools-popover-tools">
                                                    {tools.map((tool) => {
                                                        const enabled = enabledMap[tool] ?? true;
                                                        const isSupermemoryTool = SUPERMEMORY_TOOLS.includes(tool);
                                                        const isGated = isSupermemoryTool && !supermemoryConfigured;
                                                        const showTooltip = showSupermemoryTooltip === tool;

                                                        return (
                                                            <div
                                                                key={tool}
                                                                className="tools-popover-tool"
                                                                style={{ opacity: isGated ? 0.7 : 1 }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <span className="tools-popover-tool-name" title={tool}>
                                                                        {tool}
                                                                    </span>
                                                                    {isGated && (
                                                                        <div style={{ position: 'relative' }}>
                                                                            <div
                                                                                style={{ display: 'inline-flex', cursor: 'pointer' }}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setShowSupermemoryTooltip(showTooltip ? null : tool);
                                                                                }}
                                                                                onMouseEnter={() => setShowSupermemoryTooltip(tool)}
                                                                                onMouseLeave={() => setShowSupermemoryTooltip(null)}
                                                                            >
                                                                                <AlertCircle
                                                                                    size={12}
                                                                                    style={{ color: 'var(--text-warning)' }}
                                                                                />
                                                                            </div>
                                                                            {showTooltip && (
                                                                                <div
                                                                                    style={{
                                                                                        position: 'absolute',
                                                                                        bottom: '100%',
                                                                                        left: '50%',
                                                                                        transform: 'translateX(-50%)',
                                                                                        marginBottom: '8px',
                                                                                        padding: '10px',
                                                                                        backgroundColor: 'var(--bg-primary)',
                                                                                        border: '1px solid var(--border-color)',
                                                                                        borderRadius: 'var(--radius-md)',
                                                                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                                                        zIndex: 100,
                                                                                        width: '180px',
                                                                                        textAlign: 'center'
                                                                                    }}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                >
                                                                                    <div style={{
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        marginBottom: '6px',
                                                                                        gap: '4px'
                                                                                    }}>
                                                                                        <Supermemory />
                                                                                        <span style={{ fontWeight: 600, fontSize: '11px' }}>Supermemory</span>
                                                                                    </div>
                                                                                    <p style={{
                                                                                        fontSize: '10px',
                                                                                        color: 'var(--text-secondary)',
                                                                                        margin: 0,
                                                                                        lineHeight: '1.4'
                                                                                    }}>
                                                                                        Configure API key in Settings to enable
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <Toggle
                                                                    checked={enabled}
                                                                    onChange={(checked) => handleToggleTool(tool, checked)}
                                                                    className="tools-popover-toggle"
                                                                    disabled={isGated && !enabled}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}

                        {Object.keys(groupedTools).length === 0 && Object.keys(mcpServerGroups).length === 0 && (
                            <div className="tools-popover-empty">
                                No tools found
                            </div>
                        )}

                        {/* MCP Server Tools */}
                        {(Object.keys(mcpServerGroups).length > 0 || mcpLoading) && (
                            <div className="tools-popover-mcp-section">
                                <div className="tools-popover-mcp-header">
                                    <Server size={12} />
                                    <span>MCP Servers</span>
                                    {mcpLoading && <span className="tools-popover-mcp-loading">Loading...</span>}
                                </div>
                                {Object.entries(mcpServerGroups).map(([serverId, { name, tools: serverTools }]) => {
                                    const isExpanded = expandedCategories[`mcp-${serverId}`] ?? false;
                                    const serverDisabled = mcpDisabledTools[serverId] || [];
                                    const catEnabledCount = serverTools.filter(t => !serverDisabled.includes(t.name)).length;
                                    const totalCount = serverTools.length;
                                    const allOn = catEnabledCount === totalCount;

                                    return (
                                        <div key={serverId} className="tools-popover-category">
                                            <div
                                                onClick={() => toggleCategory(`mcp-${serverId}`)}
                                                className="tools-popover-category-header"
                                            >
                                                <div className="tools-popover-category-left">
                                                    {isExpanded ?
                                                        <ChevronDown size={12} className="tools-popover-chevron" /> :
                                                        <ChevronRight size={12} className="tools-popover-chevron" />
                                                    }
                                                    <span className="tools-popover-category-name tools-popover-mcp-name">{name}</span>
                                                    <span className={`tools-popover-category-count ${catEnabledCount < totalCount ? 'partial' : ''}`}>
                                                        ({catEnabledCount}/{totalCount})
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={(e) => handleToggleMcpCategory(e, serverId, serverTools)}
                                                    className={`tools-popover-toggle-btn ${allOn ? 'all-on' : 'all-off'}`}
                                                >
                                                    {allOn ? 'All on' : 'All off'}
                                                </button>
                                            </div>

                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="tools-popover-tools">
                                                            {serverTools.map((tool) => {
                                                                const enabled = !serverDisabled.includes(tool.name);

                                                                return (
                                                                    <div
                                                                        key={tool.name}
                                                                        className="tools-popover-tool"
                                                                    >
                                                                        <span className="tools-popover-tool-name" title={tool.description}>
                                                                            {tool.name}
                                                                        </span>
                                                                        <Toggle
                                                                            checked={enabled}
                                                                            onChange={(checked) => handleToggleMcpTool(serverId, tool.name, checked)}
                                                                            className="tools-popover-toggle"
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className={`tools-popover-footer ${isTooManyTools ? 'tools-popover-footer--warning' : ''}`}>
                        <div className="tools-popover-footer-left">
                            {isTooManyTools && (
                                <AlertTriangle size={12} className="tools-popover-warning-icon" />
                            )}
                            <span>
                                {totalEnabledCount} of {totalToolCount} enabled
                                {mcpTools.length > 0 && (
                                    <span className="tools-popover-mcp-count"> ({enabledMcpCount} MCP)</span>
                                )}
                            </span>
                        </div>
                        {isTooManyTools && (
                            <span className="tools-popover-warning-text">Too many tools</span>
                        )}
                        <div className="tools-popover-info-wrapper">
                            <button
                                className="tools-popover-info-btn"
                                onMouseEnter={() => setShowInfoTooltip(true)}
                                onMouseLeave={() => setShowInfoTooltip(false)}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Info size={12} />
                            </button>
                            <AnimatePresence>
                                {showInfoTooltip && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 4 }}
                                        transition={{ duration: 0.15 }}
                                        className="tools-popover-tooltip"
                                    >
                                        <strong>Active Tools</strong>
                                        <p>Tools are capabilities the AI can use to help you. Fewer enabled tools = faster, more focused responses.</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
