import { useCallback } from 'react';
import type { AIMode, Message } from '@components/features/chat/types';
import type { FileAttachmentData } from '@components/features/chat/components/FileAttachment';
import { hasGoogleApiKey } from '../utils/providerCredentials';
import { HIDE_LOCAL_MODE } from '@constants';

interface UseChatInputValidationOptions {
    mode: AIMode;
    messages: Message[];
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
}

const WORD_LIMIT = 500;

export const useChatInputValidation = ({ mode, messages, onError }: UseChatInputValidationOptions) => {

    // Validate input before sending
    const validateBeforeSend = useCallback(async (input: string, attachments: FileAttachmentData[]): Promise<boolean> => {
        // Check if there's any content to send
        if (!input.trim() && attachments.length === 0) {
            return false;
        }

        // Validate API key if in remote mode or HIDE_LOCAL_MODE is enabled
        if ((HIDE_LOCAL_MODE || mode === 'remote') && !(await hasGoogleApiKey())) {
            onError?.(
                'API Key Required. Please add your Gemini API key in Settings to use the AI assistant.',
                'error'
            );
            return false;
        }

        // Check word count limit for local mode
        if (mode === 'local') {
            // Count total words in all messages + current input
            let totalWords = 0;

            // Count words in existing messages
            for (const msg of messages) {
                if (msg.parts && msg.parts.length > 0) {
                    for (const part of msg.parts) {
                        if (part.type === 'text' && part.text) {
                            totalWords += part.text.split(/\s+/).filter((word: string) => word.length > 0).length;
                        }
                    }
                }
            }

            // Count words in current input
            totalWords += input.split(/\s+/).filter((word: string) => word.length > 0).length;

            if (totalWords > WORD_LIMIT) {
                // Show toast notification
                onError?.(
                    `⚠️ Input too large for Local Mode. Your conversation has ${totalWords} words (limit: ${WORD_LIMIT} words). Please start a new conversation or switch to Remote Mode for unlimited context.`,
                    'warning'
                );
                return false;
            }
        }

        return true;
    }, [mode, messages, onError]);

    // Check if send button should be enabled
    const canSend = useCallback((input: string, attachments: FileAttachmentData[], isLoading: boolean): boolean => {
        return (input.trim().length > 0 || attachments.length > 0) && !isLoading;
    }, []);

    return {
        validateBeforeSend,
        canSend,
    };
};
