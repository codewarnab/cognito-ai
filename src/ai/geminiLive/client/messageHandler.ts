/**
 * Message Handler for Gemini Live Client
 * Processes incoming messages from Live API
 */

import type { LiveServerMessage, ServerContent } from '../types';
import { LiveAPIError, LiveAPIErrorType } from '../types';
import { AudioManager } from '../audioManager';
import { createLogger } from '@logger';

const log = createLogger('MessageHandler');

export interface MessageHandlerCallbacks {
    onModelSpeakingChange?: (isSpeaking: boolean) => void;
    onStatusChange?: (status: string) => void;
    onError?: (error: LiveAPIError) => void;
}

export class GeminiLiveMessageHandler {
    constructor(
        private audioManager: AudioManager,
        private callbacks: MessageHandlerCallbacks = {}
    ) { }

    /**
     * Handle incoming server message
     */
    async handleMessage(message: LiveServerMessage): Promise<{
        requiresToolExecution: boolean;
        functionCalls?: any[];
    }> {
        log.debug('Received message from Live API', message);

        try {
            // Handle setup complete
            if (message.setupComplete) {
                log.info('Session setup complete');
                return { requiresToolExecution: false };
            }

            // Handle server content (audio, interruptions, etc.)
            if (message.serverContent) {
                await this.handleServerContent(message.serverContent);
            }

            // Handle tool calls
            if (message.toolCall && message.toolCall.functionCalls) {
                return {
                    requiresToolExecution: true,
                    functionCalls: message.toolCall.functionCalls
                };
            }

            return { requiresToolExecution: false };

        } catch (error) {
            log.error('Error handling message', error);
            const liveError = new LiveAPIError(
                LiveAPIErrorType.CONNECTION,
                'Error processing server message',
                error as Error
            );

            if (this.callbacks.onError) {
                this.callbacks.onError(liveError);
            }

            throw liveError;
        }
    }

    /**
     * Handle server content (audio, interruptions, turn completion)
     */
    private async handleServerContent(content: ServerContent): Promise<void> {
        // Handle interruption
        if (content.interrupted) {
            log.info('Conversation interrupted by user');
            this.audioManager.handleInterruption();

            if (this.callbacks.onModelSpeakingChange) {
                this.callbacks.onModelSpeakingChange(false);
            }
            if (this.callbacks.onStatusChange) {
                this.callbacks.onStatusChange('Listening...');
            }
            return;
        }

        // Handle model turn (audio response)
        if (content.modelTurn && content.modelTurn.parts) {
            if (this.callbacks.onModelSpeakingChange) {
                this.callbacks.onModelSpeakingChange(true);
            }
            if (this.callbacks.onStatusChange) {
                this.callbacks.onStatusChange('Speaking...');
            }

            for (const part of content.modelTurn.parts) {
                // Handle audio data
                if ((part as any).inlineData?.data) {
                    const audioData = (part as any).inlineData.data;
                    try {
                        await this.audioManager.playAudio(audioData);
                    } catch (error) {
                        log.error('Failed to play audio', error);
                        const liveError = new LiveAPIError(
                            LiveAPIErrorType.AUDIO_PLAYBACK,
                            'Failed to play audio response',
                            error as Error
                        );
                        if (this.callbacks.onError) {
                            this.callbacks.onError(liveError);
                        }
                    }
                }

                // Handle text (for debugging/transcript)
                if ((part as any).text) {
                    log.debug('Model text response:', (part as any).text);
                }
            }
        }

        // Handle turn completion
        if (content.turnComplete || content.generationComplete) {
            log.info('Model turn complete');

            if (this.callbacks.onModelSpeakingChange) {
                this.callbacks.onModelSpeakingChange(false);
            }
        }
    }
}
