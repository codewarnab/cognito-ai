import type { Message } from './types';

// Helper to extract text content from AI SDK v5 parts array
export const getMessageContent = (message: Message): string => {
    if (!message.parts || message.parts.length === 0) return '';
    return message.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
};

// Helper to check if message has tool calls
export const hasToolCalls = (message: Message): boolean => {
    if (!message.parts || message.parts.length === 0) {
        return false;
    }

    const toolParts = message.parts.filter((part: any) => {
        const isToolCall = part.type === 'tool-call';
        const isToolResult = part.type === 'tool-result';
        const startsWithTool = part.type?.startsWith && part.type.startsWith('tool-');
        const isDynamicTool = part.type === 'dynamic-tool';

        return isToolCall || isToolResult || startsWithTool || isDynamicTool;
    });

    return toolParts.length > 0;
};
