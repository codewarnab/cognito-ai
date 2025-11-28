import React from 'react';
import { WorkflowBadge } from '../../badges/WorkflowBadge';
import { SlashCommandDropdown } from '@/components/features/chat/dropdowns/SlashCommandDropdown';
import type { WorkflowDefinition } from '@/workflows/types';
import type { AIMode } from '../../../types';

interface WorkflowSectionProps {
    activeWorkflow: WorkflowDefinition | null;
    showSlashDropdown: boolean;
    slashSearchQuery: string;
    handleSelectWorkflow: (workflow: WorkflowDefinition) => void;
    handleClearWorkflow: () => void;
    handleSlashCommandDetection: (show: boolean, query: string) => void;
    mode: AIMode;
}

/**
 * Section displaying workflow badge and slash command dropdown.
 */
export const WorkflowSection: React.FC<WorkflowSectionProps> = ({
    activeWorkflow,
    showSlashDropdown,
    slashSearchQuery,
    handleSelectWorkflow,
    handleClearWorkflow,
    handleSlashCommandDetection,
    mode
}) => {
    return (
        <>
            {/* Workflow Badge - shows when workflow is active */}
            {activeWorkflow && (
                <WorkflowBadge
                    workflow={activeWorkflow}
                    onClose={handleClearWorkflow}
                />
            )}

            {/* Slash Command Dropdown */}
            {showSlashDropdown && !activeWorkflow && (
                <SlashCommandDropdown
                    searchQuery={slashSearchQuery}
                    onSelectWorkflow={handleSelectWorkflow}
                    onClose={() => handleSlashCommandDetection(false, '')}
                    mode={mode}
                />
            )}
        </>
    );
};

