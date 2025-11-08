/**
 * Response from Google File API after uploading a file
 */
export interface FileUploadResponse {
    file: {
        name: string; // Format: "files/abc123"
        displayName?: string;
        mimeType: string;
        sizeBytes: string;
        createTime: string;
        expirationTime: string;
        sha256Hash: string;
        uri: string; // Use this in AI requests
        state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
    };
}

/**
 * Metadata for an uploaded file
 */
export interface FileMetadata {
    name: string;
    uri: string;
    mimeType: string;
    sizeBytes: number;
    state: string;
    expirationTime: string;
}

/**
 * Context information for an uploaded PDF
 */
export interface UploadedPDFContext {
    url: string; // Original PDF URL
    fileUri: string; // Google File API URI (use in AI requests)
    fileName: string; // File API name (e.g., "files/abc123")
    uploadedAt: number; // Timestamp of upload
    expiresAt: number; // Timestamp when file expires (48 hours)
    metadata?: FileMetadata; // Additional file metadata
}
