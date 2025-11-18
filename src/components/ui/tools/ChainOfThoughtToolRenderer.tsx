/**
 * ChainOfThoughtToolRenderer - Custom renderer for YouTube to Notion workflow
 * 
 * Subscribes to progressStore and displays real-time progress updates
 * with collapsible Chain of Thought UI
 */

import { useState, useEffect, memo } from 'react';
import { ExternalLink } from 'lucide-react';
import { progressStore } from '../../../ai/agents/youtubeToNotion/progressStore';
import type { ProgressUpdate } from '../../../ai/agents/youtubeToNotion/progressTypes';
import type { ToolUIState } from '../../../ai/tools/components';
import {
    ChainOfThought,
    ChainOfThoughtHeader,
    ChainOfThoughtContent,
    ChainOfThoughtStep,
    ChainOfThoughtBadge
} from './ChainOfThought';

interface ChainOfThoughtToolRendererProps {
    state: ToolUIState;
}

export const ChainOfThoughtToolRenderer = memo(({ state }: ChainOfThoughtToolRendererProps) => {
    const [steps, setSteps] = useState<ProgressUpdate[]>([]);
    const [isOpen, setIsOpen] = useState(true);

    useEffect(() => {
        console.log('[ChainOfThought] Mounting, setting up subscription');

        // Subscribe to progress updates
        const unsubscribe = progressStore.subscribe(() => {
            // Always update with latest steps - no need to filter by workflow ID
            // since only one YouTube to Notion workflow runs at a time
            const allSteps = progressStore.getAll();
            const workflowId = progressStore.getCurrentWorkflowId();
            console.log('[ChainOfThought] Progress update received', {
                count: allSteps.length,
                workflowId,
                steps: allSteps.map(s => s.title)
            });
            setSteps(allSteps);
        });

        // Load existing steps immediately
        const allSteps = progressStore.getAll();
        const workflowId = progressStore.getCurrentWorkflowId();
        console.log('[ChainOfThought] Initial load', {
            count: allSteps.length,
            workflowId,
            steps: allSteps.map(s => s.title)
        });
        setSteps(allSteps);

        return () => {
            console.log('[ChainOfThought] Unmounting, unsubscribing');
            unsubscribe();
        };
    }, []);

    // Auto-expand when workflow is executing
    useEffect(() => {
        if (state.state === 'input-streaming' || state.state === 'input-available') {
            setIsOpen(true);
        }
    }, [state.state]);

    return (
        <ChainOfThought open={isOpen} onOpenChange={setIsOpen}>
            <ChainOfThoughtHeader>
                {state.toolName}
            </ChainOfThoughtHeader>

            <ChainOfThoughtContent>
                {steps.length === 0 && (
                    <ChainOfThoughtStep
                        status="active"
                        label="Initializing workflow..."
                    />
                )}

                {steps.map(step => (
                    <ChainOfThoughtStep
                        key={step.id}
                        status={step.status}
                        label={step.title}
                        description={step.data?.videoType ? `Type: ${step.data.videoType}` : undefined}
                    >
                        {/* Show Notion page link */}
                        {step.data?.url && (
                            <a href={step.data.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink size={12} />
                                Open in Notion
                            </a>
                        )}

                        {/* Show confidence badge for analysis */}
                        {step.data?.confidence !== undefined && (
                            <ChainOfThoughtBadge variant="info">
                                {(step.data.confidence * 100).toFixed(0)}% confidence
                            </ChainOfThoughtBadge>
                        )}

                        {/* Show count badge for planning */}
                        {step.data?.count !== undefined && (
                            <ChainOfThoughtBadge variant="secondary">
                                {step.data.count} {step.data.count === 1 ? 'item' : 'items'}
                            </ChainOfThoughtBadge>
                        )}

                        {/* Show error message */}
                        {step.data?.error && (
                            <ChainOfThoughtBadge variant="error">
                                {step.data.error}
                            </ChainOfThoughtBadge>
                        )}
                    </ChainOfThoughtStep>
                ))}

                {/* Show completion message */}
                {state.state === 'output-available' && state.output?.success && (
                    <ChainOfThoughtStep
                        status="complete"
                        label="✨ Workflow completed successfully!"
                    >
                        {state.output.mainPageUrl && (
                            <a href={state.output.mainPageUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink size={12} />
                                View all pages in Notion
                            </a>
                        )}
                    </ChainOfThoughtStep>
                )}

                {/* Show error state */}
                {state.state === 'output-available' && !state.output?.success && (
                    <ChainOfThoughtStep
                        status="error"
                        label="Workflow failed"
                        description={state.output?.error || state.errorText || 'An unknown error occurred'}
                    />
                )}
            </ChainOfThoughtContent>
        </ChainOfThought>
    );
});

ChainOfThoughtToolRenderer.displayName = 'ChainOfThoughtToolRenderer';
