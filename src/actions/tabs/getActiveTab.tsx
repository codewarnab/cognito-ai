/**
 * GetActiveTab Tool for AI SDK v5
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 * 
 * Gets information about the currently active browser tab
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { ToolCard } from '../../components/ui/ToolCard';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-GetActiveTab');

/**
 * Hook to register the getActiveTab tool
 */
export function useGetActiveTab() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering getActiveTab tool...');
        
        // Register the tool with AI SDK v5
        registerTool({
            name: 'getActiveTab',
            description: 'Get information about the currently active browser tab in the current window',
            parameters: z.object({}),
            execute: async () => {
                try {
                    log.info("TOOL CALL: getActiveTab");
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    
                    if (!tabs || tabs.length === 0 || !tabs[0]) {
                        log.warn("No active tab found in current window");
                        return { error: "No active tab found" };
                    }
                    
                    const tab = tabs[0];
                    log.info('✅ Retrieved active tab info', { tabId: tab.id, title: tab.title });
                    
                    return { 
                        success: true,
                        title: tab.title || 'Untitled',
                        url: tab.url || '',
                        id: tab.id 
                    };
                } catch (error) {
                    log.error('[Tool] Error getting active tab:', error);
                    return { error: "Failed to get active tab info", details: String(error) };
                }
            },
        });

        // Register the UI renderer for this tool
        registerToolUI('getActiveTab', (state: ToolUIState) => {
            const { state: toolState, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <ToolCard 
                        title="Getting Active Tab" 
                        state="loading" 
                        icon="🔍" 
                    />
                );
            }
            
            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return (
                        <ToolCard 
                            title="Failed to Get Tab" 
                            subtitle={output.error} 
                            state="error" 
                            icon="🔍" 
                        />
                    );
                }
                
                if (output.success) {
                    return (
                        <ToolCard 
                            title="Active Tab" 
                            state="success" 
                            icon="🔍"
                        >
                            <div style={{ fontSize: '13px' }}>
                                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{output.title}</div>
                                <div style={{ opacity: 0.7, wordBreak: 'break-all', fontSize: '12px' }}>{output.url}</div>
                            </div>
                        </ToolCard>
                    );
                }
            }
            
            if (toolState === 'output-error') {
                return (
                    <ToolCard 
                        title="Failed to Get Tab" 
                        subtitle={state.errorText} 
                        state="error" 
                        icon="🔍" 
                    />
                );
            }
            
            return null;
        });

        log.info('✅ getActiveTab tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up getActiveTab tool');
            unregisterToolUI('getActiveTab');
        };
    }, []); // Empty dependency array - only register once on mount
}
