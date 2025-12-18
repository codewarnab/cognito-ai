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
                    key="tools-popover"
                    ref={popoverRef}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: 0,
                        width: '280px',
                        maxHeight: '340px',
                        backgroundColor: 'var(--bg-secondary, #0f1420)',
                        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                        borderRadius: '10px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: 100,
                    }}
                >
                    {/* Arrow */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-6px',
                            left: '20px',
                            width: '12px',
                            height: '12px',
                            backgroundColor: 'var(--bg-secondary, #0f1420)',
                            borderRight: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                            transform: 'rotate(45deg)',
                        }}
                    />

                    {/* Hide search bar in Adaptive mode */}
                    {displayMode !== 'adaptive' && (
                        <SearchBar
                            value={toolSearchQuery}
                            onChange={setToolSearchQuery}
                        />
                    )}

                    <ModeSelector
                        displayMode={displayMode}
                        hasUserModified={hasUserModified}
                        onModeChange={handleModeChange}
                    />

                    <div
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '4px',
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'var(--border-color) transparent',
                        }}
                    >
                        {/* Adaptive mode: Show simple read-only list of enabled tools */}
                        {displayMode === 'adaptive' ? (
                            <div className="p-2">
                                {(() => {
                                    const hasMcp = Object.keys(mcpServerGroups).length > 0;
                                    const hasWebMcp = filteredWebMCPTools.length > 0;
                                    const isCompact = hasMcp || hasWebMcp;
                                    const enabledTools = Object.entries(enabledMap).filter(([, enabled]) => enabled);

                                    return (
                                        <>
                                            <div className="text-[10px] font-medium text-[var(--text-tertiary,#6b7280)] px-2 pb-1.5 uppercase tracking-wide flex items-center justify-between">
                                                <span>Active Tools</span>
                                                {isCompact && (
                                                    <span className="text-[9px] font-normal normal-case tracking-normal opacity-70">
                                                        {enabledTools.length} tools
                                                    </span>
                                                )}
                                            </div>
                                            {isCompact ? (
                                                <div className="flex flex-wrap gap-1 px-1">
                                                    {enabledTools.map(([toolName]) => (
                                                        <div
                                                            key={toolName}
                                                            className="flex items-center gap-1 py-1 px-1.5 rounded bg-white/[0.03]"
                                                        >
                                                            <div className="w-1 h-1 rounded-full bg-green-500 shrink-0" />
                                                            <span className="text-[9px] text-[var(--text-primary,#fff)] font-medium">
                                                                {toolName}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-1">
                                                    {enabledTools.map(([toolName]) => (
                                                        <div
                                                            key={toolName}
                                                            className="flex items-center gap-1.5 py-1.5 px-2 rounded-md bg-white/[0.03]"
                                                        >
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                                            <span className="text-[11px] text-[var(--text-primary,#fff)] font-medium truncate">
                                                                {toolName}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                                {/* Show connected MCP servers */}
                                {Object.keys(mcpServerGroups).length > 0 && (
                                    <>
                                        <div className="text-[10px] font-medium text-[var(--text-tertiary,#6b7280)] px-2 pt-2.5 pb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                                            {(Server as any)({ size: 10 })}
                                            <span>MCP ({Object.keys(mcpServerGroups).length})</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1 px-1">
                                            {Object.entries(mcpServerGroups).map(([serverId, { name }]) => (
                                                <div
                                                    key={serverId}
                                                    className="flex items-center gap-1 py-1 px-1.5 rounded bg-white/[0.03]"
                                                >
                                                    <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                                                    <span className="text-[9px] text-[var(--text-primary,#fff)] font-medium truncate max-w-[80px]">
                                                        {name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {/* Show WebMCP websites */}
                                {filteredWebMCPTools.length > 0 && (
                                    <>
                                        <div className="text-[10px] font-medium text-[var(--text-tertiary,#6b7280)] px-2 pt-2.5 pb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                                <span className="w-0.5 h-0.5 rounded-full bg-emerald-500" />
                                            </span>
                                            <span>Web ({filteredWebMCPTools.length})</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1 px-1">
                                            {(() => {
                                                const domain = filteredWebMCPTools[0]?.domain;
                                                return domain ? (
                                                    <div className="flex items-center gap-1 py-1 px-1.5 rounded bg-white/[0.03]">
                                                        <div className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                                                        <span className="text-[9px] text-[var(--text-primary,#fff)] font-medium truncate max-w-[100px]">
                                                            {domain}
                                                        </span>
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>
                                    </>
                                )}
                                <div className="mt-3 p-2 text-[10px] text-[var(--text-tertiary,#6b7280)] bg-white/[0.03] rounded-md leading-relaxed">
                                    Other tools are discovered and used automatically.
                                </div>
                            </div>
                        ) : (
                            <>
                                {(filteredWebMCPTools.length > 0 || webmcpLoading) && (
                                    <WebMcpSection
                                        tools={filteredWebMCPTools}
                                        disabledTools={webmcpDisabledTools}
                                        isLoading={webmcpLoading}
                                        enabledCount={enabledWebMCPCount}
                                        isExpanded={expandedCategories['webmcp-active'] ?? false}
                                        searchQuery={toolSearchQuery}
                                        onToggleCategory={toggleCategory}
                                        onToggleTool={toggleWebMCPTool}
                                        onToggleCategoryAll={handleToggleWebMcpCategoryAll}
                                    />
                                )}

                                {(filteredWebMCPTools.length > 0 || webmcpLoading) && (
                                    <div style={{
                                        height: '1px',
                                        backgroundColor: 'var(--border-color, rgba(255, 255, 255, 0.08))',
                                        margin: '8px 0',
                                    }} />
                                )}

                                {(Object.keys(mcpServerGroups).length > 0 || mcpLoading) && (
                                    <div style={{
                                        marginBottom: '8px',
                                        paddingBottom: '8px',
                                        borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '4px 8px 6px',
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            color: 'var(--text-tertiary, #6b7280)',
                                        }}>
                                            <Server size={12} />
                                            <span>MCP Servers</span>
                                            {mcpLoading && (
                                                <span style={{ fontSize: '9px', fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: 0.7 }}>
                                                    Loading...
                                                </span>
                                            )}
                                        </div>
                                        {Object.entries(mcpServerGroups).map(([serverId, { name, tools: serverTools }]) => (
                                            <McpCategory
                                                key={serverId}
                                                serverId={serverId}
                                                serverName={name}
                                                tools={serverTools}
                                                disabledTools={mcpDisabledTools[serverId] || []}
                                                isExpanded={expandedCategories[`mcp-${serverId}`] ?? false}
                                                searchQuery={toolSearchQuery}
                                                onToggleCategory={toggleCategory}
                                                onToggleTool={handleToggleMcpTool}
                                                onToggleCategoryAll={handleToggleMcpCategory}
                                            />
                                        ))}
                                    </div>
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
                                        searchQuery={toolSearchQuery}
                                        onToggleCategory={toggleCategory}
                                        onToggleTool={handleToggleTool}
                                        onToggleCategoryAll={handleToggleCategory}
                                        onSetSupermemoryTooltip={setShowSupermemoryTooltip}
                                    />
                                ))}

                                {Object.keys(groupedTools).length === 0 && Object.keys(mcpServerGroups).length === 0 && (
                                    <div style={{
                                        padding: '16px',
                                        textAlign: 'center',
                                        color: 'var(--text-tertiary, #6b7280)',
                                        fontSize: '11px',
                                    }}>
                                        No tools found
                                    </div>
                                )}
                            </>
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
