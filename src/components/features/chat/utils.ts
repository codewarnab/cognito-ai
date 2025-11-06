import type { Message } from './types';

// Helper to extract text content from AI SDK v5 parts array
export const getMessageContent = (message: Message): string => {
    try {
        if (!message || !message.parts || message.parts.length === 0) return '';
        return message.parts
            .filter((part: any) => part && part.type === 'text')
            .map((part: any) => {
                // Safely access text property with fallback
                if (part && typeof part.text === 'string') {
                    return part.text;
                }
                return '';
            })
            .filter(text => text.length > 0) // Remove empty strings
            .join('');
    } catch (error) {
        console.error('[getMessageContent] Error extracting message text:', error);
        return '';
    }
};

// Helper to check if message has tool calls
export const hasToolCalls = (message: Message): boolean => {
    try {
        if (!message || !message.parts || message.parts.length === 0) {
            return false;
        }

        const toolParts = message.parts.filter((part: any) => {
            if (!part || !part.type) return false;

            const isToolCall = part.type === 'tool-call';
            const isToolResult = part.type === 'tool-result';
            const startsWithTool = part.type?.startsWith && part.type.startsWith('tool-');
            const isDynamicTool = part.type === 'dynamic-tool';

            return isToolCall || isToolResult || startsWithTool || isDynamicTool;
        });

        return toolParts.length > 0;
    } catch (error) {
        console.error('[hasToolCalls] Error checking for tool calls:', error);
        return false;
    }
};
