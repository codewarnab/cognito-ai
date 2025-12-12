/**
 * Badge component showing active workflow mode
 * Displays above input field with workflow icon, name, and close button
 */

import type { WorkflowDefinition } from '@/workflows/types';
import { SearchIcon } from '@assets/icons/chat/search';
import { YoutubeIcon } from '@assets/icons/chat/youtube';

interface WorkflowBadgeProps {
    workflow: WorkflowDefinition;
    onClose: () => void;
}

// Helper to render icon (either emoji or component)
function renderWorkflowIcon(icon: string) {
    if (icon === 'search') {
        return <SearchIcon size={16} />;
    }
    if (icon === 'youtube') {
        return <YoutubeIcon size={16} />;
    }
    // Default: treat as emoji
    return <span>{icon}</span>;
}

export function WorkflowBadge({ workflow, onClose }: WorkflowBadgeProps) {
    return (
        <div
            className="absolute bottom-[calc(100%+6px)] left-3 flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] text-[#e0e7ff] rounded-[10px] text-[11px] font-medium shadow-[0_2px_6px_rgba(30,58,138,0.4)] animate-in slide-in-from-bottom-2 fade-in duration-200 z-[100]"
            style={
                workflow.color
                    ? {
                        backgroundColor: workflow.color,
                    }
                    : {}
            }
        >
            <span className="text-[14px] flex items-center justify-center">{renderWorkflowIcon(workflow.icon)}</span>
            <span className="font-semibold tracking-[0.01em]">{workflow.name} Mode</span>
            <button
                className="bg-white/15 border-none text-[#e0e7ff] w-4 h-4 rounded-full flex items-center justify-center cursor-pointer text-sm leading-none transition-colors duration-150 p-0 ml-0.5 hover:bg-white/25 active:bg-white/35"
                onClick={onClose}
                title="Clear workflow mode"
                aria-label="Clear workflow mode"
            >
                ×
            </button>
        </div>
    );
}
