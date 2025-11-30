import React, { useEffect } from 'react';
import { Server } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToolsPopover } from './useToolsPopover';
import { SearchBar } from './components/SearchBar';
import { ModeSelector } from './components/ModeSelector';
import { ToolCategory } from './components/ToolCategory';
import { McpCategory } from './components/McpCategory';
import { WebMcpSection } from './components/WebMcpSection';
import { Footer } from './components/Footer';
import type { ToolsPopoverProps } from './types';

export const ToolsPopover: React.FC<ToolsPopoverProps> = ({ isOpen, onClose, onCountChange }) => {
    const {
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
        webmcpLoading,
        webmcpDisabledTools,
        toggleWebMCPTool,
        enabledWebMCPCount,
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
    } = useToolsPopover(isOpen, onClose);

    useEffect(() => {
        if (isOpen && onCountChange) {
            onCountChange(enabledExtensionCount, enabledMcpCount);
        }
    }, [isOpen, enabledExtensionCount, enabledMcpCount, onCountChange]);

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
                    <div className="tools-popover-arrow" />

                    <SearchBar
                        value={toolSearchQuery}
                        onChange={setToolSearchQuery}
                    />

                    <ModeSelector
                        displayMode={displayMode}
                        hasUserModified={hasUserModified}
                        onModeChange={handleModeChange}
                    />

                    <div className="tools-popover-content">
                        {(filteredWebMCPTools.length > 0 || webmcpLoading) && (
                            <WebMcpSection
                                tools={filteredWebMCPTools}
                                disabledTools={webmcpDisabledTools}
                                isLoading={webmcpLoading}
                                enabledCount={enabledWebMCPCount}
                                isExpanded={expandedCategories['webmcp-active'] ?? false}
                                onToggleCategory={toggleCategory}
                                onToggleTool={toggleWebMCPTool}
                                onToggleCategoryAll={handleToggleWebMcpCategoryAll}
                            />
                        )}

                        {(filteredWebMCPTools.length > 0 || webmcpLoading) && (
                            <div className="tools-popover-divider" />
                        )}

                        {Object.entries(groupedTools).map(([category, tools]) => (
                            <ToolCategory
                                key={category}
                                category={category}
                                tools={tools}
                                enabledMap={enabledMap}
                                isExpanded={expandedCategories[category] ?? false}
                                supermemoryConfigured={supermemoryConfigured}
                                showSupermemoryTooltip={showSupermemoryTooltip}
                                onToggleCategory={toggleCategory}
                                onToggleTool={handleToggleTool}
                                onToggleCategoryAll={handleToggleCategory}
                                onSetSupermemoryTooltip={setShowSupermemoryTooltip}
                            />
                        ))}

                        {Object.keys(groupedTools).length === 0 && Object.keys(mcpServerGroups).length === 0 && (
                            <div className="tools-popover-empty">
                                No tools found
                            </div>
                        )}

                        {(Object.keys(mcpServerGroups).length > 0 || mcpLoading) && (
                            <div className="tools-popover-mcp-section">
                                <div className="tools-popover-mcp-header">
                                    <Server size={12} />
                                    <span>MCP Servers</span>
                                    {mcpLoading && <span className="tools-popover-mcp-loading">Loading...</span>}
                                </div>
                                {Object.entries(mcpServerGroups).map(([serverId, { name, tools: serverTools }]) => (
                                    <McpCategory
                                        key={serverId}
                                        serverId={serverId}
                                        serverName={name}
                                        tools={serverTools}
                                        disabledTools={mcpDisabledTools[serverId] || []}
                                        isExpanded={expandedCategories[`mcp-${serverId}`] ?? false}
                                        onToggleCategory={toggleCategory}
                                        onToggleTool={handleToggleMcpTool}
                                        onToggleCategoryAll={handleToggleMcpCategory}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <Footer
                        totalEnabledCount={totalEnabledCount}
                        totalToolCount={totalToolCount}
                        enabledMcpCount={enabledMcpCount}
                        enabledWebMCPCount={enabledWebMCPCount}
                        mcpToolsCount={mcpTools.length}
                        webmcpToolsCount={filteredWebMCPTools.length}
                        isTooManyTools={isTooManyTools}
                        showInfoTooltip={showInfoTooltip}
                        onSetShowInfoTooltip={setShowInfoTooltip}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
};
