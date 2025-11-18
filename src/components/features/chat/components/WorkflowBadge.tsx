/**
 * Badge component showing active workflow mode
 * Displays above input field with workflow icon, name, and close button
 */

import type { WorkflowDefinition } from '../../../../workflows/types';
import { SearchIcon } from '../../../../../assets/chat/search';
import { YoutubeIcon } from '../../../../../assets/chat/youtube';

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
            className="workflow-badge"
            style={
                workflow.color
                    ? {
                        backgroundColor: workflow.color,
                    }
                    : {}
            }
        >
            <span className="workflow-badge-icon">{renderWorkflowIcon(workflow.icon)}</span>
            <span className="workflow-badge-name">{workflow.name} Mode</span>
            <button
                className="workflow-badge-close"
                onClick={onClose}
                title="Clear workflow mode"
                aria-label="Clear workflow mode"
            >
                ×
            </button>
        </div>
    );
}
