/**
 * Reminder types shared between extension and webapp
 */

/** Frequency options for recurring reminders */
export type RepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Reminder object structure
 */
export interface Reminder {
    /** Unique identifier for the reminder */
    id: string;
    /** User-provided title or description */
    title: string;
    /** When the reminder should trigger (epoch ms) */
    when: number;
    /** Optional URL to open when reminder triggers */
    url?: string;
    /** When the reminder was created (epoch ms) */
    createdAt: number;
    /** AI-generated friendly title */
    generatedTitle?: string;
    /** AI-generated description */
    generatedDescription?: string;
    /** Repeat frequency for recurring reminders */
    repeat?: RepeatFrequency;
    /** Whether the reminder is paused */
    isPaused?: boolean;
}

/**
 * Payload for updating an existing reminder
 */
export interface UpdateReminderPayload {
    /** ID of the reminder to update */
    id: string;
    /** Updated fields */
    updates: Partial<Omit<Reminder, 'id' | 'createdAt'>>;
}
