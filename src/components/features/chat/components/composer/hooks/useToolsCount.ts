import { useState, useCallback, useEffect } from 'react';
import { DEFAULT_ENABLED_TOOLS, TOOLS_DISABLED_BY_DEFAULT } from '@/ai/tools/enabledTools';
import { getEnabledToolsOverride } from '@/utils/settings';
import { createLogger } from '~logger';

const log = createLogger('useToolsCount', 'AI_CHAT');

interface ToolsCountState {
    enabledToolsCount: number;
    mcpToolsCount: number;
    totalEnabledCount: number;
    isTooManyTools: boolean;
    loadToolsCount: () => Promise<void>;
    setEnabledToolsCount: (count: number) => void;
    setMcpToolsCount: (count: number) => void;
}

/**
 * Hook to manage tools count state and loading logic.
 * Calculates enabled tools from storage and MCP servers.
 */
export const useToolsCount = (): ToolsCountState => {
    // Calculate initial tool count synchronously to avoid showing 0 on first render
    const [enabledToolsCount, setEnabledToolsCount] = useState(() => {
        const disabledByDefaultSet = new Set(TOOLS_DISABLED_BY_DEFAULT);
        const filteredTools = DEFAULT_ENABLED_TOOLS.filter(t => !disabledByDefaultSet.has(t));
        const count = filteredTools.length;
        log.info('🔧 Initial tool count:', {
            defaultTotal: DEFAULT_ENABLED_TOOLS.length,
            disabledByDefault: TOOLS_DISABLED_BY_DEFAULT.length,
            calculated: count,
            sample: filteredTools.slice(0, 5)
        });
        return count;
    });
    const [mcpToolsCount, setMcpToolsCount] = useState(0);

    const totalEnabledCount = enabledToolsCount + mcpToolsCount;
    const isTooManyTools = totalEnabledCount > 40;

    const loadToolsCount = useCallback(async () => {
        try {
            const override = await getEnabledToolsOverride();
            if (override && Array.isArray(override)) {
                setEnabledToolsCount(override.length);
            } else {
                const disabledByDefaultSet = new Set(TOOLS_DISABLED_BY_DEFAULT);
                const count = DEFAULT_ENABLED_TOOLS.filter(t => !disabledByDefaultSet.has(t)).length;
                setEnabledToolsCount(count);
            }

            // Load MCP tools count
            try {
                const mcpResponse = await chrome.runtime.sendMessage({ type: 'mcp/tools/list' });
                if (mcpResponse?.success && mcpResponse.data?.tools) {
                    const tools = mcpResponse.data.tools as { serverId: string; name: string }[];
                    // Get disabled tools for each server
                    const serverIds = [...new Set(tools.map(t => t.serverId))];
                    let enabledMcpCount = tools.length;

                    for (const serverId of serverIds) {
                        const configResponse = await chrome.runtime.sendMessage({
                            type: `mcp/${serverId}/tools/config/get`
                        });
                        if (configResponse?.success && Array.isArray(configResponse.data)) {
                            const disabledTools = configResponse.data as string[];
                            const serverTools = tools.filter(t => t.serverId === serverId);
                            const disabledCount = serverTools.filter(t => disabledTools.includes(t.name)).length;
                            enabledMcpCount -= disabledCount;
                        }
                    }
                    setMcpToolsCount(enabledMcpCount);
                }
            } catch {
                // MCP not available, ignore
            }
        } catch {
            const disabledByDefaultSet = new Set(TOOLS_DISABLED_BY_DEFAULT);
            const count = DEFAULT_ENABLED_TOOLS.filter(t => !disabledByDefaultSet.has(t)).length;
            setEnabledToolsCount(count);
        }
    }, []);

    useEffect(() => {
        loadToolsCount();

        const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
            if (areaName === 'local' && changes.userSettings) {
                loadToolsCount();
            }
        };
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, [loadToolsCount]);

    return {
        enabledToolsCount,
        mcpToolsCount,
        totalEnabledCount,
        isTooManyTools,
        loadToolsCount,
        setEnabledToolsCount,
        setMcpToolsCount
    };
};

