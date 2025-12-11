/**
 * Chat component prop types
 */

import type { EnhancedMessage } from '../ai/messages';
import type { TabContext } from '../chrome/tabs';

export type ChatMode = 'text' | 'voice';

export interface FileAttachmentData {
    id: string;
    name: string;
    type: string;
    size: number;
    data: string | ArrayBuffer;
    url?: string;
}

export interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    placeholder?: string;
    disabled?: boolean;
    mode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
    attachments: FileAttachmentData[];
    onAttachmentsChange: (attachments: FileAttachmentData[]) => void;
    maxLength?: number;
}

export interface ChatMessageProps {
    message: EnhancedMessage;
    isLast?: boolean;
    isStreaming?: boolean;
    onCopy?: (content: string) => void;
    onRetry?: (messageId: string) => void;
    onEdit?: (messageId: string, newContent: string) => void;
}

export interface ChatContainerProps {
    messages: EnhancedMessage[];
    isLoading: boolean;
    onSendMessage: (content: string) => void;
    onClearHistory?: () => void;
}

export interface ContextWarningState {
    percent: number;
    isNearLimit: boolean;
    tokensUsed: number;
    tokensLimit: number;
}

export type { TabContext };
