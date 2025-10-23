/**
 * Badge component showing active workflow mode
 * Displays above input field with workflow icon, name, and close button
 */

import React from 'react';
import type { WorkflowDefinition } from '../../workflows/types';
import { SearchIcon } from '../../../assets/chat/search';

interface WorkflowBadgeProps {
    workflow: WorkflowDefinition;
    onClose: () => void;
}

// Helper to render icon (either emoji or component)
function renderWorkflowIcon(icon: string) {
    if (icon === 'search') {
        return <SearchIcon size={16} />;
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
                        background: `linear-gradient(135deg, ${workflow.color} 0%, ${adjustColor(workflow.color, -20)} 100%)`,
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

// Helper to adjust color brightness
function adjustColor(color: string, percent: number): string {
    // Simple color adjustment (works for hex colors)
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
        '#' +
        (
            0x1000000 +
            (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)
        )
            .toString(16)
            .slice(1)
    );
}
