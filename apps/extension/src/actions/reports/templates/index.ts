/**
 * Report Templates Module
 * 
 * Modular template system that supports:
 * - Multiple template types (person, technology, company, concept, product, generic)
 * - Dynamic detail levels based on minimum sources setting
 * - Deep dive sections for extended research (6+ sources)
 */

import type { ReportTemplate, TemplateType, TemplateSection, TemplateDefinition } from './types';
import {
    personTemplate,
    technologyTemplate,
    companyTemplate,
    conceptTemplate,
    productTemplate,
    genericTemplate
} from './definitions';

// Re-export types for convenience
export type { ReportTemplate, TemplateType, TemplateSection, TemplateDefinition };

/**
 * Registry of all available templates
 */
const REPORT_TEMPLATES: Record<TemplateType, ReportTemplate> = {
    person: personTemplate,
    technology: technologyTemplate,
    company: companyTemplate,
    concept: conceptTemplate,
    product: productTemplate,
    generic: genericTemplate
};

/**
 * Get a template by type
 * 
 * @param type - The template type to retrieve
 * @returns The corresponding report template, or generic if type not found
 */
export function getTemplateByType(type: TemplateType): ReportTemplate {
    return REPORT_TEMPLATES[type] || REPORT_TEMPLATES.generic;
}

/**
 * Get all available template types with descriptions
 * 
 * @returns Array of template definitions with type, name, and description
 */
export function getAvailableTemplateTypes(): TemplateDefinition[] {
    return Object.entries(REPORT_TEMPLATES).map(([type, template]) => ({
        type: type as TemplateType,
        name: template.name,
        description: template.description
    }));
}

/**
 * Threshold for deep dive mode (minimum sources required)
 */
export const DEEP_DIVE_THRESHOLD = 6;

/**
 * Get a template with sections adjusted based on minimum sources
 * 
 * @param type - The template type to retrieve
 * @param minimumSources - The configured minimum sources setting
 * @returns Template with sections merged based on source count
 */
export function getTemplateForSourceCount(type: TemplateType, minimumSources: number): ReportTemplate {
    const template = getTemplateByType(type);

    // If below threshold or no deep dive sections, return standard template
    if (minimumSources < DEEP_DIVE_THRESHOLD || !template.deepDiveSections?.length) {
        return template;
    }

    // Merge deep dive sections into main sections
    // Insert before "Sources Visited" section if it exists, otherwise append
    const sourcesIndex = template.sections.findIndex(s =>
        s.title.toLowerCase().includes('sources')
    );

    const mergedSections: TemplateSection[] = sourcesIndex >= 0
        ? [
            ...template.sections.slice(0, sourcesIndex),
            ...template.deepDiveSections,
            ...template.sections.slice(sourcesIndex)
        ]
        : [...template.sections, ...template.deepDiveSections];

    return {
        ...template,
        sections: mergedSections,
        // Clear deepDiveSections since they're now merged
        deepDiveSections: undefined
    };
}

/**
 * Check if a source count qualifies for deep dive mode
 * 
 * @param minimumSources - The configured minimum sources
 * @returns Whether deep dive sections should be included
 */
export function isDeepDiveMode(minimumSources: number): boolean {
    return minimumSources >= DEEP_DIVE_THRESHOLD;
}

// Legacy export for backwards compatibility
export const REPORT_TEMPLATES_MAP = REPORT_TEMPLATES;
