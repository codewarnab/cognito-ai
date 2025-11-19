/**
 * Generate PDF Report Action
 * Creates and downloads a PDF file with the provided content
 * Uses jsPDF library for reliable PDF generation
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '~logger';

const log = createLogger('Tool-GeneratePDF');

/**
 * Clean and sanitize text for PDF rendering
 * Removes emojis and special characters that jsPDF can't render
 */
function sanitizeText(text: string): string {
    // Comprehensive emoji removal covering all Unicode emoji ranges
    return text
        // Main emoji blocks
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
        .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical Symbols
        .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric Shapes Extended
        .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Supplemental Arrows-C
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
        .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
        .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
        .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
        .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
        .replace(/[\u{2300}-\u{23FF}]/gu, '')   // Misc Technical
        .replace(/[\u{2B50}-\u{2B55}]/gu, '')   // Stars and other symbols
        .replace(/[\u{3030}]/gu, '')            // Wavy dash
        .replace(/[\u{3297}\u{3299}]/gu, '')    // Circled ideographs
        // Flags (Regional Indicator Symbols)
        .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '') // Flag emojis
        // Skin tone modifiers
        .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '') // Skin tone modifiers
        // Keycap sequences
        .replace(/[\u{20E3}]/gu, '')            // Combining Enclosing Keycap
        // Zero-width joiners and variation selectors (used in emoji sequences)
        .replace(/[\u{200D}]/gu, '')            // Zero Width Joiner
        .replace(/[\u{FE0F}]/gu, '')            // Variation Selector-16
        .replace(/[\u{FE00}-\u{FEFF}]/gu, '')   // All Variation Selectors
        // Additional symbol ranges that might cause issues
        .replace(/[\u{2190}-\u{21FF}]/gu, '')   // Arrows
        .replace(/[\u{2900}-\u{297F}]/gu, '')   // Supplemental Arrows-B
        .replace(/[\u{2B00}-\u{2BFF}]/gu, '')   // Misc Symbols and Arrows
        // Remove any remaining high-plane characters that jsPDF might not support
        .replace(/[\u{10000}-\u{10FFFF}]/gu, '') // Supplementary planes
        .trim();
}

/**
 * Parse markdown and generate PDF using jsPDF
 */
function generatePDF(content: string): Blob {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    // Page dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Helper to add new page if needed
    const checkAddPage = (requiredSpace: number = 10) => {
        if (yPosition + requiredSpace > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
            return true;
        }
        return false;
    };

    // Helper to render text with bold support
    const renderTextWithFormatting = (text: string, leftMargin: number = margin) => {
        // Clean the text first
        text = sanitizeText(text);

        if (!text.trim()) return;

        // Check if text contains bold markers
        if (text.includes('**')) {
            const parts = text.split('**');
            const lines: Array<{ text: string; isBold: boolean }[]> = [[]];
            let currentLine = 0;

            // Build formatted segments
            parts.forEach((part, i) => {
                if (!part) return;
                const isBold = i % 2 === 1;
                if (!lines[currentLine]) {
                    lines[currentLine] = [];
                }
                lines[currentLine].push({ text: part, isBold });
            });

            // Render each line with proper formatting
            lines.forEach((lineSegments) => {
                let xOffset = leftMargin;
                checkAddPage(7);

                lineSegments.forEach((segment) => {
                    doc.setFont('helvetica', segment.isBold ? 'bold' : 'normal');

                    // Split long text into chunks that fit
                    const words = segment.text.split(' ');
                    words.forEach((word, idx) => {
                        const textToRender = idx === words.length - 1 ? word : word + ' ';
                        const textWidth = doc.getTextWidth(textToRender);

                        // Check if we need to wrap
                        if (xOffset + textWidth > pageWidth - margin && xOffset > leftMargin) {
                            yPosition += 6;
                            xOffset = leftMargin;
                            checkAddPage(7);
                        }

                        doc.text(textToRender, xOffset, yPosition);
                        xOffset += textWidth;
                    });
                });

                yPosition += 6;
            });

            doc.setFont('helvetica', 'normal');
        } else {
            // Regular text without formatting
            const splitText = doc.splitTextToSize(text, maxWidth - (leftMargin - margin));
            splitText.forEach((textLine: string) => {
                checkAddPage(7);
                doc.text(textLine, leftMargin, yPosition);
                yPosition += 6;
            });
        }
    };

    // Parse and render markdown content
    const lines = content.split('\n');

    lines.forEach((line) => {
        // Clean the line
        const originalLine = line;
        line = sanitizeText(line);

        // Skip empty lines but add spacing
        if (!line.trim()) {
            yPosition += 3;
            return;
        }

        // Check for page break
        checkAddPage(15);

        // Headers
        if (originalLine.startsWith('### ')) {
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            const text = line.replace(/^### /, '').replace(/^###/, '');
            yPosition += 4;
            const splitText = doc.splitTextToSize(text, maxWidth);
            splitText.forEach((textLine: string) => {
                checkAddPage(7);
                doc.text(textLine, margin, yPosition);
                yPosition += 7;
            });
            yPosition += 2;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
        } else if (originalLine.startsWith('## ')) {
            doc.setFontSize(15);
            doc.setFont('helvetica', 'bold');
            const text = line.replace(/^## /, '').replace(/^##/, '');
            yPosition += 6;
            const splitText = doc.splitTextToSize(text, maxWidth);
            splitText.forEach((textLine: string) => {
                checkAddPage(8);
                doc.text(textLine, margin, yPosition);
                yPosition += 8;
            });
            doc.setDrawColor(30, 58, 138);
            doc.setLineWidth(0.5);
            doc.line(margin, yPosition, pageWidth - margin, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
        } else if (originalLine.startsWith('# ')) {
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            const text = line.replace(/^# /, '').replace(/^#/, '');
            yPosition += 2;
            const splitText = doc.splitTextToSize(text, maxWidth);
            splitText.forEach((textLine: string) => {
                checkAddPage(10);
                doc.text(textLine, margin, yPosition);
                yPosition += 10;
            });
            doc.setDrawColor(30, 58, 138);
            doc.setLineWidth(0.8);
            doc.line(margin, yPosition, pageWidth - margin, yPosition);
            yPosition += 8;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
        }
        // Bullet points
        else if (originalLine.match(/^\s*[-*]\s+/) || originalLine.match(/^\s*\d+\.\s+/)) {
            doc.setFontSize(11);
            const indent = margin + 5;
            const bulletMatch = originalLine.match(/^\s*([-*]|\d+\.)\s+/);
            const bullet = bulletMatch?.[1] ?? '-';
            const text = line.replace(/^\s*[-*]\s+/, '').replace(/^\s*\d+\.\s+/, '');

            // Draw bullet
            doc.setFont('helvetica', 'normal');
            doc.text(bullet === '-' || bullet === '*' ? '•' : bullet, margin, yPosition);

            // Render text with formatting support
            renderTextWithFormatting(text, indent);
        }
        // Text with bold formatting
        else if (line.includes('**')) {
            doc.setFontSize(11);
            renderTextWithFormatting(line, margin);
        }
        // Regular paragraph
        else {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            const splitText = doc.splitTextToSize(line, maxWidth);
            splitText.forEach((textLine: string) => {
                checkAddPage(7);
                doc.text(textLine, margin, yPosition);
                yPosition += 6;
            });
        }
    });

    // Return as blob
    return doc.output('blob');
}

export function useGeneratePDFTool() {
    const { unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering generatePDF tool...');

        registerTool({
            name: 'generatePDF',
            description: 'Generate a PDF file and display it as an interactive attachment in chat with Open/Download buttons. Uses jsPDF library for reliable PDF generation.',
            parameters: z.object({
                content: z.string().describe('The content to save in the PDF (markdown format supported: headers, bold text, paragraphs)'),
                filename: z.string()
                    .describe('The filename for the PDF file (without extension). Example: "research-report-2025"')
                    .optional()
                    .default('report'),
            }),
            execute: async ({ content, filename }) => {
                try {
                    const actualFilename = filename ?? 'report';
                    log.info('TOOL CALL: generatePDF', {
                        filenameLength: actualFilename.length,
                        contentLength: content.length
                    });

                    // Ensure filename doesn't have extension
                    const cleanFilename = actualFilename.replace(/\.pdf$/i, '');
                    const fullFilename = `${cleanFilename}.pdf`;

                    // Generate PDF blob
                    const pdfBlob = generatePDF(content);

                    // Create a blob URL for chat display (no auto-download)
                    const chatUrl = URL.createObjectURL(pdfBlob);

                    log.info('✅ PDF generated as attachment', {
                        filename: fullFilename,
                        size: pdfBlob.size
                    });

                    // Return file data for chat display as interactive attachment
                    return {
                        success: true,
                        filename: fullFilename,
                        message: `✅ PDF report "${fullFilename}" is ready!`,
                        size: pdfBlob.size,
                        // File data for chat display (will be rendered as attachment)
                        // Note: Blob URL should NOT be revoked here; chat UI manages lifecycle
                        fileData: {
                            type: 'file',
                            name: fullFilename,
                            url: chatUrl,
                            mediaType: 'application/pdf',
                            size: pdfBlob.size
                        }
                    };
                } catch (error) {
                    log.error('[Tool] Error generating PDF:', error);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
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


