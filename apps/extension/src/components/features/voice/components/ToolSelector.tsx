/**
 * ToolSelector - Component for enabling/disabling voice mode tools
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, Check, X } from 'lucide-react';
import { createLogger } from '~logger';
import { ALL_TOOLS, getEnabledTools, setEnabledTools } from '@/services/elevenlabs/settings';
import '../styles/ToolSelector.css';

const log = createLogger('ToolSelector', 'UI_VOICE');

interface ToolSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onToolsChange?: (enabledTools: string[]) => void;
}

export const ToolSelector: React.FC<ToolSelectorProps> = ({
  isOpen,
  onClose,
  onToolsChange,
}) => {
  const [enabledToolIds, setEnabledToolIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previousState, setPreviousState] = useState<string[]>([]);

  useEffect(() => {
    const loadTools = async () => {
      if (!isOpen) return;

      try {
        setIsLoading(true);
        const tools = await getEnabledTools();
        setEnabledToolIds(tools);
        setPreviousState(tools);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error('Failed to load enabled tools', { error: errorMessage });
      } finally {
        setIsLoading(false);
      }
    };

    loadTools();
  }, [isOpen]);

  const handleToggleTool = async (toolId: string) => {
    const newEnabled = enabledToolIds.includes(toolId)
      ? enabledToolIds.filter((id) => id !== toolId)
      : [...enabledToolIds, toolId];

    // Optimistic update
    setEnabledToolIds(newEnabled);

    try {
      await setEnabledTools(newEnabled);
      setPreviousState(newEnabled);
      onToolsChange?.(newEnabled);
      log.info('Tool toggled', { toolId, enabled: newEnabled.includes(toolId) });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to save tool settings', { error: errorMessage });
      // Revert on error
      setEnabledToolIds(previousState);
    }
  };


  const handleEnableAll = async () => {
    const allIds = ALL_TOOLS.map((t) => t.id);
    setEnabledToolIds(allIds);

    try {
      await setEnabledTools(allIds);
      setPreviousState(allIds);
      onToolsChange?.(allIds);
      log.info('All tools enabled');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to enable all tools', { error: errorMessage });
      setEnabledToolIds(previousState);
    }
  };

  const handleDisableAll = async () => {
    setEnabledToolIds([]);

    try {
      await setEnabledTools([]);
      setPreviousState([]);
      onToolsChange?.([]);
      log.info('All tools disabled');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to disable all tools', { error: errorMessage });
      setEnabledToolIds(previousState);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, toolId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggleTool(toolId);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="tool-selector-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="tool-selector-panel"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tool-selector-header">
              <div className="tool-selector-title">
                <Settings2 size={18} />
                <span>Voice Mode Tools</span>
              </div>
              <button
                className="tool-selector-close"
                onClick={onClose}
                aria-label="Close tool selector"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="tool-selector-actions">
              <button
                className="tool-action-btn"
                onClick={handleEnableAll}
                type="button"
              >
                Enable All
              </button>
              <button
                className="tool-action-btn"
                onClick={handleDisableAll}
                type="button"
              >
                Disable All
              </button>
            </div>

            <div className="tool-selector-list">
              {isLoading ? (
                <div className="tool-selector-loading">Loading tools...</div>
              ) : (
                ALL_TOOLS.map((tool) => (
                  <div
                    key={tool.id}
                    className={`tool-item ${enabledToolIds.includes(tool.id) ? 'enabled' : ''}`}
                    onClick={() => handleToggleTool(tool.id)}
                    onKeyDown={(e) => handleKeyDown(e, tool.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="tool-item-info">
                      <div className="tool-item-name">{tool.name}</div>
                      <div className="tool-item-description">{tool.description}</div>
                    </div>
                    <div className="tool-item-toggle">
                      {enabledToolIds.includes(tool.id) ? (
                        <Check size={16} className="tool-enabled-icon" />
                      ) : (
                        <div className="tool-disabled-indicator" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="tool-selector-footer">
              <span>
                {enabledToolIds.length} of {ALL_TOOLS.length} tools enabled
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ToolSelector;
