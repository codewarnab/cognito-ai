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

const log = createLogger('AskAiButtonSettings', 'UI_SETTINGS');

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
        <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center mb-1">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 uppercase tracking-wide">
                    <Eye size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Ask AI Button
                </h2>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-visible">
                <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] transition-colors hover:bg-white/5">
                    <div className="flex-1 mr-4">
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Show Globally</div>
                        <div className="text-xs text-[var(--text-secondary)]">Display the Ask AI button on all pages</div>
                    </div>
                    <Toggle
                        checked={!askAiVisibility.permanentlyHidden}
                        onChange={handleToggleGlobalAskAi}
                    />
                </div>

                <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] transition-colors hover:bg-white/5">
                    <div className="flex-1 mr-4">
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Hide for Session</div>
                        <div className="text-xs text-[var(--text-secondary)]">Temporarily hide the button for this browser session</div>
                    </div>
                    <Toggle
                        checked={askAiVisibility.hiddenForSession}
                        onChange={handleToggleSessionHide}
                        disabled={askAiVisibility.permanentlyHidden}
                    />
                </div>

                <div className="block p-0">
                    <button
                        className="w-full flex justify-between items-center p-3 bg-transparent border-none cursor-pointer text-inherit transition-colors hover:bg-white/5"
                        onClick={() => setIsHiddenDomainsOpen(!isHiddenDomainsOpen)}
                    >
                        <div className="text-left">
                            <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Hidden Domains</div>
                            <div className="text-xs text-[var(--text-secondary)]">
                                {askAiVisibility.hiddenDomains.length} domain{askAiVisibility.hiddenDomains.length !== 1 ? 's' : ''} hidden
                            </div>
                        </div>
                        {isHiddenDomainsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {isHiddenDomainsOpen && (
                        <div className="p-3 border-t border-[var(--border-color)]">
                            {askAiVisibility.hiddenDomains.length > 0 ? (
                                <>
                                    <div className="flex flex-col gap-px bg-[var(--border-color)] rounded-lg overflow-hidden mt-2">
                                        {askAiVisibility.hiddenDomains.map((domain) => (
                                            <div key={domain} className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg-tertiary)]">
                                                <span className="text-[13px] text-[var(--text-primary)]">{domain}</span>
                                                <button
                                                    className="bg-transparent border-none text-[var(--text-secondary)] cursor-pointer p-1 rounded flex items-center justify-center hover:text-red-500 hover:bg-red-500/10"
                                                    onClick={() => handleRemoveDomain(domain)}
                                                    title="Remove from hidden"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        <div className="flex gap-2 flex-1">
                                            <input
                                                className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--color-secondary)]"
                                                value={newHiddenDomain}
                                                onChange={(e) => setNewHiddenDomain(e.target.value)}
                                                placeholder="example.com"
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                                            />
                                            <button onClick={handleAddDomain} className="px-3 py-1.5 bg-[var(--color-secondary)] border border-[var(--color-secondary)] rounded-lg text-white text-[13px] font-medium cursor-pointer transition-all hover:opacity-90">
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                        <button onClick={handleClearDomains} className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-red-500/30 rounded-lg text-red-500 text-[13px] font-medium cursor-pointer transition-all hover:bg-red-500/10">
                                            Clear All
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--color-secondary)]"
                                        value={newHiddenDomain}
                                        onChange={(e) => setNewHiddenDomain(e.target.value)}
                                        placeholder="example.com"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                                    />
                                    <button onClick={handleAddDomain} className="px-3 py-1.5 bg-[var(--color-secondary)] border border-[var(--color-secondary)] rounded-lg text-white text-[13px] font-medium cursor-pointer transition-all hover:opacity-90">
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
