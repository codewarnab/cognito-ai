/**
 * TabAttachment Component
 * 
 * Renders tab context attachments in chat messages.
 * Shows the tab's title, URL, favicon, and any extraction errors.
 * 
 * Tab attachments represent browser tabs that were included as
 * context for the AI conversation.
 */

import React from 'react';

interface TabAttachmentProps {
    /** All tab-context parts from the message */
    tabParts: any[];
    /** Index of current part being rendered */
    partIndex: number;
}

/**
 * Renders grouped tab attachments with proper styling
 * 
 * Behavior:
 * - Only renders on the FIRST tab part (groups all tabs together)
 * - Shows "+N" badge when multiple tabs are attached
 * - Displays favicon, title, and URL for primary tab
 * - Shows warning if content extraction failed
 * 
 * @example
 * ```tsx
 * <TabAttachment
 *   tabParts={message.parts.filter(p => p.type === 'tab-context')}
 *   partIndex={0}
 * />
 * ```
 */
export const TabAttachment: React.FC<TabAttachmentProps> = ({
    tabParts,
    partIndex,
}) => {
    // Calculate tab counts and get first tab
    const totalTabs = tabParts.length;
    const firstTab = tabParts[0];
    const remainingCount = totalTabs - 1;

    return (
        <div key={`tab-group-${partIndex}`} className="relative inline-block my-2">
            {/* Tab info card */}
            <div className="flex items-center gap-3 px-3.5 py-3 bg-blue-500/8 border border-blue-500/25 rounded-lg transition-all duration-200 relative z-[1] hover:bg-blue-500/12 hover:border-blue-500/40">
                {/* Favicon or fallback globe icon */}
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    {firstTab.favicon ? (
                        <img
                            src={firstTab.favicon}
                            alt=""
                            className="w-5 h-5 rounded object-contain"
                        />
                    ) : (
                        <div className="w-5 h-5 flex items-center justify-center text-base opacity-70">
                            🌐
                        </div>
                    )}
                </div>

                {/* Tab title and URL */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    {/* Tab title - truncated with tooltip */}
                    <div
                        className="text-[13px] font-semibold text-white/95 whitespace-nowrap overflow-hidden text-ellipsis"
                        title={firstTab.title}
                    >
                        {firstTab.title}
                    </div>

                    {/* Tab URL - truncated with tooltip */}
                    <div
                        className="text-[11px] text-white/60 whitespace-nowrap overflow-hidden text-ellipsis"
                        title={firstTab.url}
                    >
                        {firstTab.url}
                    </div>

                    {/* Error message if content extraction failed */}
                    {firstTab.error && (
                        <div className="text-[11px] text-[rgba(255,150,50,0.9)] font-medium mt-0.5">
                            ⚠️ {firstTab.error}
                        </div>
                    )}
                </div>
            </div>

            {/* Badge showing additional tab count */}
            {remainingCount > 0 && (
                <div className="absolute -top-1.5 -right-1.5 bg-blue-500/95 text-white text-[11px] font-bold px-2 py-1 rounded-xl border-2 border-[rgba(30,40,60,0.9)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] z-[2] min-w-[24px] text-center">
                    +{remainingCount}
                </div>
            )}
        </div>
    );
};
