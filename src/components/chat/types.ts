export { type AIMode, type RemoteModelType, type ModelState } from '../../ai/types';
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

export type ExecutionMode = 'local' | 'cloud';
