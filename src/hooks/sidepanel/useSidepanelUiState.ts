import { useState, useCallback } from 'react';
import type { ChatMode } from '../../types/sidepanel';
import { createLogger } from '~logger';

const log = createLogger('useSidepanelUiState');

export interface SidepanelUiStateReturn {
    // UI State
    input: string;
    setInput: (value: string) => void;
    showMcp: boolean;
    setShowMcp: (value: boolean) => void;
    showThreads: boolean;
    setShowThreads: (value: boolean) => void;
    showMemory: boolean;
    setShowMemory: (value: boolean) => void;
    showReminders: boolean;
    setShowReminders: (value: boolean) => void;
    showTroubleshooting: boolean;
    setShowTroubleshooting: (value: boolean) => void;
    showFeatures: boolean;
    setShowFeatures: (value: boolean) => void;
    showProviderSetup: boolean;
    setShowProviderSetup: (value: boolean) => void;
    mode: ChatMode;
    setMode: (mode: ChatMode) => void;

    // Helper Functions
    handleModeChange: (newMode: ChatMode) => Promise<void>;
    handleKeyPress: (e: React.KeyboardEvent) => void;
    handleContinue: () => void;
}

interface UseSidepanelUiStateProps {
    isRecording: boolean;
    onSendMessage: (text?: string) => void;
    sendMessage: (params: { text: string }) => void;
}

/**
 * Hook to centralize all UI state toggles and mode management
 */
export function useSidepanelUiState({
    isRecording,
    onSendMessage,
    sendMessage,
}: UseSidepanelUiStateProps): SidepanelUiStateReturn {
    // UI State
    const [inputState, setInput] = useState('');
    const [showMcp, setShowMcp] = useState(false);
    const [showThreads, setShowThreads] = useState(false);
    const [showMemory, setShowMemory] = useState(false);
    const [showReminders, setShowReminders] = useState(false);
    const [showTroubleshooting, setShowTroubleshooting] = useState(false);
    const [showFeatures, setShowFeatures] = useState(false);
    const [showProviderSetup, setShowProviderSetup] = useState(false);
    const [mode, setMode] = useState<ChatMode>('text');

    // Handle mode change with cleanup
    const handleModeChange = useCallback(async (newMode: ChatMode) => {
        if (mode === newMode) return;

        if (isRecording) {
            log.warn('Cannot switch mode while recording');
            return;
        }

        log.info('Switching mode', { from: mode, to: newMode });
        setMode(newMode);
    }, [mode, isRecording]);

    // Handle key press for sending messages
    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (inputState.trim().length > 0) {
                onSendMessage();
            }
        }
    }, [inputState, onSendMessage]);

    // Handle continue button click
    const handleContinue = useCallback(() => {
        log.info("Continue button clicked - sending continue message");
        sendMessage({
            text: "Please continue from where you left off. Complete any remaining tasks or tool calls that were interrupted by the step limit."
        });
    }, [sendMessage]);

    return {
        input: inputState,
        setInput,
        showMcp,
        setShowMcp,
        showThreads,
        setShowThreads,
        showMemory,
        setShowMemory,
        showReminders,
        setShowReminders,
        showTroubleshooting,
        setShowTroubleshooting,
        showFeatures,
        setShowFeatures,
        showProviderSetup,
        setShowProviderSetup,
        mode,
        setMode,
        handleModeChange,
        handleKeyPress,
        handleContinue,
    };
}

