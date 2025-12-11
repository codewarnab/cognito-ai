import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createLogger } from '~logger';
import { DEFAULT_ENABLED_TOOLS } from '@/ai/tools/enabledTools';
import { getEnabledToolsOverride, setEnabledToolsOverride, getToolsMode, setToolsMode } from '@/utils/settings';
import { TOOL_CATEGORIES, SUPERMEMORY_TOOLS, WORKFLOW_ONLY_TOOLS, WEB_SEARCH_ONLY_TOOLS } from '@/constants/toolDescriptions';
import { isSupermemoryReady } from '@/utils/supermemory';
import { useWebMCPTools } from '@/hooks/webmcp';
import { CHAT_MODE_TOOLS, AGENT_MODE_TOOLS, TOOL_WARNING_THRESHOLD } from './constants';
import type { ToolMode, McpToolWithServer } from './types';

const log = createLogger('ToolsPopover');

export function useToolsPopover(isOpen: boolean, onClose: () => void) {
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
    const lastDiscoveredDomainRef = useRef<string | null>(null);
    const hasLoadedToolsRef = useRef(false);

    const {
        tools: webmcpTools,
        isLoading: webmcpLoading,
        disabledTools: webmcpDisabledTools,
        toggleTool: toggleWebMCPTool,
        enabledCount: enabledWebMCPCount,
        refresh: refreshWebMCPTools,
        discover: discoverWebMCPTools,
        currentDomain: webmcpCurrentDomain,
    } = useWebMCPTools();

    const allTools = useMemo(() =>
        DEFAULT_ENABLED_TOOLS.filter(t =>
            !WORKFLOW_ONLY_TOOLS.includes(t) && !WEB_SEARCH_ONLY_TOOLS.includes(t)
        ),
        []);

    const getToolsMatchingMode = useCallback((toolMap: Record<string, boolean>): ToolMode | null => {
        const enabledList = Object.entries(toolMap).filter(([, v]) => v).map(([k]) => k);
        const chatSet = new Set(CHAT_MODE_TOOLS);
        const isChatMode = enabledList.length === CHAT_MODE_TOOLS.length &&
            enabledList.every(t => chatSet.has(t));
        if (isChatMode) return 'chat';

        const agentSet = new Set(AGENT_MODE_TOOLS);
        const isAgentMode = enabledList.length === AGENT_MODE_TOOLS.length &&
            enabledList.every(t => agentSet.has(t));
        if (isAgentMode) return 'agent';

        return null;
    }, []);


    const handleModeChange = useCallback(async (mode: ToolMode) => {
        if (mode === 'custom') return;

        let toolsToEnable: string[] = [];
        if (mode === 'chat') {
            toolsToEnable = [...CHAT_MODE_TOOLS];
        } else if (mode === 'agent') {
            toolsToEnable = [...AGENT_MODE_TOOLS];
        }

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
            voiceFab.style.visibility = isOpen ? 'hidden' : '';
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

    const loadMcpTools = async () => {
        setMcpLoading(true);
        try {
            const response = await chrome.runtime.sendMessage({ type: 'mcp/tools/list' });
            if (response?.success && response.data?.tools) {
                setMcpTools(response.data.tools);

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

            if (override && Array.isArray(override)) {
                const set = new Set(override);
                allTools.forEach(t => {
                    initialMap[t] = set.has(t);
                });
                setEnabledMap(initialMap);

                if (savedMode && savedMode !== 'custom') {
                    setCurrentMode(savedMode);
                    setHasUserModified(false);
                } else if (savedMode === 'custom') {
                    setHasUserModified(true);
                } else {
                    const detectedMode = getToolsMatchingMode(initialMap);
                    if (detectedMode) {
                        setCurrentMode(detectedMode);
                        setHasUserModified(false);
                    } else {
                        setHasUserModified(true);
                    }
                }
            } else {
                const modeToUse = savedMode || 'agent';
                let toolsToEnable: string[] = [];

                if (modeToUse === 'chat') {
                    toolsToEnable = [...CHAT_MODE_TOOLS];
                } else {
                    toolsToEnable = [...AGENT_MODE_TOOLS];
                }

                if (!supermemoryConfigured) {
                    toolsToEnable = toolsToEnable.filter(t => !SUPERMEMORY_TOOLS.includes(t));
                }

                allTools.forEach(t => {
                    initialMap[t] = toolsToEnable.includes(t);
                });
                setEnabledMap(initialMap);
                setCurrentMode(modeToUse === 'custom' ? 'agent' : modeToUse);
                setHasUserModified(modeToUse === 'custom');
            }
        } catch (err) {
            log.error('Failed to load enabled tools', err);
        }
    };

    // Load tools only once when modal opens, not on every dependency change
    useEffect(() => {
        if (isOpen && !hasLoadedToolsRef.current) {
            hasLoadedToolsRef.current = true;
            loadTools();
            checkSupermemory();
            loadMcpTools();
        }
        
        if (!isOpen) {
            // Reset the flag when modal closes so tools reload on next open
            hasLoadedToolsRef.current = false;
        }
    }, [isOpen]);

    // Separate effect for WebMCP discovery to avoid re-triggering loadTools
    useEffect(() => {
        if (!isOpen) return;
        
        refreshWebMCPTools();

        const checkAndDiscoverWebMCP = async () => {
            try {
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!activeTab?.url) return;

                const currentTabDomain = new URL(activeTab.url).hostname;

                if (webmcpCurrentDomain === currentTabDomain && webmcpTools.length > 0) {
                    log.debug('WebMCP tools already loaded for current domain', { domain: currentTabDomain });
                    return;
                }

                if (lastDiscoveredDomainRef.current === currentTabDomain) {
                    log.debug('Already attempted discovery for this domain', { domain: currentTabDomain });
                    return;
                }

                log.info('Triggering WebMCP discovery for new domain', { domain: currentTabDomain });
                lastDiscoveredDomainRef.current = currentTabDomain;
                await discoverWebMCPTools();
            } catch (err) {
                log.debug('Failed to check/discover WebMCP tools', err);
            }
        };

        checkAndDiscoverWebMCP();
    }, [isOpen, refreshWebMCPTools, discoverWebMCPTools, webmcpCurrentDomain, webmcpTools.length]);


    const handleToggleTool = async (tool: string, checked: boolean) => {
        if (checked && SUPERMEMORY_TOOLS.includes(tool) && !supermemoryConfigured) {
            setShowSupermemoryTooltip(tool);
            return;
        }

        const newMap = { ...enabledMap, [tool]: checked };
        setEnabledMap(newMap);

        const enabledList = Object.entries(newMap).filter(([, v]) => v).map(([k]) => k);
        const matchedMode = getToolsMatchingMode(newMap);

        if (matchedMode) {
            setCurrentMode(matchedMode);
            setHasUserModified(false);
        } else {
            setHasUserModified(true);
        }

        try {
            await setEnabledToolsOverride(enabledList);
            await setToolsMode(matchedMode || 'custom');
        } catch (err) {
            log.error('Failed to save tool config', err);
        }
    };

    const handleToggleCategory = async (e: React.MouseEvent, _category: string, tools: string[]) => {
        e.stopPropagation();
        const allEnabled = tools.every(t => enabledMap[t] === true);
        const newState = !allEnabled;

        const toolsToUpdate = newState && !supermemoryConfigured
            ? tools.filter(t => !SUPERMEMORY_TOOLS.includes(t))
            : tools;

        if (toolsToUpdate.length === 0) {
            setShowSupermemoryTooltip(tools[0] || null);
            return;
        }

        const newMap = { ...enabledMap };
        toolsToUpdate.forEach(t => {
            newMap[t] = newState;
        });
        setEnabledMap(newMap);

        const enabledList = Object.entries(newMap).filter(([, v]) => v).map(([k]) => k);
        const matchedMode = getToolsMatchingMode(newMap);

        if (matchedMode) {
            setCurrentMode(matchedMode);
            setHasUserModified(false);
        } else {
            setHasUserModified(true);
        }

        try {
            await setEnabledToolsOverride(enabledList);
            await setToolsMode(matchedMode || 'custom');
        } catch (err) {
            log.error('Failed to save tool category config', err);
        }
    };

    const handleToggleMcpTool = async (serverId: string, toolName: string, checked: boolean) => {
        const currentDisabled = mcpDisabledTools[serverId] || [];
        const newDisabled = checked
            ? currentDisabled.filter(t => t !== toolName)
            : [...currentDisabled, toolName];

        setMcpDisabledTools(prev => ({
            ...prev,
            [serverId]: newDisabled
        }));

        try {
            await chrome.runtime.sendMessage({
                type: `mcp/${serverId}/tools/config/set`,
                payload: { disabledTools: newDisabled }
            });
        } catch (err) {
            log.error('Failed to save MCP tool config', err);
        }
    };

    const handleToggleMcpCategory = async (e: React.MouseEvent, serverId: string, serverTools: McpToolWithServer[]) => {
        e.stopPropagation();
        const currentDisabled = mcpDisabledTools[serverId] || [];
        const enabledCount = serverTools.filter(t => !currentDisabled.includes(t.name)).length;
        const allEnabled = enabledCount === serverTools.length;

        const newDisabled = allEnabled ? serverTools.map(t => t.name) : [];

        setMcpDisabledTools(prev => ({
            ...prev,
            [serverId]: newDisabled
        }));

        try {
            await chrome.runtime.sendMessage({
                type: `mcp/${serverId}/tools/config/set`,
                payload: { disabledTools: newDisabled }
            });
        } catch (err) {
            log.error('Failed to save MCP tool config', err);
        }
    };

    const handleToggleWebMcpCategoryAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        const allEnabled = enabledWebMCPCount === webmcpTools.length;
        const newState = !allEnabled;

        webmcpTools.forEach(tool => {
            const isCurrentlyEnabled = !webmcpDisabledTools.includes(tool.name);
            if (isCurrentlyEnabled !== newState) {
                toggleWebMCPTool(tool.name, newState);
            }
        });
    };

    const filteredTools = useMemo(() => {
        if (!toolSearchQuery) return allTools;
        return allTools.filter(t => t.toLowerCase().includes(toolSearchQuery.toLowerCase()));
    }, [allTools, toolSearchQuery]);

    const filteredMcpTools = useMemo(() => {
        if (!toolSearchQuery) return mcpTools;
        return mcpTools.filter(t => t.name.toLowerCase().includes(toolSearchQuery.toLowerCase()));
    }, [mcpTools, toolSearchQuery]);

    const mcpServerGroups = useMemo(() => {
        const groups: Record<string, { name: string; tools: McpToolWithServer[] }> = {};
        filteredMcpTools.forEach(tool => {
            if (!groups[tool.serverId]) {
                groups[tool.serverId] = { name: tool.serverName, tools: [] };
            }
            groups[tool.serverId]!.tools.push(tool);
        });
        return groups;
    }, [filteredMcpTools]);

    const filteredWebMCPTools = useMemo(() => {
        if (!toolSearchQuery) return webmcpTools;
        const query = toolSearchQuery.toLowerCase();
        return webmcpTools.filter(t =>
            t.originalName.toLowerCase().includes(query) ||
            t.name.toLowerCase().includes(query) ||
            t.description?.toLowerCase().includes(query)
        );
    }, [webmcpTools, toolSearchQuery]);

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

    const enabledExtensionCount = Object.values(enabledMap).filter(v => v).length;

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

    const totalEnabledCount = enabledExtensionCount + enabledMcpCount + enabledWebMCPCount;
    const totalToolCount = allTools.length + mcpTools.length + webmcpTools.length;
    const isTooManyTools = totalEnabledCount > TOOL_WARNING_THRESHOLD;
    const displayMode: ToolMode = hasUserModified ? 'custom' : currentMode;

    return {
        popoverRef,
        enabledMap,
        toolSearchQuery,
        setToolSearchQuery,
        expandedCategories,
        showInfoTooltip,
        setShowInfoTooltip,
        supermemoryConfigured,
        showSupermemoryTooltip,
        setShowSupermemoryTooltip,
        displayMode,
        hasUserModified,
        mcpTools,
        mcpDisabledTools,
        mcpLoading,
        webmcpTools,
        webmcpLoading,
        webmcpDisabledTools,
        toggleWebMCPTool,
        enabledWebMCPCount,
        filteredTools,
        filteredMcpTools,
        filteredWebMCPTools,
        groupedTools,
        mcpServerGroups,
        enabledExtensionCount,
        enabledMcpCount,
        totalEnabledCount,
        totalToolCount,
        isTooManyTools,
        handleModeChange,
        handleToggleTool,
        handleToggleCategory,
        handleToggleMcpTool,
        handleToggleMcpCategory,
        handleToggleWebMcpCategoryAll,
        toggleCategory,
    };
}
