/**
 * File Access Error Types
 * 
 * Handles errors related to local file access, particularly for reading
 * local PDF files via file:/// URLs
 */

/**
 * Error codes for file access operations
 */
export type FileAccessErrorCode =
    | 'PERMISSION_DENIED'    // User hasn't enabled file:// access in chrome://extensions
    | 'FILE_NOT_FOUND'       // File was moved, renamed, or deleted
    | 'INVALID_PATH'         // Not a valid file:/// URL
    | 'INVALID_FILE_TYPE'    // File is not a PDF
    | 'FETCH_FAILED'         // Generic fetch error
    | 'EMPTY_FILE'           // File exists but has no content
    | 'NETWORK_ERROR'        // Network/fetch issue
    | 'UNKNOWN_ERROR';       // Unexpected error

/**
 * Custom error class for file access operations
 */
export class FileAccessError extends Error {
    public readonly code: FileAccessErrorCode;
    public readonly userMessage: string;
    public readonly technicalDetails: string;
    public readonly retryable: boolean;
    public readonly timestamp: Date;

    constructor(code: FileAccessErrorCode, message: string, retryable: boolean = false) {
        super(message);
        this.name = 'FileAccessError';
        this.code = code;
        this.userMessage = this.getUserMessage(code);
        this.technicalDetails = message;
        this.retryable = retryable;
        this.timestamp = new Date();

        // Maintains proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FileAccessError);
        }
    }

    /**
     * Get user-friendly error message based on error code
     */
    private getUserMessage(code: FileAccessErrorCode): string {
        switch (code) {
            case 'PERMISSION_DENIED':
                return 'Permission denied. Please enable "Allow access to file URLs" in chrome://extensions for this extension.';

            case 'FILE_NOT_FOUND':
                return 'File not found. The file may have been moved or deleted.';

            case 'INVALID_PATH':
                return 'Invalid file path. Please select a valid local PDF file.';

            case 'INVALID_FILE_TYPE':
                return 'Only PDF files are supported.';

            case 'FETCH_FAILED':
                return 'Failed to read the file. Please try again.';

            case 'EMPTY_FILE':
                return 'The selected file appears to be empty.';

            case 'NETWORK_ERROR':
                return 'Network error while reading file. Please check your file access permissions.';

            case 'UNKNOWN_ERROR':
            default:
                return 'An unknown error occurred while reading the file.';
        }
    }

    /**
     * Convert error to a serializable object
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            userMessage: this.userMessage,
            technicalDetails: this.technicalDetails,
            retryable: this.retryable,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack,
        };
    }

    /**
     * Static factory method for permission denied errors
     */
    static permissionDenied(details?: string): FileAccessError {
        return new FileAccessError(
            'PERMISSION_DENIED',
            details || 'File access permission denied'
        );
    }

    /**
     * Static factory method for file not found errors
     */
    static fileNotFound(filePath: string): FileAccessError {
        return new FileAccessError(
            'FILE_NOT_FOUND',
            `File not found: ${filePath}`
        );
    }

    /**
     * Static factory method for invalid file type errors
     */
    static invalidFileType(filePath: string): FileAccessError {
        return new FileAccessError(
            'INVALID_FILE_TYPE',
            `Invalid file type: ${filePath}. Only PDF files are supported.`
        );
    }

    /**
     * Get help text for resolving permission errors
     */
    static getPermissionHelpText(): string {
        return `
To enable local PDF file access:

1. Open chrome://extensions in your browser
2. Find this extension (Cognito : Your AI Browser Agent)
3. Click "Details"
4. Scroll down and enable "Allow access to file URLs"
5. Try attaching the PDF again

Note: This permission allows the extension to read local files you explicitly select.
        `.trim();
    }
}

/**
 * Type guard to check if an error is a FileAccessError
 */
export function isFileAccessError(error: unknown): error is FileAccessError {
    return error instanceof FileAccessError;
}

/**
 * Check if a FileAccessError is related to permissions
 */
export function isPermissionError(error: unknown): boolean {
    return isFileAccessError(error) && error.code === 'PERMISSION_DENIED';
}
