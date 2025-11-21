import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { createLogger } from '~logger';
import { DEFAULT_ENABLED_TOOLS } from '../../../ai/tools/enabledTools';
import { getEnabledToolsOverride, setEnabledToolsOverride, getVoiceName, setVoiceName } from '../../../utils/settingsStorage';
import type { VoiceName } from '../../../types/settings';
import type { VisibilitySettings } from '../../../utils/ask-ai-button-visibility';
import {
  getVisibilitySettings,
  reEnableButton,
  hideForever,
  hideForSession,
  clearSessionHide,
  clearAllHiddenDomains,
  removeDomainFromHidden,
  hideForCurrentPage,
} from '../../../utils/ask-ai-button-visibility';

const log = createLogger('SettingsPage');

interface SettingsPageProps {
  onBack: () => void;
}

const VOICE_OPTIONS: VoiceName[] = ['Aoede', 'Orus', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Orion'];

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
  const [voice, setVoice] = useState<VoiceName>('Aoede');
  const [askAiVisibility, setAskAiVisibility] = useState<VisibilitySettings>({
    hiddenDomains: [],
    hiddenForSession: false,
    permanentlyHidden: false,
  });
  const [newHiddenDomain, setNewHiddenDomain] = useState('');

  const allTools = useMemo(() => DEFAULT_ENABLED_TOOLS, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [override, currentVoice, visibility] = await Promise.all([
          getEnabledToolsOverride(),
          getVoiceName(),
          getVisibilitySettings(),
        ]);
        const initialMap: Record<string, boolean> = {};
        if (override && Array.isArray(override)) {
          const set = new Set(override);
          allTools.forEach(t => {
            initialMap[t] = set.has(t);
          });
        } else {
          allTools.forEach(t => {
            initialMap[t] = true;
          });
        }
        setEnabledMap(initialMap);
        setVoice(currentVoice);
        setAskAiVisibility(visibility);
      } catch (err) {
        log.error('Failed to load settings', err);
        const initialMap: Record<string, boolean> = {};
        allTools.forEach(t => {
          initialMap[t] = true;
        });
        setEnabledMap(initialMap);
        setVoice('Aoede');
        setAskAiVisibility({
          hiddenDomains: [],
          hiddenForSession: false,
          permanentlyHidden: false,
        });
      }
    };
    load();
  }, [allTools]);

  const selectedList = useMemo(() => {
    return Object.entries(enabledMap)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }, [enabledMap]);

  const handleToggleTool = async (tool: string) => {
    setEnabledMap(prev => {
      const next = { ...prev, [tool]: !prev[tool] };
      void setEnabledToolsOverride(Object.values(next).every(v => v) ? undefined : Object.entries(next).filter(([, v]) => v).map(([k]) => k));
      return next;
    });
  };

  const handleEnableAll = async () => {
    const next: Record<string, boolean> = {};
    allTools.forEach(t => next[t] = true);
    setEnabledMap(next);
    await setEnabledToolsOverride(undefined); // reset to defaults
  };

  const handleDisableAll = async () => {
    const next: Record<string, boolean> = {};
    allTools.forEach(t => next[t] = false);
    setEnabledMap(next);
    await setEnabledToolsOverride([]); // explicit none
  };

  const handleResetDefaults = async () => {
    await handleEnableAll();
  };

  const handleVoiceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as VoiceName;
    setVoice(value);
    await setVoiceName(value);
  };

  // Ask AI button controls
  const handleToggleGlobalAskAi = async () => {
    const currentlyHidden = askAiVisibility.permanentlyHidden;
    if (currentlyHidden) {
      await reEnableButton();
      await clearSessionHide();
      setAskAiVisibility(prev => ({ ...prev, permanentlyHidden: false, hiddenForSession: false }));
    } else {
      await hideForever();
      setAskAiVisibility(prev => ({ ...prev, permanentlyHidden: true }));
    }
  };

  const handleToggleSessionHide = async () => {
    const next = !askAiVisibility.hiddenForSession;
    if (next) {
      await hideForSession();
    } else {
      await clearSessionHide();
    }
    setAskAiVisibility(prev => ({ ...prev, hiddenForSession: next }));
  };

  const handleRemoveDomain = async (domain: string) => {
    await removeDomainFromHidden(domain);
    setAskAiVisibility(prev => ({
      ...prev,
      hiddenDomains: prev.hiddenDomains.filter(d => d !== domain),
    }));
  };

  const handleClearDomains = async () => {
    await clearAllHiddenDomains();
    setAskAiVisibility(prev => ({ ...prev, hiddenDomains: [] }));
  };

  const handleAddDomain = async () => {
    const domain = newHiddenDomain.trim();
    if (!domain) return;
    try {
      await hideForCurrentPage(`https://${domain}`);
      const vis = await getVisibilitySettings();
      setAskAiVisibility(vis);
      setNewHiddenDomain('');
    } catch (e) {
      log.error('Failed adding hidden domain', e);
    }
  };

  return (
    <div className="features-container">
      {/* Header */}
      <div className="features-header">
        <div className="features-header-content">
          <button
            className="features-back-button"
            onClick={onBack}
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="features-header-text">
            <h1 className="features-title">Settings</h1>
            <p className="features-subtitle">Manage tools, voice, and Ask AI button</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="features-content">
        {/* Voice Settings */}
        <div className="features-category">
          <h2 className="features-category-title">Voice Mode</h2>
          <label htmlFor="voice-select" style={{ display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
            Voice for Gemini Live
          </label>
          <select
            id="voice-select"
            value={voice}
            onChange={handleVoiceChange}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color, #e5e7eb)', background: 'var(--bg, #fff)' }}
          >
            {VOICE_OPTIONS.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Ask AI Button */}
        <div className="features-category">
          <h2 className="features-category-title">Ask AI Button</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <input
              id="askai-global-enabled"
              type="checkbox"
              checked={!askAiVisibility.permanentlyHidden}
              onChange={handleToggleGlobalAskAi}
            />
            <label htmlFor="askai-global-enabled">Show Globally</label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <input
              id="askai-session-hidden"
              type="checkbox"
              checked={askAiVisibility.hiddenForSession}
              onChange={handleToggleSessionHide}
              disabled={askAiVisibility.permanentlyHidden}
            />
            <label htmlFor="askai-session-hidden">Hide for current browser session</label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={handleClearDomains} className="thread-sidepanel-new-button" title="Clear all hidden domains">
              Clear hidden domains
            </button>
            {askAiVisibility.permanentlyHidden ? (
              <button onClick={handleToggleGlobalAskAi} className="thread-sidepanel-new-button" title="Re-enable Ask AI globally">
                Re-enable globally
              </button>
            ) : (
              <button onClick={handleToggleGlobalAskAi} className="thread-sidepanel-new-button" title="Hide Ask AI everywhere">
                Hide everywhere
              </button>
            )}
          </div>

          {/* Hidden domains management */}
          <label htmlFor="askai-add-domain" style={{ display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
            Add domain to hidden list
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              id="askai-add-domain"
              value={newHiddenDomain}
              onChange={(e) => setNewHiddenDomain(e.target.value)}
              placeholder="example.com"
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color, #e5e7eb)' }}
            />
            <button onClick={handleAddDomain} className="thread-sidepanel-new-button" title="Add domain">
              Add
            </button>
          </div>

          {askAiVisibility.hiddenDomains.length === 0 ? (
            <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>No hidden domains</p>
          ) : (
            <div className="thread-sidepanel-list">
              {askAiVisibility.hiddenDomains.map((domain) => (
                <div key={domain} className="thread-sidepanel-item">
                  <div className="thread-sidepanel-item-content">
                    <div className="thread-sidepanel-item-title">{domain}</div>
                    <div className="thread-sidepanel-item-date">Hidden</div>
                  </div>
                  <button
                    className="thread-sidepanel-item-delete"
                    onClick={() => handleRemoveDomain(domain)}
                    title="Remove from hidden"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tools Settings */}
        <div className="features-category">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h2 className="features-category-title" style={{ margin: 0 }}>Enabled Tools</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleEnableAll} className="thread-sidepanel-new-button" title="Enable all tools">Enable All</button>
              <button onClick={handleDisableAll} className="thread-sidepanel-new-button" title="Disable all tools">Disable All</button>
              <button onClick={handleResetDefaults} className="thread-sidepanel-new-button" title="Reset to defaults">Reset</button>
            </div>
          </div>
          <p style={{ fontSize: 12, opacity: 0.8, marginTop: 0, marginBottom: 12 }}>
            Changes apply to new AI sessions. Some running sessions may need a restart to reflect updates.
          </p>

          <div className="thread-sidepanel-list">
            {allTools.map(tool => {
              const enabled = enabledMap[tool] ?? true;
              return (
                <div key={tool} className="thread-sidepanel-item" onClick={() => handleToggleTool(tool)} title={tool} style={{ cursor: 'pointer' }}>
                  <div className="thread-sidepanel-item-content">
                    <div className="thread-sidepanel-item-title">{tool}</div>
                    <div className="thread-sidepanel-item-date">{enabled ? 'Enabled' : 'Disabled'}</div>
                  </div>
                  <div>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => handleToggleTool(tool)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Toggle ${tool}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
            {selectedList.length} of {allTools.length} tools enabled
          </div>
        </div>
      </div>
    </div>
  );
};


