export interface Message {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    parts?: any[];
    generativeUI?: () => React.ReactElement | null;
    attachments?: FileAttachment[];
}

export interface FileAttachment {
    name: string;
    size: number;
    type: string;
    mimeType: string;
    content?: string; // Base64 content
    url?: string; // For images
}

// Legacy type - kept for backwards compatibility
export type ExecutionMode = 'local' | 'cloud';

// Modern types from AI module
export type AIMode = 'local' | 'remote';

export type RemoteModelType =
    | 'gemini-2.5-flash'
    | 'gemini-2.5-flash-lite'
    | 'gemini-2.5-pro'
    | 'gemini-2.5-flash-image';

export interface ModelState {
    mode: AIMode;
    remoteModel: RemoteModelType;
    hasApiKey: boolean;
    conversationStartMode?: AIMode;
    isLoading?: boolean;
}
