/**
 * PDF Agent Tool for Browser Action Agent
 * 
 * This file provides the PDF agent in Gemini's native function calling format
 * so it can be directly used by the browser action agent.
 */

import { generateText } from 'ai';
import { Type as SchemaType, type FunctionDeclaration } from '@google/genai';
import { createLogger } from '../../../logger';
import { NetworkError, parseError } from '../../../errors';
import { isPdfUrl } from '../../../utils/pdfDetector';
import { initializeModel } from '../../core/modelFactory';

const log = createLogger('PDF-Agent-Tool');

/**
 * Extract PDF metadata if possible
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
 */
async function analyzePdfDocument(
    pdfUrl: string,
    question: string,
    metadata?: { title?: string; pageCount?: number }
): Promise<string> {
    try {
        log.info('📄 Analyzing PDF document', { pdfUrl, question });

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

        // Initialize model using provider-aware factory (respects Vertex AI or Google AI selection)
        const { model, provider, providerInstance } = await initializeModel('gemini-2.5-flash', 'remote');

        log.info('✅ Model initialized with provider:', provider);

        // Use AI SDK with URL context tool (supports PDFs)
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
 * PDF Agent Tool Declaration for Gemini
 * This is the function declaration in Gemini's native format
 */
export const analyzePdfDocumentDeclaration: FunctionDeclaration = {
    name: 'analyzePdfDocument',
    description: `Analyze PDF documents and answer questions about their content.
  
This tool analyzes PDF documents from URLs or from the currently active tab if it's a PDF.
It uses Gemini's native PDF understanding capabilities to answer questions about the document.

The tool will:
1. Extract the PDF URL from the active tab (if not provided)
2. Read and understand the PDF content
3. Provide comprehensive answers to questions about the document

Use this when users ask about:
- What a PDF document is about
- Specific information from a PDF
- Summaries of PDF content
- Questions about research papers, reports, documentation
- Extracting data or information from PDFs

IMPORTANT: 
- If no URL is provided, the active tab MUST be a PDF page
- Works with publicly accessible PDF URLs
- Can handle various PDF types: research papers, reports, documentation, forms, etc.`,

    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            question: {
                type: SchemaType.STRING,
                description: 'The question to answer about the PDF document. Be specific about what information you need.'
            },
            pdfUrl: {
                type: SchemaType.STRING,
                description: 'Optional PDF URL (e.g., https://example.com/document.pdf). If not provided, will extract from the currently active tab.',
                nullable: true
            }
        },
        required: ['question']
    }
};

/**
 * PDF Agent Executor
 * This function executes the PDF analysis with the given parameters
 */
export async function executePdfAnalysis(args: { question: string; pdfUrl?: string }): Promise<any> {
    log.info('📄 PDF Analysis Tool called', { question: args.question, pdfUrl: args.pdfUrl });

    try {
        let finalUrl = args.pdfUrl;

        // If URL not provided, extract from active tab
        if (!finalUrl) {
            log.info('PDF URL not provided, extracting from active tab');
            const tabUrl = await getPdfUrlFromActiveTab();

            if (!tabUrl) {
                throw new Error('Could not find a PDF document. Please navigate to a PDF page or provide a PDF URL.');
            }

            finalUrl = tabUrl;
            log.info('✅ Extracted PDF URL from active tab', { url: finalUrl });
        }

        // Validate final URL
        if (!isPdfUrl(finalUrl)) {
            throw new Error('The provided URL does not appear to be a PDF document');
        }

        // Get PDF metadata
        const metadata = await getPdfMetadata(finalUrl);
        log.info('PDF metadata extracted', { metadata });

        // Analyze the PDF document
        const answer = await analyzePdfDocument(finalUrl, args.question, metadata);

        log.info('✅ PDF Analysis completed successfully', {
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
        log.error('❌ PDF Analysis error', error);

        // Parse the error into a typed error for better user messaging
        const parsedError = parseError(error, { serviceName: 'PDF Analysis' });
        const errorMessage = parsedError.message.toLowerCase();

        // Build user-friendly error message based on error type
        let userMessage = `I encountered an error analyzing the PDF document: ${parsedError.message}`;
        let errorType = parsedError.constructor.name;

        // 1. Restricted/Protected PDFs
        if (errorMessage.includes('403') || errorMessage.includes('forbidden') ||
            errorMessage.includes('unauthorized') || errorMessage.includes('401') ||
            errorMessage.includes('restricted') || errorMessage.includes('password')) {
            userMessage = 'This PDF is restricted, password-protected, or requires authentication. Please use a publicly accessible PDF URL.';
            errorType = 'ExternalServiceError';
        }

        // 2. Invalid URLs / Not Found
        else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            userMessage = 'The PDF document could not be found at the provided URL. Please verify the URL is correct.';
            errorType = 'NetworkError';
        }

        // 3. Large PDFs
        else if (errorMessage.includes('too large') || errorMessage.includes('size limit') ||
            errorMessage.includes('34mb') || errorMessage.includes('file size')) {
            userMessage = 'This PDF is too large to process (max 34MB). Please try a smaller document.';
            errorType = 'ExternalServiceError';
        }

        // 4. Network Errors
        else if (parsedError instanceof NetworkError || errorMessage.includes('timeout') ||
            errorMessage.includes('network') || errorMessage.includes('connection')) {
            userMessage = 'Unable to access the PDF document. Please check the URL and your network connection.';
            errorType = 'NetworkError';
        }

        // 5. Malformed/Corrupted PDFs
        else if (errorMessage.includes('corrupt') || errorMessage.includes('malformed') ||
            errorMessage.includes('invalid pdf') || errorMessage.includes('parse')) {
            userMessage = 'The PDF document appears to be corrupted or malformed. Please try a different PDF.';
            errorType = 'ExternalServiceError';
        }

        // 6. Safety/Blocked URLs
        else if (errorMessage.includes('unsafe') || errorMessage.includes('safety') ||
            errorMessage.includes('blocked')) {
            userMessage = 'The PDF URL was blocked by safety checks. Please ensure it\'s from a trusted source.';
            errorType = 'ExternalServiceError';
        }

        // 7. No PDF Found
        else if (errorMessage.includes('could not find a pdf')) {
            userMessage = 'Could not find a PDF document. Please provide a PDF URL or navigate to a PDF page.';
            errorType = 'ValidationError';
        }

        // 8. Invalid PDF URL
        else if (errorMessage.includes('does not appear to be a pdf')) {
            userMessage = 'The provided URL does not appear to be a PDF document. Please provide a valid PDF URL.';
            errorType = 'ValidationError';
        }

        // Return structured error that will be displayed in CompactToolCard
        return {
            success: false,
            error: parsedError.message,
            errorType: errorType,
            answer: userMessage,
            pdfUrl: args.pdfUrl, // Include attempted URL for debugging
        };
    }
}
