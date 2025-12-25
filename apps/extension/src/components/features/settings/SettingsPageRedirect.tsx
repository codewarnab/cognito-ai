import React from 'react';
import { ArrowLeft, ExternalLink, Settings } from 'lucide-react';
import { openWebappRoute } from '@/constants/webapp';
import { SocialLinks } from './components/SocialLinks';

interface SettingsPageProps {
    onBack: () => void;
    onProviderSetupClick?: () => void;
}

/**
 * Minimal settings page that redirects to the webapp.
 * All settings management has been moved to the webapp.
 */
export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack, onProviderSetupClick }) => {
    const handleOpenSettings = () => {
        openWebappRoute('SETTINGS');
    };

    const handleOpenProviders = () => {
        if (onProviderSetupClick) {
            onProviderSetupClick();
        } else {
            openWebappRoute('PROVIDERS');
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center p-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] gap-4">
                <button
                    className="bg-transparent border-none text-[var(--text-secondary)] cursor-pointer p-1 rounded-sm flex items-center justify-center transition-colors hover:text-[var(--text-primary)] hover:bg-white/5"
                    onClick={onBack}
                    aria-label="Go back"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold m-0 text-[var(--text-primary)]">Settings</h1>
                    <p className="text-[13px] text-[var(--text-secondary)] mt-0.5 m-0">Manage your preferences</p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/[0.12] [&::-webkit-scrollbar-thumb]:rounded-[3px] hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
                {/* Main Settings Button */}
                <button
                    onClick={handleOpenSettings}
                    className="flex items-center gap-4 p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl cursor-pointer transition-all duration-200 text-left hover:bg-[var(--glass-bg-hover)] hover:border-[var(--glass-border-hover)] hover:-translate-y-0.5 group"
                >
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400">
                        <Settings size={20} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-medium text-[var(--text-primary)] m-0">
                            Open Settings
                        </h3>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1 m-0">
                            Configure AI providers, features, voice, search, and more
                        </p>
                    </div>
                    <ExternalLink size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors" />
                </button>

                {/* Provider Setup Quick Link */}
                <button
                    onClick={handleOpenProviders}
                    className="flex items-center gap-4 p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl cursor-pointer transition-all duration-200 text-left hover:bg-[var(--glass-bg-hover)] hover:border-[var(--glass-border-hover)] hover:-translate-y-0.5 group"
                >
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v4" />
                            <path d="m6.41 6.41 2.83 2.83" />
                            <path d="M2 12h4" />
                            <path d="m6.41 17.59 2.83-2.83" />
                            <path d="M12 18v4" />
                            <path d="m17.59 17.59-2.83-2.83" />
                            <path d="M18 12h4" />
                            <path d="m17.59 6.41-2.83 2.83" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-medium text-[var(--text-primary)] m-0">
                            AI Provider Setup
                        </h3>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1 m-0">
                            Configure Google AI or Vertex AI credentials
                        </p>
                    </div>
                    <ExternalLink size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors" />
                </button>

                {/* Info banner */}
                <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-300/80 m-0 leading-relaxed">
                        Settings are now managed through the Cognito webapp for a better experience.
                        Your preferences sync automatically with the extension.
                    </p>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Social Links */}
                <SocialLinks />
            </div>
        </div>
    );
};
