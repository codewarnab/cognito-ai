/**
 * Report Generation Actions
 * Tools for generating downloadable reports in various formats
 */

import { useGenerateMarkdownTool } from './generateMarkdown';
import { useGeneratePDFTool } from './generatePDF';
import { useGetReportTemplateTool } from './getReportTemplate';

export function registerReportActions() {
    useGenerateMarkdownTool();
    useGeneratePDFTool();
    useGetReportTemplateTool();
}

export { useGenerateMarkdownTool, useGeneratePDFTool, useGetReportTemplateTool };

