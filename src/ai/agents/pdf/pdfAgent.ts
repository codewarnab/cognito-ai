/**
 * PDF Document Analysis Agent
 * Specialized agent that uses Gemini's native PDF understanding capabilities
 * Supports URL-based PDFs only. Local files must be uploaded via attachment icon.
 */

import { generateText, tool } from 'ai';
import { z } from 'zod';
import { createLogger } from '~logger';
import { ExternalServiceError, NetworkError, parseError } from '../../../errors';
import { isPdfUrl } from '../../../utils/pdfDetector';
import { initializeModel } from '../../core/modelFactory';

const log = createLogger('PDF-Agent');

/**
 * Check if a path/URL is a local file
 */
function isLocalFile(path: string): boolean {
    return path.startsWith('file://') || path.startsWith('blob:');
}

/**
 * Extract PDF metadata if possible
 * This is a basic implementation - can be enhanced later
 */
async function getPdfMetadata(pdfUrl: string): Promise<{ title?: string; pageCount?: number } | undefined> {
    try {
        // Try to extract title from URL
        const urlObj = new URL(pdfUrl);
        const pathname = urlObj.pathname;
        const filename = pathname.split('/').pop();

        if (filename && filename.endsWith('.pdf')) {
            // Remove .pdf extension and decode URI components
            const title = decodeURIComponent(filename.replace('.pdf', ''));
            log.info('Extracted title from URL', { title });
            return { title };
        }

        return undefined;
    } catch (error) {
        log.warn('Could not extract PDF metadata', error);
        return undefined;
    }
}

/**
 * Get PDF URL from active tab if not provided
 */
async function getPdfUrlFromActiveTab(): Promise<string | undefined> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url) {
            log.warn('No active tab or URL found');
            return undefined;
        }

        if (isPdfUrl(tab.url)) {
            log.info('PDF URL detected in active tab', { url: tab.url });
            return tab.url;
        }

        log.info('Active tab is not a PDF', { url: tab.url });
        return undefined;
    } catch (error) {
        log.error('Error getting PDF URL from active tab', error);
        return undefined;
    }
}

/**
 * Analyze a PDF document using Gemini's URL context tool
 * @param pdfUrl - The URL of the PDF document
 * @param question - The question to ask about the PDF
 * @param metadata - Optional metadata about the PDF
 * @returns The analysis result
 */
async function analyzePdfDocument(
    pdfUrl: string,
    question: string,
    metadata?: { title?: string; pageCount?: number }
): Promise<string> {
    try {
        log.info('📄 Analyzing PDF document', {
            pdfUrl,
            question
        });

        // Initialize model using provider-aware factory (respects Vertex AI or Google AI selection)
        const { model, provider, providerInstance } = await initializeModel('gemini-2.5-flash', 'remote');

        log.info('✅ Model initialized with provider:', provider);

        // Validate PDF URL
        if (!isPdfUrl(pdfUrl)) {
            throw new Error('The provided URL does not appear to be a PDF document');
        }

        // Build the prompt that includes the PDF URL
        const metadataInfo = metadata?.title ? `Document: ${metadata.title}\n` : '';
        const pageInfo = metadata?.pageCount ? `Pages: ${metadata.pageCount}\n` : '';

        const prompt = `You are a specialized PDF document analysis expert.

${metadataInfo}${pageInfo}
Based on the PDF document at: ${pdfUrl}

Please answer the following question thoroughly and accurately. Cite specific sections or pages from the document when relevant.

Question: ${question}`;

        log.info('📤 Sending request to Gemini with URL context for PDF');

        // Use AI SDK with URL context tool (supports PDFs)
        // Provider instance has the tools property for accessing urlContext
        const { text } = await generateText({
            model: model,
            prompt: prompt,
            tools: {
                url_context: providerInstance.tools.urlContext({}),
            },
        });

        log.info('✅ PDF analysis completed', {
            answerLength: text.length,
        });

        return text;
    } catch (error) {
        log.error('❌ Error in analyzePdfDocument:', error);

        // Parse and re-throw the error
        const parsedError = parseError(error, { serviceName: 'Gemini PDF Analysis' });
        throw parsedError;
    }
}

/**
 * PDF Agent wrapped as a Tool for the main agent
 * This allows the main agent to delegate PDF document questions to the specialist
 */
export const pdfAgentAsTool = tool({
    description: `Analyze PDF documents and answer questions about their content.
  
  Use this tool when users:
  - Ask about PDF document content
  - Want to understand what a PDF is about
  - Need specific information from a PDF
  - Request PDF summaries or analysis
  - Have questions about PDFs they're viewing
  - Want to extract information from research papers, reports, documentation, etc.
  
  This specialist agent uses Gemini's native PDF understanding capabilities
  to directly process and analyze PDF documents.
  
  IMPORTANT:
  - Only supports publicly accessible URL-based PDFs (https://example.com/document.pdf)
  - Does NOT support local files (file://, file:///C:/Users/..., etc.)
  - If user provides a local file path, ask them to upload via the attachment icon instead
  - Can auto-detect PDF URL from active tab if user is viewing a PDF
  - Handles various PDF types: research papers, reports, documentation, forms, etc.
  - Provides accurate answers based on actual document content
  - Maximum PDF size: 34MB`,

    inputSchema: z.object({
        pdfUrl: z.string().optional().describe('The full PDF URL (e.g., https://example.com/document.pdf). If not provided, will attempt to extract from active tab. Does NOT accept local file paths (file://).'),
        question: z.string().describe('The specific question the user wants answered about the PDF document'),
        pageCount: z.number().optional().describe('Optional page count of the PDF document (if known)'),
    }),

    execute: async ({ pdfUrl, question, pageCount }) => {
        log.info('📄 PDF Agent called', { pdfUrl, question, pageCount });

        try {
            let finalUrl: string;
            let metadata: { title?: string; pageCount?: number } | undefined;

            // Priority 1: Use pdfUrl if provided
            if (pdfUrl) {
                // Check if it's a local file path
                if (isLocalFile(pdfUrl)) {
                    log.warn('Local file path detected, rejecting', { pdfUrl });
                    throw new Error(
                        '❌ Local PDF files are not supported via file paths.\n\n' +
                        '📎 Please use the attachment icon (📎) in the chat to upload your PDF file directly.\n\n' +
                        'This allows me to analyze local PDFs securely without requiring file:// access.'
                    );
                }

                // Validate URL format
                if (!isPdfUrl(pdfUrl)) {
                    throw new Error(
                        'The provided URL does not appear to be a PDF document. Please provide a URL ending in .pdf'
                    );
                }

                finalUrl = pdfUrl;
                metadata = await getPdfMetadata(pdfUrl);
                if (pageCount && metadata) {
                    metadata.pageCount = pageCount;
                }
            }
            // Priority 2: Try to get from active tab
            else {
                log.info('No PDF URL provided, attempting to extract from active tab');
                const tabUrl = await getPdfUrlFromActiveTab();

                if (!tabUrl) {
                    throw new Error(
                        'Could not find a PDF document. Please provide a PDF URL or navigate to a PDF page.'
                    );
                }

                finalUrl = tabUrl;
                log.info('✅ Extracted PDF URL from active tab', { url: finalUrl });
                metadata = await getPdfMetadata(tabUrl);
                if (pageCount && metadata) {
                    metadata.pageCount = pageCount;
                }
            }

            log.info('PDF URL determined', {
                url: finalUrl,
                metadata
            });

            // Analyze the PDF document
            const answer = await analyzePdfDocument(finalUrl, question, metadata);

            log.info('✅ PDF Agent completed successfully', {
                answerLength: answer.length,
            });

            return {
                success: true,
                answer,
                pdfUrl: finalUrl,
                title: metadata?.title,
                pageCount: metadata?.pageCount,
            };

        } catch (error) {
            log.error('❌ PDF Agent error', error);

            // Parse the error into a typed error
            const parsedError = parseError(error, { serviceName: 'PDF Analysis' });

            // Handle specific error scenarios for better UX
            const errorMessage = parsedError.message.toLowerCase();

            // 1. Restricted/Protected PDFs
            if (errorMessage.includes('403') || errorMessage.includes('forbidden') ||
                errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
                throw ExternalServiceError.serviceUnavailable(
                    'PDF Analysis',
                    'The PDF document is restricted, password-protected, or requires authentication. Please use a publicly accessible PDF URL.'
                );
            }

            // 2. Invalid URLs / Not Found
            if (errorMessage.includes('404') || errorMessage.includes('not found')) {
                throw NetworkError.dnsFailed(
                    'The PDF document could not be found at the provided URL. Please verify the URL is correct.'
                );
            }

            // 3. Large PDFs (URL context has 34MB limit)
            if (errorMessage.includes('too large') || errorMessage.includes('size limit') ||
                errorMessage.includes('34mb') || errorMessage.includes('file size')) {
                throw ExternalServiceError.serviceUnavailable(
                    'PDF Analysis',
                    'The PDF document is too large to process (max 34MB). Please try a smaller document or provide a specific page range.'
                );
            }

            // 4. Network Errors
            if (parsedError instanceof NetworkError) {
                throw NetworkError.timeout(
                    'Unable to access the PDF document. Please check the URL and your network connection.'
                );
            }

            // 5. Malformed/Corrupted PDFs
            if (errorMessage.includes('corrupt') || errorMessage.includes('malformed') ||
                errorMessage.includes('invalid pdf') || errorMessage.includes('parse')) {
                throw ExternalServiceError.serviceUnavailable(
                    'PDF Analysis',
                    'The PDF document appears to be corrupted or malformed. Please try a different PDF.'
                );
            }

            // 6. URL Context Safety Issues
            if (errorMessage.includes('unsafe') || errorMessage.includes('safety') ||
                errorMessage.includes('blocked')) {
                throw ExternalServiceError.serviceUnavailable(
                    'PDF Analysis',
                    'The PDF document URL was blocked by safety checks. Please ensure the URL is from a trusted source.'
                );
            }

            // 7. URL Retrieval Failed
            if (errorMessage.includes('retrieval failed') || errorMessage.includes('url_retrieval_status_failed')) {
                throw NetworkError.timeout(
                    'Failed to retrieve the PDF document. The URL may be inaccessible or require authentication.'
                );
            }

            // Re-throw the parsed error with context
            throw parsedError;
        }
    },
});

