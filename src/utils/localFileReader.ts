/**
 * Local File Reader Service
 * 
 * Enables background script to read local PDF files (file:///)
 * and convert them to transferable Blob format.
 * 
 * Note: Users must manually enable file:// access in chrome://extensions
 * for this functionality to work.
 */

import { FileAccessError } from '../errors';
import { createLogger } from '../logger';

const log = createLogger('FileReader', 'UTILS');

/**
 * Read a local file from the filesystem using file:/// URL
 * 
 * @param filePath - The file:/// URL of the local PDF file
 * @returns Promise<Blob> - The file contents as a Blob
 * @throws FileAccessError - When permission is denied or file access fails
 */
export async function readLocalFile(filePath: string): Promise<Blob> {
    try {
        // Normalize the file path to ensure it has the file:/// prefix
        let normalizedPath = filePath;

        // If the path doesn't start with file:///, add it
        if (!filePath.startsWith('file:///')) {
            // Handle paths that might start with a drive letter (Windows)
            // or an absolute path (Unix-like systems)
            normalizedPath = `file:///${filePath}`;
            log.debug('Normalized path from', filePath, 'to', normalizedPath);
        }

        // Validate that this is a PDF file
        if (!normalizedPath.toLowerCase().endsWith('.pdf')) {
            throw new FileAccessError(
                'INVALID_FILE_TYPE',
                'Only PDF files are supported.'
            );
        }

        log.debug('Attempting to read file:', normalizedPath);

        // Use fetch API to read the local file
        const response = await fetch(normalizedPath);

        // Check if the request was successful
        if (!response.ok) {
            // Specific error for permission denied (403)
            if (response.status === 403) {
                throw new FileAccessError(
                    'PERMISSION_DENIED',
                    'Permission denied. Please enable "Allow access to file URLs" in chrome://extensions for this extension.'
                );
            }

            // Handle 404 - file not found
            if (response.status === 404) {
                throw new FileAccessError(
                    'FILE_NOT_FOUND',
                    'File not found. The file may have been moved or deleted.'
                );
            }

            // Generic HTTP error
            throw new FileAccessError(
                'FETCH_FAILED',
                `Failed to read file: HTTP ${response.status} ${response.statusText}`
            );
        }

        // Convert response to Blob
        const blob = await response.blob();

        // Verify the blob has content
        if (blob.size === 0) {
            throw new FileAccessError(
                'EMPTY_FILE',
                'The file appears to be empty.'
            );
        }

        log.info('Successfully read file:', {
            path: filePath,
            size: blob.size,
            type: blob.type
        });

        return blob;

    } catch (error) {
        // Re-throw FileAccessErrors as-is
        if (error instanceof FileAccessError) {
            throw error;
        }

        // Handle network/fetch errors
        if (error instanceof TypeError) {
            // Network errors typically manifest as TypeErrors in fetch
            throw new FileAccessError(
                'NETWORK_ERROR',
                'Network error while reading file. Please check your file access permissions in chrome://extensions.'
            );
        }

        // Handle any other unexpected errors
        log.error('Unexpected error reading file:', error);
        throw new FileAccessError(
            'UNKNOWN_ERROR',
            error instanceof Error ? error.message : 'An unknown error occurred while reading the file.'
        );
    }
}

/**
 * Extract filename from a file:/// URL
 * 
 * @param filePath - The file:/// URL
 * @returns The filename with extension
 */
export function extractFilename(filePath: string): string {
    try {
        // Decode the URL to handle special characters and spaces
        const decodedPath = decodeURIComponent(filePath);

        // Extract the filename from the path
        const parts = decodedPath.split('/');
        const filename = parts[parts.length - 1];

        return filename || 'unknown.pdf';
    } catch (error) {
        log.error('Error extracting filename:', error);
        return 'unknown.pdf';
    }
}

/**
 * Check if file:// access is enabled for the extension
 * This is a best-effort check - actual permission is only known when trying to fetch
 * 
 * @returns Promise<boolean> - True if likely enabled, false otherwise
 */
export async function checkFileAccessPermission(): Promise<boolean> {
    try {
        // Try to access chrome.extension.isAllowedFileSchemeAccess if available
        // Note: This API may not be available in all contexts
        if (typeof chrome !== 'undefined' && chrome.extension?.isAllowedFileSchemeAccess) {
            return await chrome.extension.isAllowedFileSchemeAccess();
        }

        // If the API is not available, we can't reliably check
        // Return true and let the actual fetch attempt handle errors
        log.warn('Cannot check file access permission - API not available');
        return true;

    } catch (error) {
        log.error('Error checking file access permission:', error);
        // Return true to allow the fetch attempt to proceed
        return true;
    }
}
