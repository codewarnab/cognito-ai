import React, { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, ChevronDown, AlertTriangle } from 'lucide-react';
import { useLoggerConfig } from '@/hooks/settings/useLoggerConfig';
import type { LogCategory, LoggerPresetName } from '@/types/logger';
import { LOGGER_CATEGORY_GROUPS } from '@/types/logger';
import { createLogger } from '~logger';
import './LoggerPanel.css';

const log = createLogger('LoggerPanel', 'SETTINGS');

interface LoggerPanelProps {
  onBack: () => void;
}

const PRESET_NAMES: LoggerPresetName[] = [
  'DEVELOPMENT',
  'DEBUG_MCP',
  'DEBUG_VOICE',
  'DEBUG_TOOLS',
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
    <label className={`logger-toggle-wrapper ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        className="logger-toggle-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-checked={checked}
        aria-label={ariaLabel}
      />
      <span className="logger-toggle-switch" aria-hidden="true">
        <span className="logger-toggle-slider" />
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
    <div className="logger-panel-group">
      <button
        type="button"
        className="logger-panel-group-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="logger-panel-group-header-left">
          <ChevronDown
            size={16}
            className={`logger-panel-group-chevron ${isExpanded ? 'expanded' : ''}`}
          />
          <span className="logger-panel-group-name">
            {GROUP_LABELS[groupName]}
            <span className="logger-panel-group-count">
              ({enabledCount}/{categories.length})
            </span>
          </span>
        </div>
        <div className="logger-panel-group-actions">
          <button
            type="button"
            className="logger-panel-group-toggle-all"
            onClick={handleEnableAll}
            disabled={isOverridden || enabledCount === categories.length}
            aria-label={`Enable all ${GROUP_LABELS[groupName]} categories`}
          >
            All On
          </button>
          <button
            type="button"
            className="logger-panel-group-toggle-all"
            onClick={handleDisableAll}
            disabled={isOverridden || enabledCount === 0}
            aria-label={`Disable all ${GROUP_LABELS[groupName]} categories`}
          >
            All Off
          </button>
        </div>
      </button>
      {isExpanded && (
        <div className="logger-panel-group-content">
          {categories.map((category) => (
            <div
              key={category}
              className={`logger-panel-category-item ${isOverridden ? 'disabled' : ''}`}
            >
              <span className="logger-panel-category-name">{category}</span>
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
      <div className="logger-panel">
        <div className="logger-panel-header">
          <button
            type="button"
            className="logger-panel-back-button"
            onClick={onBack}
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="logger-panel-title-container">
            <h1 className="logger-panel-title">Logger Panel</h1>
          </div>
        </div>
        <div className="logger-panel-loading">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="logger-panel">
      <div className="logger-panel-header">
        <button
          type="button"
          className="logger-panel-back-button"
          onClick={onBack}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="logger-panel-title-container">
          <h1 className="logger-panel-title">Logger Panel</h1>
          <p className="logger-panel-subtitle">Configure logging categories</p>
        </div>
        <button
          type="button"
          className="logger-panel-reset-button"
          onClick={handleReset}
          aria-label="Reset to defaults"
        >
          Reset
        </button>
      </div>

      <div className="logger-panel-content">
        {/* Quick Presets */}
        <div className="logger-panel-section">
          <h2 className="logger-panel-section-title">Quick Presets</h2>
          <div className="logger-panel-presets">
            {PRESET_NAMES.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`logger-panel-preset-button ${activePreset === preset ? 'active' : ''}`}
                onClick={() => handlePresetClick(preset)}
              >
                {preset.replace(/_/g, ' ')}
              </button>
            ))}
            {!activePreset && (
              <span className="logger-panel-preset-button custom">CUSTOM</span>
            )}
          </div>
        </div>

        {/* Override Warnings */}
        {isShowAllActive && (
          <div className="logger-panel-warning">
            <AlertTriangle size={16} className="logger-panel-warning-icon" />
            <span>SHOW_ALL is enabled — all categories are logged regardless of individual settings</span>
          </div>
        )}
        {isErrorsOnlyActive && !isShowAllActive && (
          <div className="logger-panel-warning">
            <AlertTriangle size={16} className="logger-panel-warning-icon" />
            <span>ERRORS_ONLY is enabled — only error-level logs will appear</span>
          </div>
        )}

        {/* Special Controls */}
        <div className="logger-panel-section">
          <h2 className="logger-panel-section-title">Override Controls</h2>
          <div className="logger-panel-special-controls">
            <div className={`logger-panel-special-item ${isShowAllActive ? 'active' : ''}`}>
              <div className="logger-panel-special-content">
                <div className="logger-panel-special-title">SHOW_ALL</div>
                <div className="logger-panel-special-description">
                  Override all category settings and show all logs
                </div>
              </div>
              <ToggleSwitch
                checked={isShowAllActive}
                onChange={(enabled) => handleToggleCategory('SHOW_ALL', enabled)}
                ariaLabel="Toggle SHOW_ALL mode"
              />
            </div>
            <div className={`logger-panel-special-item ${isErrorsOnlyActive ? 'active' : ''}`}>
              <div className="logger-panel-special-content">
                <div className="logger-panel-special-title">ERRORS_ONLY</div>
                <div className="logger-panel-special-description">
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
        <div className="logger-panel-section">
          <h2 className="logger-panel-section-title">Category Controls</h2>
          <div className="logger-panel-groups">
            {(Object.keys(LOGGER_CATEGORY_GROUPS) as Array<keyof typeof LOGGER_CATEGORY_GROUPS>)
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
      </div>
    </div>
  );
};
