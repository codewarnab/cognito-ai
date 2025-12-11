import React, { useEffect, useState } from 'react';
import { Eye, ChevronUp, ChevronDown, Plus, X } from 'lucide-react';
import { createLogger } from '~logger';
import type { VisibilitySettings } from '@/utils/settings/ask-ai-button-visibility';
import {
    getVisibilitySettings,
    reEnableButton,
    hideForever,
    hideForSession,
    clearSessionHide,
    clearAllHiddenDomains,
    removeDomainFromHidden,
    hideForCurrentPage,
} from '@/utils/settings';
import { Toggle } from '../../../shared/inputs/Toggle';

const log = createLogger('AskAiButtonSettings');

export const AskAiButtonSettings: React.FC = () => {
    const [askAiVisibility, setAskAiVisibility] = useState<VisibilitySettings>({
        hiddenDomains: [],
        hiddenForSession: false,
        permanentlyHidden: false,
    });
    const [newHiddenDomain, setNewHiddenDomain] = useState('');
    const [isHiddenDomainsOpen, setIsHiddenDomainsOpen] = useState(false);

    useEffect(() => {
        const loadVisibility = async () => {
            try {
                const visibility = await getVisibilitySettings();
                setAskAiVisibility(visibility);
            } catch (err) {
                log.error('Failed to load visibility settings', err);
            }
        };
        loadVisibility();
    }, []);

    const handleToggleGlobalAskAi = async (checked: boolean) => {
        if (checked) {
            await reEnableButton();
            await clearSessionHide();
            setAskAiVisibility(prev => ({ ...prev, permanentlyHidden: false, hiddenForSession: false }));
        } else {
            await hideForever();
            setAskAiVisibility(prev => ({ ...prev, permanentlyHidden: true }));
        }
    };

    const handleToggleSessionHide = async (checked: boolean) => {
        if (checked) {
            await hideForSession();
        } else {
            await clearSessionHide();
        }
        setAskAiVisibility(prev => ({ ...prev, hiddenForSession: checked }));
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
        let input = newHiddenDomain.trim();
        if (!input) return;
        
        try {
            // If user didn't include protocol, add it for URL parsing
            if (!input.startsWith('http://') && !input.startsWith('https://')) {
                input = `https://${input}`;
            }
            
            // Use hideForCurrentPage which will extract the hostname properly
            await hideForCurrentPage(input);
            const vis = await getVisibilitySettings();
            setAskAiVisibility(vis);
            setNewHiddenDomain('');
        } catch (e) {
            log.error('Failed adding hidden domain', e);
        }
    };

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2 className="settings-section-title">
                    <Eye size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Ask AI Button
                </h2>
            </div>
            <div className="settings-card">
                <div className="settings-item">
                    <div className="settings-item-content">
                        <div className="settings-item-title">Show Globally</div>
                        <div className="settings-item-description">Display the Ask AI button on all pages</div>
                    </div>
                    <Toggle
                        checked={!askAiVisibility.permanentlyHidden}
                        onChange={handleToggleGlobalAskAi}
                    />
                </div>

                <div className="settings-item">
                    <div className="settings-item-content">
                        <div className="settings-item-title">Hide for Session</div>
                        <div className="settings-item-description">Temporarily hide the button for this browser session</div>
                    </div>
                    <Toggle
                        checked={askAiVisibility.hiddenForSession}
                        onChange={handleToggleSessionHide}
                        disabled={askAiVisibility.permanentlyHidden}
                    />
                </div>

                <div className="settings-item" style={{ display: 'block', padding: 0 }}>
                    <button
                        className="settings-item-header-button"
                        onClick={() => setIsHiddenDomainsOpen(!isHiddenDomainsOpen)}
                        style={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'inherit'
                        }}
                    >
                        <div style={{ textAlign: 'left' }}>
                            <div className="settings-item-title">Hidden Domains</div>
                            <div className="settings-item-description">
                                {askAiVisibility.hiddenDomains.length} domain{askAiVisibility.hiddenDomains.length !== 1 ? 's' : ''} hidden
                            </div>
                        </div>
                        {isHiddenDomainsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {isHiddenDomainsOpen && (
                        <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                            {askAiVisibility.hiddenDomains.length > 0 ? (
                                <>
                                    <div className="hidden-domains-list">
                                        {askAiVisibility.hiddenDomains.map((domain) => (
                                            <div key={domain} className="hidden-domain-item">
                                                <span className="hidden-domain-name">{domain}</span>
                                                <button
                                                    className="hidden-domain-remove"
                                                    onClick={() => handleRemoveDomain(domain)}
                                                    title="Remove from hidden"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                        <div className="settings-input-group" style={{ flex: 1 }}>
                                            <input
                                                className="settings-input"
                                                value={newHiddenDomain}
                                                onChange={(e) => setNewHiddenDomain(e.target.value)}
                                                placeholder="example.com"
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                                            />
                                            <button onClick={handleAddDomain} className="settings-button primary">
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                        <button onClick={handleClearDomains} className="settings-button danger">
                                            Clear All
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="settings-input-group">
                                    <input
                                        className="settings-input"
                                        value={newHiddenDomain}
                                        onChange={(e) => setNewHiddenDomain(e.target.value)}
                                        placeholder="example.com"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                                    />
                                    <button onClick={handleAddDomain} className="settings-button primary">
                                        <Plus size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
