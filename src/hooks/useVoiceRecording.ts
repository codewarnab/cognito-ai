import { useState, useRef, useCallback } from 'react';
import { createLogger } from '@logger';
import type { AudioLinesIconHandle } from '../components/shared/icons';

const log = createLogger('useVoiceRecording');

/**
 * Hook to manage voice recording state and animations
 */
export function useVoiceRecording() {
    const [isRecording, setIsRecording] = useState(false);
    const [showPill, setShowPill] = useState(false);
    const audioLinesIconRef = useRef<AudioLinesIconHandle>(null);

    const handleRecordingChange = useCallback((recording: boolean) => {
        setIsRecording(recording);

        if (recording) {
            setShowPill(true);
            audioLinesIconRef.current?.startAnimation();
            log.info("Voice recording started");
        } else {
            audioLinesIconRef.current?.stopAnimation();
            setShowPill(false);
            // log.info("Voice recording stopped");
        }
    }, []);

    return {
        isRecording,
        showPill,
        audioLinesIconRef,
        handleRecordingChange,
    };
}
