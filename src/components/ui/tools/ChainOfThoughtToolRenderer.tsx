/**
 * ChainOfThoughtToolRenderer - Custom renderer for YouTube to Notion workflow
 * 
 * Subscribes to progressStore and displays real-time progress updates
 * with collapsible Chain of Thought UI
 */

import { useState, useEffect, memo } from 'react';
import { ExternalLink, Info, AlertCircle } from 'lucide-react';
import { Notion } from '@assets/brands/integrations/Notion';
import { YoutubeIcon } from '@assets/icons/chat/youtube';
import { YouTubeTranscriptIcon } from '@assets/icons/chat/youtube-transcipt';
import { VideoScanIcon, VideoSearchIcon, VideoTagIcon } from '@assets/icons/chat/videotype-detection';
import { QuestionPlanner, AnswerWriter, NotionPageWriter } from '@assets/icons/chat/youtube-notion-agent-icons';
import { progressStore } from '@ai/agents/youtubeToNotion/progressStore';
import type { ProgressUpdate } from '@ai/agents/youtubeToNotion/progressTypes';
import type { ToolUIState } from '@ai/tools/components';
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

// Array of video detection icons to cycle through
const VIDEO_DETECTION_ICONS = [VideoScanIcon, VideoSearchIcon, VideoTagIcon] as const;

// Helper to determine icon based on step type/status
const getStepIcon = (step: ProgressUpdate, cycleIndex: number) => {
    const title = step.title.toLowerCase();

    // Use icon based on type
    switch (step.type) {
        case 'page-created':
            return Notion;
        case 'analysis':
            // Cycle through icons if active, otherwise use first icon
            return step.status === 'active'
                ? VIDEO_DETECTION_ICONS[cycleIndex]
                : VideoScanIcon;
        case 'planning':
            return QuestionPlanner;
        case 'info':
            return Info;
        case 'error':
            return AlertCircle;
        default:
            // Fallback based on title keywords if type is missing
            if (title.includes('transcript') || title.includes('fetching')) return YouTubeTranscriptIcon;
            if (title.includes('video type') || title.includes('analyzing')) {
                // Cycle through icons if active, otherwise use first icon
                return step.status === 'active'
                    ? VIDEO_DETECTION_ICONS[cycleIndex]
                    : VideoScanIcon;
            }
            if (title.includes('question') || title.includes('planning')) return QuestionPlanner;
            if (title.includes('answer') || title.includes('generating')) return AnswerWriter;
            if (title.includes('page') || title.includes('creating')) return NotionPageWriter;
            if (title.includes('notion')) return Notion;
            if (title.includes('youtube')) return YoutubeIcon;
            return undefined; // Let ChainOfThoughtStep use default
    }
};

export const ChainOfThoughtToolRenderer = memo(({ state }: ChainOfThoughtToolRendererProps) => {
    const [steps, setSteps] = useState<ProgressUpdate[]>([]);
    const [isOpen, setIsOpen] = useState(true);
    const [videoIconIndex, setVideoIconIndex] = useState(0);

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

    // Cycle through video detection icons when analysis is active
    useEffect(() => {
        const hasActiveAnalysis = steps.some(
            step => step.status === 'active' &&
                (step.type === 'analysis' || step.title.toLowerCase().includes('analyzing'))
        );

        if (hasActiveAnalysis) {
            const interval = setInterval(() => {
                setVideoIconIndex(prev => (prev + 1) % 3);
            }, 200); // Cycle every 800ms

            return () => clearInterval(interval);
        }

        return undefined;
    }, [steps]);

    // Get user-friendly workflow name
    const getWorkflowDisplayName = (toolName: string) => {
        const nameMap: Record<string, string> = {
            'youtubeToNotionAgent': 'Generating notes...',
        };

        return nameMap[toolName] || toolName;
    };

    return (
        <ChainOfThought open={isOpen} onOpenChange={setIsOpen}>
            <ChainOfThoughtHeader>
                {getWorkflowDisplayName(state.toolName)}
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
                        icon={getStepIcon(step, videoIconIndex)}
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
                        label=" Workflow completed successfully!"
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
