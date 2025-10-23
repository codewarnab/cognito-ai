/**
 * Report Generation Actions
 * Tools for generating downloadable reports in various formats
 */

import { useGenerateMarkdownTool } from './generateMarkdown';
import { useGeneratePDFTool } from './generatePDF';

export function registerReportActions() {
    useGenerateMarkdownTool();
    useGeneratePDFTool();
}

export { useGenerateMarkdownTool, useGeneratePDFTool };
