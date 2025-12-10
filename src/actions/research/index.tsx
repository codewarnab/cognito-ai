/**
 * Research Memory Actions
 * Tools for context-optimized research workflow with IndexedDB storage
 * 
 * These tools enable the research workflow to store page content in IndexedDB
 * instead of the AI context window, reducing token usage by ~99%.
 * 
 * Workflow:
 * 1. initResearchSession() - Start a new research session
 * 2. readPageContent() - Auto-stores content to IndexedDB (in research mode)
 * 3. addMemoryMetadata() - Tag source with future-use guideline
 * 4. listResearchSources() - See all sources (metadata only)
 * 5. readResearchMemory() - Load full content on-demand during synthesis
 * 6. appendToReport() - Add sections to report buffer (V2 synthesis phase)
 */

import { useAddMemoryMetadataTool } from './addMemoryMetadata';
import { useReadResearchMemoryTool } from './readResearchMemory';
import { useListResearchSourcesTool } from './listResearchSources';
import { useInitResearchSessionTool } from './initResearchSession';
import { useAppendToReportTool } from './appendToReport';

export function registerResearchMemoryTools() {
    useInitResearchSessionTool();
    useAddMemoryMetadataTool();
    useListResearchSourcesTool();
    useReadResearchMemoryTool();
    useAppendToReportTool();
}

export {
    useAddMemoryMetadataTool,
    useReadResearchMemoryTool,
    useListResearchSourcesTool,
    useInitResearchSessionTool,
    useAppendToReportTool
};
