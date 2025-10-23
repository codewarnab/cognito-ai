// Central registry for all workflows

import type { WorkflowDefinition } from './types';

const workflows = new Map<string, WorkflowDefinition>();

/**
 * Register a workflow in the central registry
 */
export function registerWorkflow(workflow: WorkflowDefinition): void {
    workflows.set(workflow.id, workflow);
}

/**
 * Get a specific workflow by ID
 */
export function getWorkflow(id: string): WorkflowDefinition | undefined {
    return workflows.get(id);
}

/**
 * Get all registered workflows
 */
export function getAllWorkflows(): WorkflowDefinition[] {
    return Array.from(workflows.values());
}

/**
 * Check if a workflow exists
 */
export function hasWorkflow(id: string): boolean {
    return workflows.has(id);
}

/**
 * Clear all workflows (mainly for testing)
 */
export function clearWorkflows(): void {
    workflows.clear();
}
