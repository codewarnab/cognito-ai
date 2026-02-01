/**
 * Configure Providers Footer Component
 * 
 * Footer button to open provider configuration in webapp
 */

import React from 'react';
import { Cloud, Settings2 } from 'lucide-react';
import { WEBAPP_BASE_URL } from '@/constants/webapp';

interface ConfigureProvidersFooterProps {
    onClose: () => void;
    showCloudToggle?: boolean;
    onSwitchToCloudMode?: () => void;
}

export const ConfigureProvidersFooter: React.FC<ConfigureProvidersFooterProps> = ({
    onClose,
    showCloudToggle = false,
    onSwitchToCloudMode,
}) => {
    const handleConfigureClick = () => {
        chrome.tabs.create({ url: `${WEBAPP_BASE_URL}/providers` });
        onClose();
    };

    return (
        <div className="border-t border-white/[0.06] px-2 py-1.5 flex items-center gap-2">
            <button
                type="button"
                onClick={handleConfigureClick}
                className="flex flex-1 items-center justify-center gap-2 px-2.5 py-1.5 bg-transparent cursor-pointer transition-all duration-150 hover:bg-white/[0.04] rounded-lg group"
            >
                <Settings2 size={13} className="text-white/40 group-hover:text-white/60 transition-colors" />
                <span className="text-[11px] font-medium text-white/50 group-hover:text-white/70 transition-colors">
                    Configure Providers
                </span>
            </button>

            {showCloudToggle && onSwitchToCloudMode && (
                <button
                    type="button"
                    onClick={onSwitchToCloudMode}
                    className="shrink-0 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/20 transition-all duration-150 cursor-pointer"
                    aria-label="Switch to Cloud Mode"
                >
                    <Cloud size={13} className="text-violet-400" />
                    <span className="text-[11px] font-medium text-violet-300">Cloud</span>
                </button>
            )}
        </div>
    );
};

export default ConfigureProvidersFooter;
