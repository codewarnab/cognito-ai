/**
 * Report Sections API (For Incremental Report Building)
 */

import { db } from './database';
import type { ReportSection } from './types';

let reportSectionCounter = 0;

/**
 * Reset section counter (call when new session starts)
 */
export function resetReportSectionCounter(): void {
    reportSectionCounter = 0;
}

/**
 * Append a section to the report buffer
 */
export async function appendReportSection(params: {
    sessionId: string;
    sectionName: string;
    content: string;
}): Promise<{ sectionId: string; order: number }> {
    reportSectionCounter++;
    const sectionId = `section_${reportSectionCounter}`;

    await db.reportSections.put({
        id: sectionId,
        sessionId: params.sessionId,
        sectionName: params.sectionName,
        content: params.content,
        order: reportSectionCounter,
        createdAt: Date.now(),
    });

    return { sectionId, order: reportSectionCounter };
}

/**
 * Get all report sections for a session (ordered)
 */
export async function getReportSections(sessionId: string): Promise<ReportSection[]> {
    const sections = await db.reportSections
        .where('sessionId')
        .equals(sessionId)
        .toArray();

    return sections.sort((a, b) => a.order - b.order);
}

/**
 * Clear report sections for a session
 */
export async function clearReportSections(sessionId: string): Promise<void> {
    await db.reportSections
        .where('sessionId')
        .equals(sessionId)
        .delete();
    reportSectionCounter = 0;
}

/**
 * Compile all sections into final report content
 */
export async function compileReportContent(sessionId: string): Promise<string> {
    const sections = await getReportSections(sessionId);

    if (sections.length === 0) {
        return '';
    }

    return sections
        .map(s => `## ${s.sectionName}\n\n${s.content}`)
        .join('\n\n---\n\n');
}
