// Workflow system types and interfaces

export interface WorkflowDefinition {
    id: string;
    name: string;
    description: string;
    icon: string; // Icon identifier: emoji or icon name like 'search', 'debug', etc.
    allowedTools: string[]; // List of tool names this workflow can use
    systemPrompt: string; // Custom system prompt for this workflow
    color?: string; // Optional theme color
    stepCount?: number; // Optional step count limit (defaults to 10 if not specified)
    comingSoon?: boolean; // Optional flag to mark workflow as coming soon
}

import type { ModelMessage } from 'ai';

export interface WorkflowToolCall {
    toolName: string;
    args: Record<string, any>;
}

export interface WorkflowStepResult {
    toolCalls: WorkflowToolCall[];
    [key: string]: any;
}

export interface PrepareStepContext {
    stepNumber: number;
    steps: WorkflowStepResult[];
    messages: ModelMessage[];
}

export interface PrepareStepResult {
    activeTools?: string[];
    messages?: ModelMessage[];
    system?: string;
}
