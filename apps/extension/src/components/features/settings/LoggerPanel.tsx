import React, { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, ChevronDown, AlertTriangle, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLoggerConfig } from '@/hooks/settings/useLoggerConfig';
import type { LogCategory, LoggerPresetName } from '@/types/logger';
import { LOGGER_CATEGORY_GROUPS } from '@/types/logger';
import { createLogger } from '~logger';

const log = createLogger('LoggerPanel', 'SETTINGS');

interface LoggerPanelProps {
  onBack: () => void;
}

const PRESET_NAMES: LoggerPresetName[] = [
  'DEVELOPMENT',
  'DEBUG_MCP',
  'DEBUG_VOICE',
  'DEBUG_TOOLS',
  'DEBUG_SANDBOX',
  'DEBUG_WORKFLOW',
  'PRODUCTION',
  'QUIET',
  'VERBOSE',
];

const GROUP_LABELS: Record<keyof typeof LOGGER_CATEGORY_GROUPS, string> = {
  MCP: 'MCP',
  Tools: 'Tools',
  AI: 'AI',
  Voice: 'Voice',
  Memory: 'Memory',
  UI: 'UI Components',
  System: 'System',
  Debug: 'Debug',
};

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}) => {
  return (
    <label className={`inline-flex items-center cursor-pointer ${disabled ? 'cursor-not-allowed' : ''}`}>
      <input
        type="checkbox"
        className="absolute opacity-0 w-0 h-0 peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-checked={checked}
        aria-label={ariaLabel}
      />
      <span
        className={`relative w-9 h-5 rounded-[10px] transition-colors duration-200 ${checked ? 'bg-[var(--color-secondary)]' : 'bg-[var(--bg-quaternary)]'} ${disabled ? 'opacity-50' : ''}`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${checked ? 'translate-x-4' : ''}`}
        />
      </span>
    </label>
  );
};


interface CategoryGroupProps {
  groupName: keyof typeof LOGGER_CATEGORY_GROUPS;
  categories: readonly LogCategory[];
  config: Record<LogCategory, boolean>;
  onToggleCategory: (category: LogCategory, enabled: boolean) => void;
  isOverridden: boolean;
}

const CategoryGroup: React.FC<CategoryGroupProps> = ({
  groupName,
  categories,
  config,
  onToggleCategory,
  isOverridden,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const enabledCount = useMemo(() => {
    return categories.filter((cat) => config[cat]).length;
  }, [categories, config]);

  const handleEnableAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      categories.forEach((cat) => {
        if (!config[cat]) {
          onToggleCategory(cat, true);
        }
      });
    },
    [categories, config, onToggleCategory]
  );

  const handleDisableAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      categories.forEach((cat) => {
        if (config[cat]) {
          onToggleCategory(cat, false);
        }
      });
    },
    [categories, config, onToggleCategory]
  );

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden">
      <button
        type="button"
        className="flex items-center justify-between p-3 w-full cursor-pointer bg-transparent border-none text-[var(--text-primary)] transition-colors duration-200 hover:bg-[var(--glass-bg)]"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            size={16}
            className={`text-[var(--text-secondary)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
          <span className="text-sm font-medium">
            {GROUP_LABELS[groupName]}
            <span className="text-xs text-[var(--text-tertiary)] ml-1">
              ({enabledCount}/{categories.length})
            </span>
          </span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="py-1 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-secondary)] text-[11px] cursor-pointer transition-all duration-200 hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleEnableAll}
            disabled={isOverridden || enabledCount === categories.length}
            aria-label={`Enable all ${GROUP_LABELS[groupName]} categories`}
          >
            All On
          </button>
          <button
            type="button"
            className="py-1 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-secondary)] text-[11px] cursor-pointer transition-all duration-200 hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleDisableAll}
            disabled={isOverridden || enabledCount === 0}
            aria-label={`Disable all ${GROUP_LABELS[groupName]} categories`}
          >
            All Off
          </button>
        </div>
      </button>
      {isExpanded && (
        <div className="border-t border-[var(--border-color)]">
          {categories.map((category) => (
            <div
              key={category}
              className={`flex items-center justify-between py-2.5 px-3 border-b border-[var(--border-color)] last:border-b-0 transition-colors duration-200 hover:bg-[var(--glass-bg)] ${isOverridden ? 'opacity-50' : ''}`}
            >
              <span className={`text-[13px] ${isOverridden ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>{category}</span>
              <ToggleSwitch
                checked={config[category]}
                onChange={(enabled) => onToggleCategory(category, enabled)}
                disabled={isOverridden}
                ariaLabel={`Toggle ${category} logging`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


export const LoggerPanel: React.FC<LoggerPanelProps> = ({ onBack }) => {
  const { config, isLoading, setCategory, setPreset, isPresetActive, reset } = useLoggerConfig();
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter presets based on search query
  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) return PRESET_NAMES;
    const query = searchQuery.toLowerCase();
    return PRESET_NAMES.filter(preset =>
      preset.toLowerCase().includes(query) ||
      preset.replace(/_/g, ' ').toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Filter category groups based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return Object.keys(LOGGER_CATEGORY_GROUPS) as Array<keyof typeof LOGGER_CATEGORY_GROUPS>;
    const query = searchQuery.toLowerCase();
    return (Object.keys(LOGGER_CATEGORY_GROUPS) as Array<keyof typeof LOGGER_CATEGORY_GROUPS>).filter(groupName => {
      // Check if group name matches
      if (GROUP_LABELS[groupName].toLowerCase().includes(query)) return true;
      // Check if any category in the group matches
      return LOGGER_CATEGORY_GROUPS[groupName].some(cat => cat.toLowerCase().includes(query));
    });
  }, [searchQuery]);

  const activePreset = useMemo(() => {
    if (!config) return null;
    for (const preset of PRESET_NAMES) {
      if (isPresetActive(preset)) {
        return preset;
      }
    }
    return null;
  }, [config, isPresetActive]);

  const isShowAllActive = config?.SHOW_ALL ?? false;
  const isErrorsOnlyActive = config?.ERRORS_ONLY ?? false;
  const isOverridden = isShowAllActive;

  const handleToggleCategory = useCallback(
    async (category: LogCategory, enabled: boolean) => {
      if (pendingUpdates.has(category)) return;

      setPendingUpdates((prev) => new Set(prev).add(category));
      try {
        await setCategory(category, enabled);
      } catch (error) {
        log.error('Failed to toggle category', { category, enabled, error });
      } finally {
        setPendingUpdates((prev) => {
          const next = new Set(prev);
          next.delete(category);
          return next;
        });
      }
    },
    [setCategory, pendingUpdates]
  );

  const handlePresetClick = useCallback(
    async (preset: LoggerPresetName) => {
      if (isPresetActive(preset)) return;

      try {
        await setPreset(preset);
        log.info('Applied preset', { preset });
      } catch (error) {
        log.error('Failed to apply preset', { preset, error });
      }
    },
    [setPreset, isPresetActive]
  );

  const handleReset = useCallback(async () => {
    try {
      await reset();
      log.info('Reset to default configuration');
    } catch (error) {
      log.error('Failed to reset configuration', error);
    }
  }, [reset]);

  if (isLoading || !config) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
        <div className="flex items-center p-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] gap-4">
          <button
            type="button"
            className="bg-transparent border-none text-[var(--text-secondary)] cursor-pointer p-1 rounded flex items-center justify-center transition-all duration-200 hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)]"
            onClick={onBack}
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold m-0 text-[var(--text-primary)]">Logger Panel</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
      <div className="flex items-center p-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] gap-4">
        <button
          type="button"
          className="bg-transparent border-none text-[var(--text-secondary)] cursor-pointer p-1 rounded flex items-center justify-center transition-all duration-200 hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)]"
          onClick={onBack}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold m-0 text-[var(--text-primary)]">Logger Panel</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5 m-0">Configure logging categories</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsSearchOpen(!isSearchOpen);
            if (isSearchOpen) {
              setSearchQuery('');
            }
          }}
          className={`p-2 border rounded-lg cursor-pointer transition-all duration-200 shrink-0 ${isSearchOpen
              ? 'bg-white/[0.08] border-white/[0.15] text-[var(--text-primary)]'
              : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:border-[var(--border-color-hover)] hover:text-[var(--text-primary)]'
            }`}
          title={isSearchOpen ? 'Close search' : 'Search categories'}
          aria-label={isSearchOpen ? 'Close search' : 'Search categories'}
        >
          <AnimatePresence mode="wait">
            {isSearchOpen ? (
              <motion.div
                key="close"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                transition={{ duration: 0.15 }}
              >
                <X size={16} />
              </motion.div>
            ) : (
              <motion.div
                key="search"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
              >
                <Search size={16} />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
        <button
          type="button"
          className="py-1.5 px-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-xs font-medium cursor-pointer transition-all duration-200 hover:bg-[var(--glass-bg-hover)] hover:border-[var(--border-color-hover)]"
          onClick={handleReset}
          aria-label="Reset to defaults"
        >
          Reset
        </button>
      </div>

      {/* Expandable Search Input */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="overflow-hidden border-b border-[var(--border-color)]"
          >
            <div className="flex items-center gap-2 p-3 mx-4 my-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg">
              <Search size={16} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search presets or categories..."
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] text-sm placeholder:text-[var(--text-tertiary)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="flex items-center justify-center p-1 bg-transparent border-none text-[var(--text-tertiary)] cursor-pointer transition-colors hover:text-[var(--text-primary)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/[0.15] [&::-webkit-scrollbar-thumb]:rounded-sm hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
        {/* Quick Presets */}
        {filteredPresets.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide m-0">Quick Presets</h2>
            <div className="flex flex-wrap gap-2">
              {filteredPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`py-1.5 px-3 border rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 ${activePreset === preset
                    ? 'bg-[var(--color-secondary)] border-[var(--color-secondary)] text-white'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:border-[var(--border-color-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.replace(/_/g, ' ')}
                </button>
              ))}
              {!activePreset && !searchQuery && (
                <span className="py-1.5 px-3 bg-[var(--bg-quaternary)] border border-[var(--color-warning)] rounded-lg text-xs font-medium text-[var(--color-warning)] cursor-default">CUSTOM</span>
              )}
            </div>
          </div>
        )}

        {/* Override Warnings */}
        {isShowAllActive && (
          <div className="flex items-center gap-2 py-2.5 px-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[var(--color-warning)] text-xs">
            <AlertTriangle size={16} className="shrink-0" />
            <span>SHOW_ALL is enabled — all categories are logged regardless of individual settings</span>
          </div>
        )}
        {isErrorsOnlyActive && !isShowAllActive && (
          <div className="flex items-center gap-2 py-2.5 px-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[var(--color-warning)] text-xs">
            <AlertTriangle size={16} className="shrink-0" />
            <span>ERRORS_ONLY is enabled — only error-level logs will appear</span>
          </div>
        )}

        {/* Special Controls */}
        <div className="flex flex-col gap-3">
          <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide m-0">Override Controls</h2>
          <div className="flex flex-col gap-2">
            <div className={`flex items-center justify-between p-3 bg-[var(--bg-secondary)] border rounded-xl ${isShowAllActive ? 'border-[var(--color-warning)] bg-amber-500/5' : 'border-[var(--border-color)]'}`}>
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">SHOW_ALL</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Override all category settings and show all logs
                </div>
              </div>
              <ToggleSwitch
                checked={isShowAllActive}
                onChange={(enabled) => handleToggleCategory('SHOW_ALL', enabled)}
                ariaLabel="Toggle SHOW_ALL mode"
              />
            </div>
            <div className={`flex items-center justify-between p-3 bg-[var(--bg-secondary)] border rounded-xl ${isErrorsOnlyActive ? 'border-[var(--color-warning)] bg-amber-500/5' : 'border-[var(--border-color)]'}`}>
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">ERRORS_ONLY</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Only show error-level logs regardless of categories
                </div>
              </div>
              <ToggleSwitch
                checked={isErrorsOnlyActive}
                onChange={(enabled) => handleToggleCategory('ERRORS_ONLY', enabled)}
                ariaLabel="Toggle ERRORS_ONLY mode"
              />
            </div>
          </div>
        </div>

        {/* Category Groups */}
        {filteredGroups.filter((groupName) => groupName !== 'Debug').length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide m-0">Category Controls</h2>
            <div className="flex flex-col gap-2">
              {filteredGroups
                .filter((groupName) => groupName !== 'Debug')
                .map((groupName) => (
                  <CategoryGroup
                    key={groupName}
                    groupName={groupName}
                    categories={LOGGER_CATEGORY_GROUPS[groupName]}
                    config={config}
                    onToggleCategory={handleToggleCategory}
                    isOverridden={isOverridden}
                  />
                ))}
            </div>
          </div>
        )}

        {/* No Results Message */}
        {searchQuery && filteredPresets.length === 0 && filteredGroups.filter((g) => g !== 'Debug').length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search size={32} className="text-[var(--text-tertiary)] mb-3 opacity-50" />
            <p className="text-sm text-[var(--text-secondary)] m-0">No matching presets or categories</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1 m-0">Try a different search term</p>
          </div>
        )}
      </div>
    </div>
  );
};
