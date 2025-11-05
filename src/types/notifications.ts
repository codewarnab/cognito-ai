/**
 * Types for Chrome Notification System
 * Used for AI completion notifications
 */

export interface AINotificationPayload {
    threadId: string;
    title: string;
    message: string;
    timestamp: number;
}

export interface AINotificationActionPayload {
    action: 'continue' | 'dismiss' | 'navigate';
    threadId: string;
}

export interface CreateAINotificationMessage {
    type: 'ai/notification/create';
    payload: AINotificationPayload;
}

export interface AINotificationActionMessage {
    type: 'ai/notification/action';
    payload: AINotificationActionPayload;
}

export type AINotificationMessage =
    | CreateAINotificationMessage
    | AINotificationActionMessage;

export interface NotificationOptions {
    threadId: string;
    title: string;
    message: string;
    iconUrl?: string;
    buttons?: Array<{ title: string }>;
    priority?: number;
    requireInteraction?: boolean;
}

export interface ParsedNotificationId {
    type: 'ai-complete';
    threadId: string;
    timestamp: number;
}
