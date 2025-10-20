export interface Message {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    parts?: any[];
    generativeUI?: () => React.ReactElement | null;
}

export type ExecutionMode = 'local' | 'cloud';
