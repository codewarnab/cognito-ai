export type RepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Reminder {
    id: string;
    title: string;
    when: number; // epoch ms
    url?: string;
    createdAt: number;
    generatedTitle?: string;
    generatedDescription?: string;
    repeat?: RepeatFrequency;
    isPaused?: boolean;
}

export interface PendingConfirmation {
    title: string;
    when: number;
    resolve: (value: { title: string; when: number } | null) => void;
}

