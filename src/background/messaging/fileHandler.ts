/**
 * File Handler
 * 
 * Handles file-related messages (e.g., reading local PDF files)
 */

import { createLogger } from '~logger';
import { readLocalFile, extractFilename } from '../../utils/localFileReader';
import { isFileAccessError } from '../../errors';

const backgroundLog = createLogger('Background-File-Handler', 'BACKGROUND');

/**
 * Handle file-related messages
 */
export async function handleFileMessage(
    message: any,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
): Promise<void> {
    if (message?.type === 'READ_LOCAL_PDF') {
        try {
            const { filePath } = message.payload;

            if (!filePath) {
                sendResponse({
                    success: false,
                    error: 'File path is required'
                });
                return;
            }

            backgroundLog.info(' Reading local PDF file:', filePath);

            // Read the file and convert to Blob
            const blob = await readLocalFile(filePath);
            const filename = extractFilename(filePath);

            // Convert Blob to base64 for safe transfer through Chrome messaging
            // ArrayBuffers don't serialize properly through sendResponse()
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Convert to base64 string
            let binary = '';
            const chunkSize = 0x8000; // Process in chunks to avoid call stack issues
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
                const chunk = uint8Array.subarray(i, i + chunkSize);
                binary += String.fromCharCode.apply(null, Array.from(chunk));
            }
            const base64Data = btoa(binary);

            backgroundLog.info(' Successfully read local PDF:', {
                filename,
                size: blob.size,
                type: blob.type,
                base64Length: base64Data.length
            });

            sendResponse({
                success: true,
                data: {
                    base64Data,
                    filename,
                    type: blob.type,
                    size: blob.size
                }
            });
        } catch (error) {
            backgroundLog.error(' Error reading local PDF:', error);

            if (isFileAccessError(error)) {
                sendResponse({
                    success: false,
                    error: error.userMessage,
                    errorCode: error.code,
                    needsPermission: error.code === 'PERMISSION_DENIED'
                });
            } else {
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to read local PDF file'
                });
            }
        }
    }
}
