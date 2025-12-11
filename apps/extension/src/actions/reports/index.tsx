/**
 * Report Generation Actions
 * Tools for generating downloadable reports in various formats
 */

import { useGeneratePDFTool } from './generatePDF';
import { useGetReportTemplateTool } from './getReportTemplate';

export function registerReportActions() {
    useGeneratePDFTool();
    useGetReportTemplateTool();
}

export { useGeneratePDFTool, useGetReportTemplateTool };

