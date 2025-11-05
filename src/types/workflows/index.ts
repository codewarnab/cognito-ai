/**
 * Workflow types
 */

// TODO: Define workflow-specific types when implementing workflow features
export interface WorkflowStep {
    id: string;
    name: string;
    type: string;
    config?: Record<string, unknown>;
}

export interface Workflow {
    id: string;
    name: string;
    steps: WorkflowStep[];
    metadata?: Record<string, unknown>;
}
