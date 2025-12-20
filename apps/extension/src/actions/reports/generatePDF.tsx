/**
 * Generate PDF Report Action
 * Creates and downloads a PDF file with the provided content
 * Uses LaTeX Online API for professional PDF generation
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '@/ai/tools';
import { useToolUI } from '@/ai/tools/components';
import { createLogger } from '~logger';
import { compileReportContent, getCurrentResearchSessionId, storePDF } from '@/db';
import { generatePDFFromLatex } from './latexUtils';


const log = createLogger('Tool-GeneratePDF', 'TOOLS_EXECUTION');


export function useGeneratePDFTool() {
    const { unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering generatePDF tool...');

        registerTool({
            name: 'generatePDF',
            description: `Generate a professional PDF report using LaTeX formatting and display it as an interactive attachment in chat with Open/Download buttons.

INPUT: LaTeX-formatted content (not markdown). Use LaTeX commands:
- \\\\section{Title}, \\\\subsection{Title} for headers (DO NOT include report title as a section)
- \\\\textbf{text} for bold, \\\\textit{text} for italic
- \\\\begin{itemize} \\\\item ... \\\\end{itemize} for bullets
- \\\\begin{enumerate} \\\\item ... \\\\end{enumerate} for numbered lists
- Standard paragraphs as plain text

TITLE PARAMETER (REQUIRED):
- Pass the research subject as the 'title' parameter (e.g., "codewarnab", "React", "OpenAI")
- Backend will generate a styled header with the title and current date
- DO NOT include \\\\section{Research Report: ...} in content - title is handled separately

LIMITATIONS (LaTeX Online API):
- No \\\\include{} or \\\\input{} - all content must be inline
- No fontawesome package - use standard symbols
- No BibTeX - embed citations directly
- Large documents (>7000 chars) will be automatically chunked and merged
- Escape special chars: # $ % & _ { } ~ ^

Shows error with retry option if LaTeX compilation fails.`,
            parameters: z.object({
                content: z.string().optional().describe('The LaTeX content to render in the PDF. Use LaTeX formatting: \\\\section{}, \\\\textbf{}, \\\\begin{itemize}, etc. DO NOT include a title section - use the title parameter instead. Optional if using compileFromBuffer.'),
                title: z.string().optional().describe('The research subject title (e.g., "codewarnab", "React Framework", "OpenAI"). Will be displayed as a styled header at the top of the PDF. ALWAYS provide this.'),
                filename: z.string()
                    .describe('The filename for the PDF file (without extension). Example: "research-report-2025"')
                    .optional()
                    .default('report'),
                compileFromBuffer: z.boolean().optional().describe('If true, compile content from report sections buffer instead of using content parameter'),
            }),
            execute: async ({ content, title, filename, compileFromBuffer }) => {
                try {
                    let finalContent = content;

                    // If compileFromBuffer is true, get content from IndexedDB sections
                    if (compileFromBuffer) {
                        const sessionId = getCurrentResearchSessionId();
                        if (!sessionId) {
                            return {
                                success: false,
                                error: 'No active research session for compilation'
                            };
                        }

                        finalContent = await compileReportContent(sessionId);

                        if (!finalContent || finalContent.trim().length === 0) {
                            return {
                                success: false,
                                error: 'No report sections found. Call appendToReport() to add sections first.'
                            };
                        }

                        log.info('Compiled report from buffer', {
                            sessionId,
                            contentLength: finalContent.length
                        });
                    }

                    if (!finalContent) {
                        return {
                            success: false,
                            error: 'No content provided. Either pass content directly or use compileFromBuffer: true'
                        };
                    }

                    const actualFilename = filename ?? 'report';
                    log.info('TOOL CALL: generatePDF', {
                        filenameLength: actualFilename.length,
                        contentLength: finalContent.length
                    });


                    // Ensure filename doesn't have extension
                    const cleanFilename = actualFilename.replace(/\.pdf$/i, '');
                    const fullFilename = `${cleanFilename}.pdf`;

                    // Generate PDF using LaTeX Online API
                    log.info('Generating PDF via LaTeX Online API...', { title });
                    const pdfBlob = await generatePDFFromLatex(finalContent, {
                        filename: fullFilename,
                        title
                    });

                    // Store PDF in IndexedDB for persistent access
                    const pdfId = await storePDF(pdfBlob, fullFilename);

                    log.info('✅ PDF generated and stored', {
                        filename: fullFilename,
                        size: pdfBlob.size,
                        pdfId
                    });

                    // Return file data for chat display as interactive attachment
                    return {
                        success: true,
                        filename: fullFilename,
                        message: `✅ PDF report "${fullFilename}" is ready!`,
                        size: pdfBlob.size,
                        // File data for chat display (will be rendered as attachment)
                        // Using pdfId for IndexedDB reference instead of blob URL
                        fileData: {
                            type: 'file',
                            name: fullFilename,
                            pdfId,  // IndexedDB reference
                            mediaType: 'application/pdf',
                            size: pdfBlob.size
                        }
                    };
                } catch (error) {
                    log.error('[Tool] Error generating PDF:', error);

                    // Provide helpful error message for common LaTeX errors
                    let errorMessage = error instanceof Error ? error.message : String(error);

                    if (errorMessage.includes('8000')) {
                        errorMessage = 'Document too large. Try breaking it into smaller sections.';
                    } else if (errorMessage.includes('compilation failed')) {
                        errorMessage = 'LaTeX compilation failed. Check for syntax errors in the LaTeX content.';
                    }

                    return {
                        success: false,
                        error: errorMessage
                    };
                }
            },
        });

        log.info('✅ generatePDF tool registration complete');

        return () => {
            log.info('🧹 Cleaning up generatePDF tool');
            unregisterToolUI('generatePDF');
        };
    }, []);
}
