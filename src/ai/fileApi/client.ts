import { getGoogleApiKey } from '../../utils/providerCredentials';
import { APIError, ErrorType } from '../../errors/errorTypes';

// Helper function for compatibility
async function validateAndGetApiKey(): Promise<string> {
    const apiKey = await getGoogleApiKey();
    if (!apiKey) {
        throw new APIError({
            message: 'No API key configured',
            statusCode: 401,
            retryable: false,
            userMessage: 'Please configure your Google AI API key in settings.',
            technicalDetails: 'No API key found in storage',
            errorCode: ErrorType.API_AUTH_FAILED,
        });
    }
    return apiKey;
}
import type { FileMetadata, UploadedPDFContext } from './types';
import { createLogger } from '~logger';
import { getCachedPdf, cachePdf } from './cache';

const log = createLogger('FileAPIClient');
const FILE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Upload PDF from URL using Google File API
 * Checks cache first to avoid re-uploading the same URL
 * 
 * @param pdfUrl - URL of the PDF to upload
 * @param displayName - Optional display name for the file
 * @returns Uploaded PDF context with file URI
 * 
 * @example
 * const context = await uploadPdfFromUrl('https://example.com/doc.pdf', 'My Document');
 * // Use context.fileUri in AI requests
 */
export async function uploadPdfFromUrl(
    pdfUrl: string,
    displayName?: string
): Promise<UploadedPDFContext> {
    log.info('Uploading PDF from URL', { pdfUrl, displayName });

    // Check cache first
    const cachedPdf = await getCachedPdf(pdfUrl);
    if (cachedPdf) {
        log.info('Using cached PDF', { fileUri: cachedPdf.fileUri });
        return cachedPdf;
    }

    const apiKey = await validateAndGetApiKey();

    // Step 1: Fetch PDF content
    log.debug('Fetching PDF content...');
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
        throw new APIError({
            message: 'Failed to fetch PDF',
            statusCode: pdfResponse.status,
            retryable: pdfResponse.status >= 500,
            userMessage: 'Unable to download the PDF. Please check the URL and try again.',
            technicalDetails: `HTTP ${pdfResponse.status}: ${pdfResponse.statusText}`,
            errorCode: ErrorType.API_INVALID_REQUEST,
        });
    }

    const pdfBlob = await pdfResponse.blob();
    const pdfSize = pdfBlob.size;

    // Validate size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (pdfSize > maxSize) {
        throw new Error(
            `PDF too large: ${(pdfSize / 1024 / 1024).toFixed(1)}MB (max 50MB)`
        );
    }

    log.info('PDF fetched', { size: pdfSize, sizeMB: (pdfSize / 1024 / 1024).toFixed(2) });

    // Step 2: Upload to File API
    log.debug('Uploading to Google File API...');
    const formData = new FormData();
    formData.append('file', pdfBlob, displayName || 'document.pdf');

    const uploadResponse = await fetch(`${FILE_API_BASE}/files`, {
        method: 'POST',
        headers: {
            'X-Goog-Api-Key': apiKey,
        },
        body: formData,
    });

    if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        throw new APIError({
            message: 'File API upload failed',
            statusCode: uploadResponse.status,
            retryable: uploadResponse.status >= 500,
            userMessage: 'Failed to upload PDF to Google File API. Please try again.',
            technicalDetails: error,
            errorCode: ErrorType.API_INVALID_REQUEST,
        });
    }

    const uploadData = await uploadResponse.json();

    // The response is the file object directly, not wrapped in { file: ... }
    const file = uploadData.file || uploadData;

    log.info('PDF uploaded successfully', {
        name: file.name,
        uri: file.uri,
        state: file.state,
        rawResponse: uploadData
    });

    // Step 3: Wait for processing if needed
    if (file.state === 'PROCESSING') {
        log.debug('File is processing, waiting...');
        await waitForProcessing(file.name, apiKey);
    }

    const context: UploadedPDFContext = {
        url: pdfUrl,
        fileUri: file.uri,
        fileName: file.name,
        uploadedAt: Date.now(),
        expiresAt: new Date(file.expirationTime).getTime(),
        metadata: {
            name: file.name,
            uri: file.uri,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            state: file.state,
            expirationTime: file.expirationTime,
        },
    };

    // Cache the uploaded PDF
    await cachePdf(context);

    return context;
}

/**
 * Wait for file processing to complete
 * 
 * @param fileName - Name of the file (e.g., "files/abc123")
 * @param apiKey - Gemini API key
 * @param maxAttempts - Maximum number of polling attempts
 */
async function waitForProcessing(
    fileName: string,
    apiKey: string,
    maxAttempts = 10
): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const metadata = await getFileMetadata(fileName, apiKey);

        if (metadata.state === 'ACTIVE') {
            log.info('File processing complete');
            return;
        }

        if (metadata.state === 'FAILED') {
            throw new APIError({
                message: 'File processing failed',
                statusCode: 500,
                retryable: false,
                userMessage: 'The PDF processing failed. Please try uploading again.',
                technicalDetails: `File ${fileName} processing state: FAILED`,
                errorCode: ErrorType.API_SERVER_ERROR,
            });
        }

        log.debug(`Processing... (${i + 1}/${maxAttempts})`, { state: metadata.state });
    }

    throw new APIError({
        message: 'File processing timeout',
        statusCode: 408,
        retryable: true,
        userMessage: 'PDF processing took too long. Please try again.',
        technicalDetails: `File ${fileName} did not reach ACTIVE state after ${maxAttempts} attempts`,
        errorCode: ErrorType.NETWORK_TIMEOUT,
    });
}

/**
 * Get metadata for an uploaded file
 * 
 * @param fileName - Name of the file (e.g., "files/abc123")
 * @param apiKey - Optional API key (will fetch if not provided)
 * @returns File metadata
 */
export async function getFileMetadata(
    fileName: string,
    apiKey?: string
): Promise<FileMetadata> {
    const key = apiKey || (await validateAndGetApiKey());

    const response = await fetch(`${FILE_API_BASE}/${fileName}`, {
        headers: {
            'X-Goog-Api-Key': key,
        },
    });

    if (!response.ok) {
        throw new APIError({
            message: 'Failed to get file metadata',
            statusCode: response.status,
            retryable: response.status >= 500,
            userMessage: 'Unable to retrieve file information. Please try again.',
            technicalDetails: `HTTP ${response.status}: ${response.statusText}`,
            errorCode: ErrorType.API_INVALID_REQUEST,
        });
    }

    const data = await response.json();

    return {
        name: data.name,
        uri: data.uri,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        state: data.state,
        expirationTime: data.expirationTime,
    };
}

/**
 * Delete an uploaded file
 * 
 * @param fileName - Name of the file (e.g., "files/abc123")
 */
export async function deleteFile(fileName: string): Promise<void> {
    const apiKey = await validateAndGetApiKey();

    const response = await fetch(`${FILE_API_BASE}/${fileName}`, {
        method: 'DELETE',
        headers: {
            'X-Goog-Api-Key': apiKey,
        },
    });

    if (!response.ok) {
        throw new APIError({
            message: 'Failed to delete file',
            statusCode: response.status,
            retryable: response.status >= 500,
            userMessage: 'Unable to delete the file. Please try again.',
            technicalDetails: `HTTP ${response.status}: ${response.statusText}`,
            errorCode: ErrorType.API_INVALID_REQUEST,
        });
    }

    log.info('File deleted', { fileName });
}

