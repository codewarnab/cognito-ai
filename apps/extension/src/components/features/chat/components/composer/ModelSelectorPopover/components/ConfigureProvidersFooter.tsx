/**
 * Configure Providers Footer Component
 * 
 * Footer button to open provider configuration in webapp
 */

import React from 'react';
import { Settings2 } from 'lucide-react';
import { WEBAPP_BASE_URL } from '@/constants/webapp';

interface ConfigureProvidersFooterProps {
    onClose: () => void;
}

export const ConfigureProvidersFooter: React.FC<ConfigureProvidersFooterProps> = ({ onClose }) => {
    const handleClick = () => {
        chrome.tabs.create({ url: `${WEBAPP_BASE_URL}/providers` });
        onClose();
    };

    return (
        <div className="border-t border-white/[0.06]">
            <button
                type="button"
                onClick={handleClick}
                className="flex items-center justify-center gap-2 w-full px-3 py-2.5 bg-transparent border-0 cursor-pointer transition-all duration-200 hover:bg-white/[0.04] group"
            >
                <Settings2 size={13} className="text-white/40 group-hover:text-white/60 transition-colors" />
                <span className="text-[11px] font-medium text-white/50 group-hover:text-white/70 transition-colors">
                    Configure Providers
                </span>
            </button>
        </div>
    );
};

export default ConfigureProvidersFooter;
