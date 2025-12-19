/**
 * LaTeX Utilities for PDF Generation
 * 
 * Phase 2: Uses backend API for LaTeX compilation.
 * Backend handles all chunking, API calls, and PDF merging.
 */

import { createLogger } from '~logger';
import { ENV } from '@/utils/env';

const log = createLogger('LaTeX-Utils', 'TOOLS_EXECUTION');

// ============================================================================
// Special Character Escaping
// ============================================================================

/**
 * Characters that need escaping in LaTeX
 */
const LATEX_SPECIAL_CHARS: Record<string, string> = {
    '#': '\\#',
    '$': '\\$',
    '%': '\\%',
    '&': '\\&',
    '_': '\\_',
    '{': '\\{',
    '}': '\\}',
    '~': '\\textasciitilde{}',
    '^': '\\textasciicircum{}',
};

/**
 * Escape special LaTeX characters in user-provided text
 * 
 * @param text - Text to escape
 * @returns Text with LaTeX special characters escaped
 */
export function escapeLatex(text: string): string {
    // Escape backslash first (to avoid double-escaping)
    let escaped = text.replace(/\\/g, '\\textbackslash{}');

    // Then escape other special characters
    for (const [char, replacement] of Object.entries(LATEX_SPECIAL_CHARS)) {
        escaped = escaped.replace(new RegExp(`\\${char}`, 'g'), replacement);
    }

    return escaped;
}

// ============================================================================
// Backend API Compilation
// ============================================================================

/**
 * Generate PDF from LaTeX content via backend API
 * 
 * Backend handles all complexity:
 * - Wrapping content in LaTeX document
 * - Chunking large documents at section boundaries
 * - Compiling via LaTeX Online API
 * - Merging multiple PDFs for large documents
 * 
 * @param latexContent - LaTeX body content (will be wrapped by backend)
 * @param filename - Optional filename for the PDF
 * @returns PDF blob
 */
export async function generatePDFFromLatex(
    latexContent: string,
    filename = 'report.pdf'
): Promise<Blob> {
    log.info('Sending LaTeX to backend for compilation', {
        contentLength: latexContent.length,
        filename,
    });

    const response = await fetch(`${ENV.BACKEND_API_URL}/latex-compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            latexContent,
            command: 'pdflatex',
            filename,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        log.error('Backend LaTeX compilation failed', {
            status: response.status,
            error
        });
        throw new Error(error.message || 'LaTeX compilation failed');
    }

    const pdfBlob = await response.blob();

    log.info('PDF received from backend', {
        size: pdfBlob.size,
    });

    return pdfBlob;
}
