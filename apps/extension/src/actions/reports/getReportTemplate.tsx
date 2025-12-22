/**
 * Get Report Template Action
 * Returns an appropriate template structure based on the report type specified by the AI
 * This tool is research workflow-specific
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '@/ai/tools';
import { useToolUI } from '@/ai/tools/components';
import type { ToolUIState } from '@/ai/tools/components';
import { CompactToolRenderer } from '@/ai/tools/components';
import { createLogger } from '~logger';
import {
    type TemplateType,
    type ReportTemplate,
    getTemplateByType,
    getAvailableTemplateTypes,
    getTemplateForSourceCount,
    isDeepDiveMode,
    DEEP_DIVE_THRESHOLD
} from './templates/index';
import { getMinimumSources } from '@/utils/settings/researchWorkflowSettings';

const log = createLogger('Tool-GetReportTemplate', 'TOOLS_EXECUTION');

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

    // Add footer note encouraging open-ended discovery
    markdown += `---\n\n`;
    markdown += `> **NOTE:** You are encouraged to add new sections if you find critical information that doesn't fit the template. The template is a guide, not a cage. Follow the data and be creative in your analysis.\n\n`;

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
                    // Fetch minimum sources setting for dynamic template adjustment
                    const minimumSources = await getMinimumSources();
                    const isDeepDive = isDeepDiveMode(minimumSources);

                    log.info('TOOL CALL: getReportTemplate', {
                        reportType,
                        topicName,
                        minimumSources,
                        isDeepDive
                    });

                    // Get template with sections adjusted based on minimum sources
                    // If minimumSources >= DEEP_DIVE_THRESHOLD (6), deep dive sections are merged
                    const template = getTemplateForSourceCount(reportType as TemplateType, minimumSources);

                    // Use provided topic name or generic placeholder
                    const topic = topicName || 'Research Topic';

                    // Format template structure
                    const templateMarkdown = formatTemplateAsMarkdown(template, topic);

                    log.info('✅ Template selected', {
                        reportType,
                        templateName: template.name,
                        sectionCount: template.sections.length,
                        isDeepDive,
                        minimumSources
                    });

                    // Build detail level message
                    const detailLevelInfo = isDeepDive
                        ? `🔬 **Deep Dive Mode** (${minimumSources} sources configured - includes extended analysis sections)`
                        : `📊 **Standard Mode** (${minimumSources} sources - use ${DEEP_DIVE_THRESHOLD}+ for deep dive)`;

                    return {
                        success: true,
                        reportType,
                        templateName: template.name,
                        sections: template.sections,
                        sectionCount: template.sections.length,
                        markdownStructure: templateMarkdown,
                        isDeepDive,
                        minimumSources,
                        message: `📋 Selected template: **${template.name}**\n\n${detailLevelInfo}\n\nThis template has **${template.sections.length} sections** to guide your research. Follow this structure when gathering information.`
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

        // Register UI with custom renderers
        registerToolUI('getReportTemplate', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
            renderInput: (input: any) => (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                }}>
                    {input.reportType && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>Report Type:</span>
                            <span style={{
                                fontSize: '11px',
                                padding: '3px 8px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                textTransform: 'capitalize',
                                color: 'var(--text-primary)'
                            }}>
                                {input.reportType}
                            </span>
                        </div>
                    )}
                    {input.topicName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>Topic:</span>
                            <span style={{
                                fontSize: '12px',
                                color: 'var(--text-primary)',
                                fontWeight: 500
                            }}>
                                {input.topicName}
                            </span>
                        </div>
                    )}
                </div>
            ),
            renderOutput: (output: any) => (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                }}>
                    {output.success && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7 }}>Template:</span>
                                <span style={{
                                    fontSize: '12px',
                                    color: 'var(--text-primary)',
                                    fontWeight: 500
                                }}>
                                    {output.templateName}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7 }}>Sections:</span>
                                <span style={{
                                    fontSize: '11px',
                                    padding: '2px 6px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '3px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    {output.sectionCount} sections
                                </span>
                            </div>
                            {output.sections && output.sections.length > 0 && (
                                <div style={{
                                    marginTop: '2px',
                                    fontSize: '10px',
                                    opacity: 0.6
                                }}>
                                    {output.sections.map((section: any) => section.title).join(' • ')}
                                </div>
                            )}
                        </>
                    )}
                    {output.error && (
                        <div style={{
                            fontSize: '11px',
                            color: 'var(--error-color)',
                            opacity: 0.9
                        }}>
                            {output.error}
                        </div>
                    )}
                </div>
            )
        });

        log.info('✅ getReportTemplate tool registration complete');

        return () => {
            log.info('🧹 Cleaning up getReportTemplate tool');
            unregisterToolUI('getReportTemplate');
        };
    }, [registerToolUI, unregisterToolUI]);
}


