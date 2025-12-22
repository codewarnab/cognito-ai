/**
 * Report Templates - Shared Type Definitions
 * Core interfaces for the modular template system
 */

/**
 * Represents a single section within a report template
 */
export interface TemplateSection {
    /** Section heading title */
    title: string;
    /** Optional description for narrative/paragraph sections */
    description?: string;
    /** Whether this section should be rendered as bullet points */
    bullet?: boolean;
    /** Bullet point items for structured sections */
    items?: string[];
}

/**
 * Main report template structure
 */
export interface ReportTemplate {
    /** Display name of the template */
    name: string;
    /** Brief description of what this template is for */
    description: string;
    /** Core sections included in standard reports (3-5 sources) */
    sections: TemplateSection[];
    /** Additional sections for deep-dive reports (6+ sources) */
    deepDiveSections?: TemplateSection[];
}

/**
 * Available template types
 */
export type TemplateType = 'person' | 'technology' | 'company' | 'concept' | 'product' | 'generic';

/**
 * Template definition with metadata
 */
export interface TemplateDefinition {
    type: TemplateType;
    name: string;
    description: string;
}
