/**
 * Get Report Template Action
 * Returns an appropriate template structure based on the report type specified by the AI
 * This tool is research workflow-specific
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '../../logger';
import {
    type TemplateType,
    type ReportTemplate,
    getTemplateByType,
    getAvailableTemplateTypes
} from './templates';

const log = createLogger('Tool-GetReportTemplate');

/**
 * Format template as markdown structure
 */
function formatTemplateAsMarkdown(template: ReportTemplate, topicName: string): string {
    let markdown = `# Research Report: ${topicName}\n\n`;
    markdown += `**Template Type:** ${template.name}\n\n`;

    template.sections.forEach((section) => {
        markdown += `## ${section.title}\n\n`;

        if (section.description) {
            markdown += `${section.description}\n\n`;
        }

        if (section.bullet && section.items) {
            section.items.forEach((item) => {
                markdown += `- ${item}\n`;
            });
            markdown += '\n';
        }
    });

    return markdown;
}

export function useGetReportTemplateTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering getReportTemplate tool...');

        // Get available template types for schema
        const availableTypes = getAvailableTemplateTypes();
        const templateTypeDescriptions = availableTypes
            .map(t => `- "${t.type}": ${t.description}`)
            .join('\n');

        registerTool({
            name: 'getReportTemplate',
            description: `Get an appropriate report template structure based on the research topic type. You must determine what type of research this is and specify the reportType parameter.

Available template types:
${templateTypeDescriptions}

Call this BEFORE starting research to get the proper structure for gathering information.`,
            parameters: z.object({
                reportType: z.enum(['person', 'technology', 'company', 'concept', 'product', 'generic'])
                    .describe('The type of research report. Choose based on what you are researching: "person" for people/developers, "technology" for frameworks/libraries/tools, "company" for businesses/startups, "concept" for methodologies/practices, "product" for SaaS/apps/services, "generic" for anything else'),
                topicName: z.string()
                    .describe('The name/title of the research topic (e.g., "codewarnab", "React", "OpenAI", "Microservices")')
                    .optional(),
            }),
            execute: async ({ reportType, topicName }) => {
                try {
                    log.info('TOOL CALL: getReportTemplate', {
                        reportType,
                        topicName
                    });

                    // Get the template for the specified type
                    const template = getTemplateByType(reportType as TemplateType);

                    // Use provided topic name or generic placeholder
                    const topic = topicName || 'Research Topic';

                    // Format template structure
                    const templateMarkdown = formatTemplateAsMarkdown(template, topic);

                    log.info('✅ Template selected', {
                        reportType,
                        templateName: template.name,
                        sectionCount: template.sections.length
                    });

                    return {
                        success: true,
                        reportType,
                        templateName: template.name,
                        sections: template.sections,
                        sectionCount: template.sections.length,
                        markdownStructure: templateMarkdown,
                        message: `📋 Selected template: **${template.name}**\n\nThis template has **${template.sections.length} sections** to guide your research. Follow this structure when gathering information.`
                    };
                } catch (error) {
                    log.error('[Tool] Error getting report template:', error);

                    // Fallback to generic template
                    const fallbackTemplate = getTemplateByType('generic');
                    const topic = topicName || 'Research Topic';
                    const templateMarkdown = formatTemplateAsMarkdown(fallbackTemplate, topic);

                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                        reportType: 'generic',
                        templateName: fallbackTemplate.name,
                        sections: fallbackTemplate.sections,
                        sectionCount: fallbackTemplate.sections.length,
                        markdownStructure: templateMarkdown,
                        message: 'Error occurred, using generic template as fallback'
                    };
                }
            },
        });

        log.info('✅ getReportTemplate tool registration complete');

        return () => {
            log.info('🧹 Cleaning up getReportTemplate tool');
            unregisterToolUI('getReportTemplate');
        };
    }, []);
}

