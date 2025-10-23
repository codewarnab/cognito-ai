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
}

export interface WorkflowMode {
    workflowId: string;
    workflow: WorkflowDefinition;
}

export interface WorkflowResult {
    success: boolean;
    output: string; // Markdown-formatted output
    metadata?: {
        sourcesVisited?: string[];
        timeElapsed?: number;
        stepsCompleted?: number;
    };
}

export interface WorkflowMessage {
    role: 'user' | 'assistant';
    content: string;
    metadata?: {
        workflow?: string;
        originalCommand?: string;
    };
}
