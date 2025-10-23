/**
 * Session Manager for Gemini Live Client
 * Handles WebSocket session lifecycle
 */

import { GoogleGenAI } from '@google/genai';
import { GEMINI_LIVE_MODELS, Modality } from '../types';
import { getGeminiLiveSystemInstruction } from '../../agents/prompts';
import { createLogger } from '../../../logger';
import { GeminiLiveToolHandler } from './toolHandler';

const log = createLogger('SessionManager');

export interface SessionConfig {
    model: string;
    voiceName: string;
    systemInstruction?: string;
    enableTools: boolean;
}

export interface SessionCallbacks {
    onOpen?: () => void;
    onMessage?: (message: any) => Promise<void>;
    onError?: (error: any) => void;
    onClose?: (event: any) => void;
}

export class GeminiLiveSessionManager {
    private client: any | null = null;
    private session: any | null = null;
    private toolHandler: GeminiLiveToolHandler;

    constructor(
        apiKey: string,
        private config: SessionConfig,
        private callbacks: SessionCallbacks = {}
    ) {
        this.client = new GoogleGenAI({ apiKey });
        this.toolHandler = new GeminiLiveToolHandler();
    }

    /**
     * Start a Live API session
     */
    async connect(): Promise<void> {
        if (this.session) {
            log.warn('Session already connected');
            return;
        }

        log.info('Starting Live API session...');

        // Prepare session configuration
        const sessionConfig = await this.prepareSessionConfig();

        log.info('Connecting to Live API with config', sessionConfig);

        // Connect to Live API using callback-based API
        this.session = await this.client.live.connect({
            model: sessionConfig.model,
            config: {
                responseModalities: sessionConfig.responseModalities,
                speechConfig: sessionConfig.speechConfig,
                tools: sessionConfig.tools,
                systemInstruction: sessionConfig.systemInstruction
            },
            callbacks: {
                onopen: () => {
                    log.info('Live API session opened via callback');
                    if (this.callbacks.onOpen) {
                        this.callbacks.onOpen();
                    }
                },
                onmessage: async (message: any) => {
                    log.debug('Received message via callback', message);
                    if (this.callbacks.onMessage) {
                        await this.callbacks.onMessage(message);
                    }
                },
                onerror: (error: any) => {
                    log.error('Live API session error via callback', {
                        error,
                        errorType: typeof error,
                        errorMessage: error?.message || error?.toString()
                    });
                    if (this.callbacks.onError) {
                        this.callbacks.onError(error);
                    }
                },
                onclose: (event: any) => {
                    log.warn('Live API session closed via callback', {
                        code: event?.code,
                        reason: event?.reason,
                        wasClean: event?.wasClean
                    });
                    if (this.callbacks.onClose) {
                        this.callbacks.onClose(event);
                    }
                }
            }
        });

        log.info('Live API session connected');
    }

    /**
     * Send real-time audio input
     */
    sendAudioInput(base64Data: string, mimeType: string): void {
        if (!this.session) {
            throw new Error('No active session');
        }

        this.session.sendRealtimeInput({
            media: {
                data: base64Data,
                mimeType
            }
        });
    }

    /**
     * Send tool response
     */
    async sendToolResponse(responses: any[]): Promise<void> {
        if (!this.session) {
            throw new Error('No active session');
        }

        log.info('📤 Sending tool responses back to Gemini Live', {
            count: responses.length,
            responses: responses.map(r => ({
                id: r.id,
                name: r.name,
                hasResult: !!r.response?.result,
                resultType: typeof r.response?.result
            }))
        });

        await this.session.sendToolResponse({
            functionResponses: responses
        });

        log.info('✅ Tool responses sent successfully');
    }

    /**
     * Close the session
     */
    async close(): Promise<void> {
        if (!this.session) {
            return;
        }

        log.info('Closing Live API session...');
        await this.session.close();
        this.session = null;
        this.toolHandler.clear();
        log.info('Live API session closed');
    }

    /**
     * Check if session is active
     */
    isConnected(): boolean {
        return this.session !== null;
    }

    /**
     * Get tool handler
     */
    getToolHandler(): GeminiLiveToolHandler {
        return this.toolHandler;
    }

    /**
     * Prepare session configuration with tools and system instruction
     */
    private async prepareSessionConfig(): Promise<any> {
        const config: any = {
            model: this.config.model || GEMINI_LIVE_MODELS.NATIVE_AUDIO,
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: this.config.voiceName || 'Aoede'
                    }
                }
            }
        };

        // Add system instruction
        if (this.config.systemInstruction) {
            config.systemInstruction = this.config.systemInstruction;
        } else {
            config.systemInstruction = getGeminiLiveSystemInstruction();
        }

        // Add tools if enabled
        if (this.config.enableTools) {
            const tools = await this.toolHandler.getToolDeclarations();
            if (tools.length > 0) {
                config.tools = [{
                    functionDeclarations: tools
                }];
                log.info('Added tools to session config', { toolCount: tools.length });
            }
        }

        log.debug('Session config prepared', config);
        return config;
    }
}
