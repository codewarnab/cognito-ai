/**
 * Append To Report Tool
 * Incrementally builds report by adding sections to IndexedDB buffer
 * 
 * Part of V2 Context Reset architecture - enables section-by-section
 * report building during synthesis phase.
 */

import { useEffect } from 'react';
import { z } from 'zod';
import { registerTool } from '@/ai/tools';
import {
    appendReportSection,
    getCurrentResearchSessionId,
    getReportSections
} from '@/db';
import { createLogger } from '~logger';

const log = createLogger('Tool-AppendToReport');

export function useAppendToReportTool() {
    useEffect(() => {
        log.info('🔧 Registering appendToReport tool...');

        registerTool({
            name: 'appendToReport',
            description: `Add a section to the report being built.

USE: During synthesis phase to build report incrementally, section by section.
REQUIRES: Active research session.
BEHAVIOR: Stores the section content in IndexedDB buffer for later compilation.
RETURNS: Confirmation with section ID and current section count.

WORKFLOW:
1. Read a source with readResearchMemory()
2. Extract/synthesize relevant information
3. Call appendToReport() with the section content
4. The source content can now be "forgotten" - it's captured in the report
5. Repeat for each section
6. Call generatePDF({ compileFromBuffer: true }) to compile all sections

PARAMETERS:
- sectionName: Name of the template section (e.g., "Overview", "Key Features")
- content: The section content in markdown format
- sourceIds: Array of sourceIds used for this section (for citation tracking)

EXAMPLE:
appendToReport({
    sectionName: "Key Features",
    content: "## Key Features\\n\\nThe technology offers several compelling features:\\n\\n1. **Performance** - Up to 10x faster...\\n\\n2. **Scalability** - Handles millions of requests...",
    sourceIds: ["research_source_1", "research_source_3"]
})`,

            parameters: z.object({
                sectionName: z.string().describe('Name of the report section (should match template sections)'),
                content: z.string().describe('Section content in markdown format'),
                sourceIds: z.array(z.string()).optional().describe('Source IDs used for this section (for citation tracking)'),
            }),

            execute: async ({ sectionName, content, sourceIds }) => {
                try {
                    const sessionId = getCurrentResearchSessionId();

                    if (!sessionId) {
                        log.warn('No active research session');
                        return {
                            success: false,
                            error: 'No active research session. Cannot append to report.'
                        };
                    }

                    const result = await appendReportSection({
                        sessionId,
                        sectionName,
                        content,
                    });

                    // Get current section count
                    const allSections = await getReportSections(sessionId);

                    log.info('Appended report section', {
                        sessionId,
                        sectionName,
                        sectionId: result.sectionId,
                        order: result.order,
                        contentLength: content.length,
                        sourceIds,
                        totalSections: allSections.length,
                    });

                    return {
                        success: true,
                        sectionId: result.sectionId,
                        sectionName,
                        order: result.order,
                        contentLength: content.length,
                        totalSectionsInReport: allSections.length,
                        sectionsAdded: allSections.map(s => s.sectionName),
                        message: `Added "${sectionName}" as section ${result.order}. Total sections: ${allSections.length}. Continue adding sections or call generatePDF({ compileFromBuffer: true }) when ready.`
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    log.error('Failed to append report section', { sectionName, error: message });
                    return {
                        success: false,
                        error: message
                    };
                }
            }
        });

        log.info('✅ appendToReport tool registration complete');

        return () => {
            log.debug('Cleanup: appendToReport tool');
        };
    }, []);
}
