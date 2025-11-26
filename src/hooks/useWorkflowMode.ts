import { useState, useCallback } from 'react';
import { replaceSlashCommand } from '@/utils/chat';
import { validateYouTubeToNotionPrerequisites } from '../workflows/definitions/youtubeToNotionWorkflow';
import type { WorkflowDefinition } from '../workflows/types';

interface UseWorkflowModeOptions {
    input: string;
    setInput: (value: string) => void;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
}

export const useWorkflowMode = ({ input, setInput, onError }: UseWorkflowModeOptions) => {
    const [activeWorkflow, setActiveWorkflow] = useState<WorkflowDefinition | null>(null);
    const [showSlashDropdown, setShowSlashDropdown] = useState(false);
    const [slashSearchQuery, setSlashSearchQuery] = useState('');

    // Handle workflow selection from slash command dropdown
    const handleSelectWorkflow = useCallback(async (workflow: WorkflowDefinition) => {
        // Validate prerequisites for YouTube to Notion workflow
        if (workflow.id === 'youtube-to-notion') {
            const validation = await validateYouTubeToNotionPrerequisites();
            if (!validation.valid) {
                // Show error toast with validation message
                onError?.(validation.error || 'Prerequisites not met', 'error');
                setShowSlashDropdown(false);
                return;
            }
        }

        setActiveWorkflow(workflow);
        setShowSlashDropdown(false);

        // Clear the slash command from input
        const cursorPos = input.length;
        const result = replaceSlashCommand(input, cursorPos, workflow.id);
        setInput(result.newText);
    }, [input, setInput, onError]);

    // Handle clearing workflow mode
    const handleClearWorkflow = useCallback(() => {
        setActiveWorkflow(null);
    }, []);

    // Handle slash command detection from MentionInput
    const handleSlashCommandDetection = useCallback((isSlash: boolean, searchQuery: string) => {
        if (isSlash) {
            setSlashSearchQuery(searchQuery);
            setShowSlashDropdown(true);
        } else {
            setShowSlashDropdown(false);
        }
    }, []);

    return {
        activeWorkflow,
        showSlashDropdown,
        slashSearchQuery,
        handleSelectWorkflow,
        handleClearWorkflow,
        handleSlashCommandDetection,
    };
};
