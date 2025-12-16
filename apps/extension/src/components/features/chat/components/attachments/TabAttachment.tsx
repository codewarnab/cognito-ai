import React from 'react';
import { X } from 'lucide-react';

export interface TabAttachmentData {
    id: string;
    title: string;
    url: string;
    favIconUrl?: string;
}

interface TabAttachmentProps {
    tabs: TabAttachmentData[];
    onRemoveAll: () => void;
}

export const TabAttachment: React.FC<TabAttachmentProps> = ({ tabs, onRemoveAll }) => {
    if (tabs.length === 0) return null;

    const firstTab = tabs[0]!;
    const remainingCount = tabs.length - 1;

    const truncateText = (text: string, maxLength: number = 30) => {
        if (text.length <= maxLength) return text;
        return `${text.substring(0, maxLength)}...`;
    };

    const extractDomain = (url: string) => {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch {
            return url;
        }
    };

    const getAllDomains = () => {
        return tabs.map(tab => extractDomain(tab.url)).join(', ');
    };

    return (
        <div className="relative rounded-[10px] overflow-hidden bg-[rgba(30,40,60,0.6)] border-[1.5px] border-[rgba(100,120,150,0.3)] transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.3)] max-w-[400px] hover:bg-[rgba(40,50,70,0.7)] hover:border-[rgba(120,140,170,0.5)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:-translate-y-px group/tab">
            <div className="flex items-center gap-3 py-[10px] px-[14px] relative">
                {firstTab.favIconUrl ? (
                    <img
                        src={firstTab.favIconUrl}
                        alt=""
                        className="w-5 h-5 rounded shrink-0 object-cover"
                    />
                ) : (
                    <div className="w-5 h-5 rounded bg-[rgba(100,120,150,0.3)] shrink-0" />
                )}
                <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                    <span className="text-[13px] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis leading-[1.3]" title={firstTab.title}>
                        {truncateText(firstTab.title, 25)}
                        {remainingCount > 0 && (
                            <span className="text-xs font-semibold text-blue-500/90 ml-1"> +{remainingCount}</span>
                        )}
                    </span>
                    <span className="text-[11px] text-white/50 whitespace-nowrap overflow-hidden text-ellipsis leading-[1.3]" title={getAllDomains()}>
                        {extractDomain(firstTab.url)}
                        {remainingCount > 0 && tabs[1] && `, ${extractDomain(tabs[1].url)}`}
                        {remainingCount > 1 && '...'}
                    </span>
                </div>
                <button
                    type="button"
                    className="relative bg-transparent border-none rounded-full w-5 h-5 flex items-center justify-center cursor-pointer text-white/60 opacity-60 transition-all duration-200 p-0 shrink-0 group-hover/tab:opacity-100 hover:bg-[rgba(255,50,50,0.3)] hover:text-white/95 hover:!opacity-100"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemoveAll();
                    }}
                    title="Remove all tabs"
                >
                    <X size={14} />
                </button>
            </div>
        </div>

    );
};
