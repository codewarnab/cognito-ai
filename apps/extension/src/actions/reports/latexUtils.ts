/**
 * LaTeX Utilities for PDF Generation
 * 
 * Provides utilities for:
 * - LaTeX content validation and sanitization
 * - Calling LaTeX Online API for PDF compilation
 * - Chunking large documents and merging PDFs
 */

import { PDFDocument } from 'pdf-lib';
import { createLogger } from '~logger';

const log = createLogger('LaTeX-Utils', 'TOOLS_EXECUTION');

// ============================================================================
// Configuration
// ============================================================================

const LATEX_ONLINE_API = 'https://latexonline.cc/compile';
const CHUNK_SIZE_LIMIT = 5000; // ~5000 chars → ~7500 URL chars after encoding (safe under 8KB nginx limit)
const MAX_RETRIES = 2;

// ============================================================================
// LaTeX Document Template
// ============================================================================

/**
 * Standard LaTeX preamble for reports
 */
const LATEX_PREAMBLE = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage{geometry}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{graphicx}
\\usepackage{amsmath}

\\geometry{margin=1in}
\\hypersetup{colorlinks=true,linkcolor=blue,urlcolor=blue}

`;

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
    '\\': '\\textbackslash{}',
};

/**
 * Escape special LaTeX characters in user-provided text
 * 
 * @param text - Text to escape
 * @returns Text with LaTeX special characters escaped
 */
export function escapeLatex(text: string): string {
    let escaped = text;

    // Escape backslash first (to avoid double-escaping)
    escaped = escaped.replace(/\\/g, '\\textbackslash{}');

    // Then escape other special characters
    for (const [char, replacement] of Object.entries(LATEX_SPECIAL_CHARS)) {
        if (char !== '\\') {
            escaped = escaped.replace(new RegExp(`\\${char}`, 'g'), replacement);
        }
    }

    return escaped;
}

// ============================================================================
// Content Validation
// ============================================================================

/**
 * Validate LaTeX content length for API limits
 * 
 * @param latex - LaTeX content to validate
 * @returns Validation result with error message if invalid
 */
export function validateLatexLength(latex: string): { valid: boolean; error?: string } {
    if (latex.length > 8000) {
        return {
            valid: false,
            error: `LaTeX content exceeds 8000 character limit (${latex.length} chars). Consider using chunking.`
        };
    }
    return { valid: true };
}

/**
 * Check if LaTeX content needs chunking
 * 
 * @param latexContent - LaTeX content to check
 * @returns True if content exceeds chunk size limit
 */
export function needsChunking(latexContent: string): boolean {
    return latexContent.length > CHUNK_SIZE_LIMIT;
}

// ============================================================================
// Content Sanitization
// ============================================================================

/**
 * Remove unsupported packages and features for LaTeX Online
 */
const UNSUPPORTED_PATTERNS = [
    /\\usepackage\{fontawesome\}/g,
    /\\usepackage\{fontawesome5\}/g,
    /\\include\{[^}]+\}/g,
    /\\input\{[^}]+\}/g,
    /\\bibliography\{[^}]+\}/g,
    /\\bibliographystyle\{[^}]+\}/g,
];

/**
 * Sanitize LaTeX content for LaTeX Online API compatibility
 * 
 * @param latex - LaTeX content to sanitize
 * @returns Sanitized LaTeX content
 */
export function sanitizeForLatexOnline(latex: string): string {
    let sanitized = latex;

    for (const pattern of UNSUPPORTED_PATTERNS) {
        sanitized = sanitized.replace(pattern, '% Removed: unsupported by LaTeX Online');
    }

    // Remove problematic Unicode characters and emojis
    sanitized = sanitized
        // Main emoji blocks
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
        .replace(/[\u{1FA00}-\u{1FAFF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
        // High-plane characters
        .replace(/[\u{10000}-\u{10FFFF}]/gu, '');

    return sanitized;
}

// ============================================================================
// Document Wrapping
// ============================================================================

/**
 * Wrap LaTeX content in a complete document
 * 
 * @param content - LaTeX body content
 * @param title - Optional document title
 * @returns Complete LaTeX document string
 */
export function wrapInLatexDocument(content: string, title?: string): string {
    const titleSection = title
        ? `\\title{${escapeLatex(title)}}\n\\maketitle\n\n`
        : '';

    return `${LATEX_PREAMBLE}\\begin{document}
${titleSection}${content}
\\end{document}`;
}

// ============================================================================
// LaTeX Online API Compilation
// ============================================================================

/**
 * Compile LaTeX content to PDF using LaTeX Online API
 * 
 * @param latex - Complete LaTeX document string
 * @param retryCount - Current retry attempt (internal use)
 * @returns PDF blob on success
 * @throws Error if compilation fails after retries
 */
export async function compileLatexToPDF(latex: string, retryCount = 0): Promise<Blob> {
    // Validate length
    const validation = validateLatexLength(latex);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Sanitize content
    const sanitized = sanitizeForLatexOnline(latex);

    log.info('Compiling LaTeX to PDF', {
        contentLength: sanitized.length,
        retry: retryCount,
    });

    const encodedLatex = encodeURIComponent(sanitized);
    const apiUrl = `${LATEX_ONLINE_API}?text=${encodedLatex}&command=pdflatex`;

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`LaTeX compilation failed: ${response.status} - ${errorText}`);
        }

        const pdfBlob = await response.blob();

        // Verify we got a PDF
        if (!pdfBlob.type.includes('pdf') && pdfBlob.size < 100) {
            const text = await pdfBlob.text();
            throw new Error(`LaTeX compilation returned invalid PDF: ${text.substring(0, 200)}`);
        }

        log.info('LaTeX compilation successful', {
            pdfSize: pdfBlob.size,
        });

        return pdfBlob;

    } catch (error) {
        log.error('LaTeX compilation error', { error, retry: retryCount });

        // Retry on failure
        if (retryCount < MAX_RETRIES) {
            log.info('Retrying LaTeX compilation', { attempt: retryCount + 1 });
            return compileLatexToPDF(latex, retryCount + 1);
        }

        throw error;
    }
}

// ============================================================================
// Document Chunking
// ============================================================================

/**
 * Split LaTeX content into chunks at section boundaries
 * Each chunk is wrapped as a complete LaTeX document
 * 
 * @param fullLatex - Complete LaTeX document
 * @returns Array of complete LaTeX document chunks
 */
export function splitLatexIntoChunks(fullLatex: string): string[] {
    // Extract content between \begin{document} and \end{document}
    const bodyMatch = fullLatex.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    if (!bodyMatch) {
        // Not a full document, treat as body content
        return [wrapInLatexDocument(fullLatex)];
    }

    const body = bodyMatch[1] ?? '';

    // Split at section boundaries
    const sectionPattern = /(?=\\section\{)/g;
    const sections = body.split(sectionPattern).filter(s => s.trim());

    if (sections.length === 0) {
        return [fullLatex];
    }

    // Group sections into chunks under the size limit
    const chunks: string[] = [];
    let currentChunk = '';

    for (const section of sections) {
        const testChunk = currentChunk + section;
        const wrappedTest = wrapInLatexDocument(testChunk);

        if (wrappedTest.length > CHUNK_SIZE_LIMIT && currentChunk) {
            // Current chunk is full, save it and start new one
            chunks.push(wrapInLatexDocument(currentChunk));
            currentChunk = section;
        } else {
            currentChunk = testChunk;
        }
    }

    // Don't forget the last chunk
    if (currentChunk) {
        chunks.push(wrapInLatexDocument(currentChunk));
    }

    log.info('Split LaTeX into chunks', {
        originalLength: fullLatex.length,
        chunkCount: chunks.length,
        chunkSizes: chunks.map(c => c.length),
    });

    return chunks;
}

// ============================================================================
// PDF Merging
// ============================================================================

/**
 * Merge multiple PDF blobs into a single PDF using pdf-lib
 * 
 * @param pdfBlobs - Array of PDF blobs to merge
 * @returns Single merged PDF blob
 */
export async function mergePDFs(pdfBlobs: Blob[]): Promise<Blob> {
    if (pdfBlobs.length === 0) {
        throw new Error('No PDFs to merge');
    }

    if (pdfBlobs.length === 1) {
        return pdfBlobs[0]!;
    }

    log.info('Merging PDFs', { count: pdfBlobs.length });

    const mergedPdf = await PDFDocument.create();

    for (const blob of pdfBlobs) {
        const arrayBuffer = await blob.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();

    log.info('PDF merge complete', {
        totalPages: mergedPdf.getPageCount(),
        size: mergedBytes.length,
    });

    // Convert Uint8Array to ArrayBuffer for Blob constructor compatibility
    return new Blob([mergedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

/**
 * Compile multiple LaTeX chunks and merge into a single PDF
 * 
 * @param chunks - Array of complete LaTeX document strings
 * @param onProgress - Optional progress callback
 * @returns Merged PDF blob
 */
export async function compileAndMergeChunks(
    chunks: string[],
    onProgress?: (current: number, total: number) => void
): Promise<Blob> {
    log.info('Compiling and merging chunks', { chunkCount: chunks.length });

    const pdfBlobs: Blob[] = [];

    for (let i = 0; i < chunks.length; i++) {
        onProgress?.(i + 1, chunks.length);

        log.info(`Compiling chunk ${i + 1}/${chunks.length}`);
        const pdf = await compileLatexToPDF(chunks[i]!);
        pdfBlobs.push(pdf);
    }

    return await mergePDFs(pdfBlobs);
}

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generate PDF from LaTeX content with automatic chunking for large documents
 * 
 * @param latexContent - LaTeX body content (will be wrapped in document)
 * @param title - Optional document title
 * @returns PDF blob
 */
export async function generatePDFFromLatex(
    latexContent: string,
    title?: string
): Promise<Blob> {
    const fullLatex = wrapInLatexDocument(latexContent, title);

    if (needsChunking(fullLatex)) {
        log.info('Large document detected, using chunking', {
            totalLength: fullLatex.length,
        });
        const chunks = splitLatexIntoChunks(fullLatex);
        return await compileAndMergeChunks(chunks);
    } else {
        return await compileLatexToPDF(fullLatex);
    }
}
