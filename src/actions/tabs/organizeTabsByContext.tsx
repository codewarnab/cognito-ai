/**
 * OrganizeTabsByContext Tool for AI SDK v5
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 * 
 * Intelligently organize tabs by analyzing their content and context.
 * Groups related tabs together even if they're from different websites.
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { ToolCard } from '../../components/ui/ToolCard';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-OrganizeTabsByContext');

/**
 * Hook to register the organizeTabsByContext tool
 */
export function useOrganizeTabsByContextTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering organizeTabsByContext tool...');
        
        // Register the tool with AI SDK v5
        registerTool({
            name: 'organizeTabsByContext',
            description: 'Intelligently organize tabs by analyzing their content and context. Groups related tabs together even if they are from different websites. For example, all tabs about "React hooks" will be grouped together regardless of whether they are from GitHub, StackOverflow, or documentation sites.',
            parameters: z.object({
                maxGroups: z.number()
                    .describe('Maximum number of groups to create (default: 5)')
                    .default(5),
            }),
            execute: async ({ maxGroups = 5 }) => {
                try {
                    log.info("TOOL CALL: organizeTabsByContext", { maxGroups });
                    
                    // Check if Tab Groups API is available
                    if (!chrome.tabs.group || !chrome.tabGroups) {
                        log.error("Tab Groups API not available");
                        return {
                            error: "Tab Groups API not available. This feature requires Chrome 89 or later.",
                            details: "chrome.tabGroups is undefined"
                        };
                    }

                    // Get all tabs
                    const tabs = await chrome.tabs.query({});

                    // Filter out special URLs
                    const validTabs = tabs.filter(tab => {
                        if (!tab.url) return false;
                        try {
                            const url = new URL(tab.url);
                            return url.protocol !== 'chrome:' && url.protocol !== 'chrome-extension:';
                        } catch {
                            return false;
                        }
                    });

                    if (validTabs.length === 0) {
                        return { error: "No valid tabs to organize" };
                    }

                    // Prepare tab information for AI analysis
                    const tabsInfo = validTabs.map(tab => ({
                        id: tab.id!,
                        title: tab.title || '',
                        url: tab.url || '',
                        domain: new URL(tab.url!).hostname
                    }));

                    // Return tab information for AI to analyze and group
                    // The AI will analyze these tabs and suggest groups based on context
                    return {
                        needsAIAnalysis: true,
                        tabs: tabsInfo,
                        maxGroups,
                        message: "Please analyze these tabs and group them by topic/context. Consider the title, URL, and domain to identify related work or research. Return a JSON array of groups where each group has: {name: string, description: string, tabIds: number[]}. Group tabs that are related to the same topic, project, or research, even if they're from different websites."
                    };

                } catch (error) {
                    log.error('[Tool] Error organizing tabs by context:', error);
                    return { error: "Failed to organize tabs by context", details: String(error) };
                }
            },
        });

        // Register the UI renderer for this tool
        registerToolUI('organizeTabsByContext', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <ToolCard 
                        title="Analyzing Tabs" 
                        subtitle="AI is analyzing tab content and context..." 
                        state="loading" 
                        icon="🧠" 
                    />
                );
            }
            
            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return (
                        <ToolCard 
                            title="Organization Failed" 
                            subtitle={output.error} 
                            state="error" 
                            icon="🧠" 
                        />
                    );
                }
                
                if (output.needsAIAnalysis) {
                    return (
                        <ToolCard 
                            title="Tabs Ready for Analysis" 
                            subtitle={`${output.tabs.length} tabs prepared`} 
                            state="success" 
                            icon="🧠"
                        >
                            <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>
                                AI will now analyze and group these tabs by context...
                            </div>
                        </ToolCard>
                    );
                }
                
                if (output.groups) {
                    return (
                        <ToolCard
                            title="Tabs Organized by Context"
                            subtitle={`Created ${output.groups.length} contextual group(s)`}
                            state="success"
                            icon="🧠"
                        >
                            {output.groups.length > 0 && (
                                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                                    {output.groups.map((group: any, idx: number) => (
                                        <div key={idx} style={{
                                            padding: '8px',
                                            marginBottom: '6px',
                                            background: 'rgba(0,0,0,0.05)',
                                            borderRadius: '4px'
                                        }}>
                                            <div style={{ fontWeight: 600, marginBottom: '2px' }}>{group.name}</div>
                                            {group.description && (
                                                <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>
                                                    {group.description}
                                                </div>
                                            )}
                                            <div style={{ opacity: 0.6 }}>{group.tabCount || group.tabIds?.length || 0} tab(s)</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ToolCard>
                    );
                }
            }
            
            if (toolState === 'output-error') {
                return (
                    <ToolCard 
                        title="Failed to Organize Tabs" 
                        subtitle={state.errorText} 
                        state="error" 
                        icon="🧠" 
                    />
                );
            }
            
            return null;
        });

        log.info('✅ organizeTabsByContext tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up organizeTabsByContext tool');
            unregisterToolUI('organizeTabsByContext');
        };
    }, []); // Empty dependency array - only register once on mount
}
