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
    onRemove: (id: string) => void;
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
        <div className="tab-attachment">
            <div className="tab-attachment-content">
                {firstTab.favIconUrl ? (
                    <img
                        src={firstTab.favIconUrl}
                        alt=""
                        className="tab-attachment-favicon"
                    />
                ) : (
                    <div className="tab-attachment-favicon-placeholder" />
                )}
                <div className="tab-attachment-info">
                    <span className="tab-attachment-title" title={firstTab.title}>
                        {truncateText(firstTab.title, 25)}
                        {remainingCount > 0 && (
                            <span className="tab-attachment-count"> +{remainingCount}</span>
                        )}
                    </span>
                    <span className="tab-attachment-url" title={getAllDomains()}>
                        {extractDomain(firstTab.url)}
                        {remainingCount > 0 && tabs[1] && `, ${extractDomain(tabs[1].url)}`}
                        {remainingCount > 1 && '...'}
                    </span>
                </div>
                <button
                    type="button"
                    className="tab-attachment-remove"
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
