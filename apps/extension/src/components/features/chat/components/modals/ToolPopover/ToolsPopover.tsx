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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/primitives/dialog/Dialog';

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
        showLocationPermissionDialog,
        setShowLocationPermissionDialog,
        showLocationTimeoutDialog,
        setShowLocationTimeoutDialog,
    } = useToolsPopover(isOpen, onClose);

    const handleOpenLocationSettings = () => {
        chrome.tabs.create({ url: 'chrome://settings/content/siteDetails?site=chrome-extension%3A%2F%2F' + chrome.runtime.id });
        setShowLocationPermissionDialog(false);
    };

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
                        overflow: 'hidden',
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

                    <SearchBar
                        value={toolSearchQuery}
                        onChange={setToolSearchQuery}
                    />

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

                        {(Object.keys(mcpServerGroups).length > 0 || mcpLoading) && (
                            <div style={{
                                marginTop: '8px',
                                paddingTop: '8px',
                                borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
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
            <Dialog open={showLocationPermissionDialog} onOpenChange={setShowLocationPermissionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Location Access Blocked</DialogTitle>
                        <DialogDescription>
                            Location access is blocked. Please enable it in the extension details in Chrome Settings to use this feature.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-row justify-end space-x-2">
                        <button
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-transparent text-white border border-white/10 hover:bg-white/10 cursor-pointer"
                            onClick={() => setShowLocationPermissionDialog(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-[#1264FF] text-white hover:bg-[#0d4fd8] cursor-pointer"
                            onClick={handleOpenLocationSettings}
                        >
                            Fix Settings
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={showLocationTimeoutDialog} onOpenChange={setShowLocationTimeoutDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Location Services Unavailable</DialogTitle>
                        <DialogDescription>
                            Location request timed out. This usually means location services are disabled in your system settings.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <p className="font-semibold text-[var(--text-primary)] mb-1">Windows</p>
                            <p>Settings → Privacy & Security → Location → Turn on "Location services"</p>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <p className="font-semibold text-[var(--text-primary)] mb-1">macOS</p>
                            <p>System Preferences → Security & Privacy → Privacy → Location Services → Enable</p>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <p className="font-semibold text-[var(--text-primary)] mb-1">Linux</p>
                            <p>Check your distribution's location/privacy settings, or enable location in GNOME Settings → Privacy → Location Services</p>
                        </div>
                    </div>
                    <DialogFooter className="flex-row justify-end space-x-2 mt-4">
                        <button
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-[#1264FF] text-white hover:bg-[#0d4fd8] cursor-pointer"
                            onClick={() => setShowLocationTimeoutDialog(false)}
                        >
                            Got it
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AnimatePresence>
    );
};
