/**
 * Gemini Live Client
 * Manages WebSocket session with Gemini Live API for real-time voice conversation
 * 
 * Architecture:
 * - WebSocket-based bidirectional streaming
 * - Stateful persistent session
 * - Real-time audio capture and playback
 * - Tool calling support (extension tools only, no MCP)
 * - Interruption handling
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI } from '@google/genai';
import type {
    LiveSessionConfig,
    LiveServerMessage,
    LiveSession,
    RealtimeInput,
    FunctionCall,
    ToolResponse,
    VoiceModeStatus,
    ServerContent
} from './types';
import {
    AUDIO_CONFIG,
    GEMINI_LIVE_MODELS,
    Modality,
    LiveAPIError,
    LiveAPIErrorType
} from './types';
import { AudioManager, type AudioDataCallback } from './audioManager';
import { convertAllTools } from './toolConverter';
import { getAllTools, getTool } from '../toolRegistryUtils';
import { createLogger } from '../../logger';
import {
    GeminiLiveErrorHandler,
    ErrorRecoveryManager,
    WebSocketConnectionHandler,
    AudioContextHandler,
    ToolExecutionHandler,
    type ErrorRecoveryConfig
} from './errorHandler';

const log = createLogger('GeminiLiveClient');

/**
 * Event handlers for Gemini Live Client
 */
export interface GeminiLiveEventHandlers {
    onStatusChange?: (status: VoiceModeStatus) => void;
    onError?: (error: LiveAPIError) => void;
    onModelSpeaking?: (isSpeaking: boolean) => void;
    onUserSpeaking?: (isSpeaking: boolean) => void;
    onToolCall?: (toolName: string, args: any) => void;
    onToolResult?: (toolName: string, result: any) => void;
}

/**
 * Configuration options for GeminiLiveClient
 */
export interface GeminiLiveClientConfig {
    apiKey: string;
    model?: string;
    voiceName?: 'Aoede' | 'Orus' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Orion';
    systemInstruction?: string;
    enableTools?: boolean;
    eventHandlers?: GeminiLiveEventHandlers;
    errorRecoveryConfig?: ErrorRecoveryConfig;
}

/**
 * Main Gemini Live Client class
 * Coordinates audio, session management, and tool execution
 */
export class GeminiLiveClient {
    private legacyClient: GoogleGenerativeAI | null = null; // For non-Live API features
    private client: any | null = null; // For Live API (genai.Client type not exported)
    private session: any | null = null; // Live session type
    private audioManager: AudioManager;
    private config: GeminiLiveClientConfig;
    private eventHandlers: GeminiLiveEventHandlers;
    private isInitialized = false;
    private isSessionActive = false;
    private currentStatus: VoiceModeStatus = 'Ready';
    private isModelSpeaking = false;
    private isUserSpeaking = false;
    private errorHandler: GeminiLiveErrorHandler;
    private connectionRetryCount = 0;
    private maxConnectionRetries = 3;

    constructor(config: GeminiLiveClientConfig) {
        this.config = {
            model: GEMINI_LIVE_MODELS.NATIVE_AUDIO,
            voiceName: 'Aoede',
            enableTools: true,
            ...config
        };
        this.eventHandlers = config.eventHandlers || {};
        this.audioManager = new AudioManager();

        // Initialize error handler with recovery config
        this.errorHandler = new GeminiLiveErrorHandler({
            maxRetries: 3,
            retryDelay: 1000,
            exponentialBackoff: true,
            onRetry: (attempt, error) => {
                log.warn(`Retrying after error (attempt ${attempt})`, error);
                this.updateStatus('Retrying...');
            },
            onFailure: (error) => {
                log.error('Max retries reached', error);
                this.updateStatus('Error');
            },
            ...config.errorRecoveryConfig
        });

        log.info('GeminiLiveClient created', {
            model: this.config.model,
            voiceName: this.config.voiceName,
            enableTools: this.config.enableTools
        });
    }

    /**
     * Initialize the client and audio manager
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            log.warn('Client already initialized');
            return;
        }

        const recoveryManager = this.errorHandler.getRecoveryManager();

        await recoveryManager.executeWithRetry(
            'initialization',
            async () => {
                try {
                    this.updateStatus('Initializing...');
                    log.info('Initializing GeminiLiveClient...');

                    // Hardcoded API key for testing
                    const hardcodedApiKey = 'AIzaSyAxTFyeqmms2eV9zsp6yZpCSAHGZebHzqc';

                    // Override config with hardcoded key
                    this.config.apiKey = hardcodedApiKey;

                    // Log API key info (first/last 4 chars for security)
                    const keyPreview = hardcodedApiKey.length > 8
                        ? `${hardcodedApiKey.substring(0, 4)}...${hardcodedApiKey.substring(hardcodedApiKey.length - 4)}`
                        : '****';
                    log.info('Using hardcoded API key', { keyLength: hardcodedApiKey.length, preview: keyPreview });

                    // Initialize Google AI clients with hardcoded key
                    this.legacyClient = new GoogleGenerativeAI(hardcodedApiKey);
                    this.client = new GoogleGenAI({ apiKey: hardcodedApiKey });

                    // Initialize audio manager with error handling
                    const { inputNode, outputNode } = await this.audioManager.initialize();
                    log.info('Audio manager initialized', { inputNode, outputNode });

                    // Monitor audio context state
                    const outputContext = this.audioManager.getOutputContext();
                    if (outputContext) {
                        AudioContextHandler.monitorState(outputContext, (state) => {
                            if (state === 'suspended') {
                                this.handleAudioContextSuspended(outputContext);
                            }
                        });
                    }

                    this.isInitialized = true;
                    this.updateStatus('Ready');
                    log.info('GeminiLiveClient initialized successfully');

                } catch (error) {
                    const liveError = new LiveAPIError(
                        LiveAPIErrorType.INITIALIZATION,
                        'Failed to initialize Gemini Live Client',
                        error as Error
                    );
                    this.handleError(liveError);
                    throw liveError;
                }
            }
        );
    }

    /**
     * Start a Live API session
     */
    async startSession(): Promise<void> {
        if (!this.isInitialized) {
            throw new LiveAPIError(
                LiveAPIErrorType.INITIALIZATION,
                'Client not initialized. Call initialize() first.'
            );
        }

        if (this.isSessionActive) {
            log.warn('Session already active');
            return;
        }

        // API key is hardcoded in initialize(), no need to validate here
        log.info('Starting session with hardcoded API key');

        const wsHandler = this.errorHandler.getWebSocketHandler();

        await wsHandler.handleConnectionFailure(
            async () => {
                try {
                    this.updateStatus('Connecting...');
                    log.info('Starting Live API session...');

                    // Prepare session configuration
                    const sessionConfig = await this.prepareSessionConfig();

                    log.info('Connecting to Live API with config', sessionConfig);

                    // Connect to Live API using the correct method
                    // The @google/genai SDK doesn't have TypeScript definitions yet
                    // @ts-ignore - Live API types may not be fully exposed
                    this.session = await this.client!.live.connect({
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
                                this.handleSessionOpen();
                            },
                            onmessage: async (message: any) => {
                                log.debug('Received message via callback', message);
                                await this.handleMessage(message);
                            },
                            onerror: (error: any) => {
                                log.error('Live API session error via callback', {
                                    error,
                                    errorType: typeof error,
                                    errorMessage: error?.message || error?.toString()
                                });
                                this.handleSessionError(error);
                            },
                            onclose: (event: any) => {
                                log.warn('Live API session closed via callback', {
                                    code: event?.code,
                                    reason: event?.reason,
                                    wasClean: event?.wasClean,
                                    event: event
                                });
                                this.handleSessionClose(event);
                            }
                        }
                    });

                    // Set up event handlers
                    this.setupSessionHandlers();

                    log.info('Live API session connected');
                    this.connectionRetryCount = 0; // Reset on success

                } catch (error) {
                    this.connectionRetryCount++;
                    const liveError = new LiveAPIError(
                        LiveAPIErrorType.CONNECTION,
                        'Failed to connect to Live API',
                        error as Error
                    );
                    this.handleError(liveError);
                    throw liveError;
                }
            },
            (status) => this.updateStatus(status as VoiceModeStatus)
        );
    }

    /**
     * Set up session event handlers for receiving messages
     * Note: With the callback-based API, handlers are set up in the connect() call
     * This method is kept for compatibility but the actual handlers are in connect()
     */
    private setupSessionHandlers(): void {
        if (!this.session) {
            log.error('Cannot setup handlers: session is null');
            return;
        }

        log.info('Session handlers are configured via callbacks in connect()');
        // The session is now active and handlers are already set up via callbacks
        // No need to call listenToSession() anymore
    }

    /**
     * Listen to session messages asynchronously
     * DEPRECATED: Now using callback-based API instead of async iterator
     * Keeping this method for reference but it's no longer used
     */
    private async listenToSession(): Promise<void> {
        // This method is deprecated - we now use callbacks in connect()
        // Left here for reference in case we need to switch back to iterator pattern
        log.debug('listenToSession is deprecated - using callbacks instead');
    }

    /**
     * Start audio capture and streaming
     */
    async startCapture(): Promise<void> {
        if (!this.isSessionActive) {
            throw new LiveAPIError(
                LiveAPIErrorType.SESSION_CLOSED,
                'No active session. Call startSession() first.'
            );
        }

        try {
            log.info('Starting audio capture...');

            // Start capturing audio and streaming to Live API
            this.audioManager.startCapture(this.handleAudioData.bind(this));

            this.isUserSpeaking = true;
            this.notifyUserSpeaking(true);
            this.updateStatus('Listening...');

            log.info('Audio capture started');

        } catch (error) {
            const liveError = new LiveAPIError(
                LiveAPIErrorType.AUDIO_CAPTURE,
                'Failed to start audio capture',
                error as Error
            );
            this.handleError(liveError);
            throw liveError;
        }
    }

    /**
     * Stop audio capture (but keep session alive)
     */
    stopCapture(): void {
        log.info('Stopping audio capture...');

        this.audioManager.stopCapture();
        this.isUserSpeaking = false;
        this.notifyUserSpeaking(false);

        if (this.isSessionActive && !this.isModelSpeaking) {
            this.updateStatus('Ready');
        }

        log.info('Audio capture stopped');
    }

    /**
     * Stop the session and cleanup
     */
    async stopSession(): Promise<void> {
        if (!this.isSessionActive) {
            log.warn('No active session to stop');
            return;
        }

        try {
            log.info('Stopping Live API session...');

            // Stop audio capture first
            this.stopCapture();

            // Close the session
            if (this.session) {
                await this.session.close();
                this.session = null;
            }

            this.isSessionActive = false;
            this.updateStatus('Ready');

            log.info('Live API session stopped');

        } catch (error) {
            log.error('Error stopping session', error);
            // Continue cleanup even if close fails
            this.session = null;
            this.isSessionActive = false;
            this.updateStatus('Error');
        }
    }

    /**
     * Cleanup all resources
     */
    cleanup(): void {
        log.info('Cleaning up GeminiLiveClient...');

        // Stop session if active
        if (this.isSessionActive) {
            this.stopSession().catch(err => log.error('Error in cleanup stopSession', err));
        }

        // Cleanup audio manager
        this.audioManager.cleanup();

        this.client = null;
        this.isInitialized = false;
        this.updateStatus('Ready');

        log.info('GeminiLiveClient cleaned up');
    }

    /**
     * Get audio manager for external access (e.g., visualization)
     */
    getAudioManager(): AudioManager {
        return this.audioManager;
    }

    /**
     * Get current status
     */
    getStatus(): VoiceModeStatus {
        return this.currentStatus;
    }

    /**
     * Check if session is active
     */
    isActive(): boolean {
        return this.isSessionActive;
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    /**
     * Prepare session configuration with tools and system instruction
     */
    private async prepareSessionConfig(): Promise<any> {
        const config: any = {
            model: this.config.model,
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
            // Use default voice-optimized system instruction
            config.systemInstruction = this.getDefaultSystemInstruction();
        }

        // Add tools if enabled
        if (this.config.enableTools) {
            const tools = await this.getToolDeclarations();
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

    /**
     * Get tool declarations for Live API
     */
    private async getToolDeclarations(): Promise<any[]> {
        try {
            // Get extension tools only (no MCP tools in voice mode)
            const extensionTools = getAllTools();

            // Filter out any MCP tools (they have 'mcp_' prefix)
            const filteredTools: typeof extensionTools = {};
            for (const [name, tool] of Object.entries(extensionTools)) {
                if (!name.startsWith('mcp_')) {
                    filteredTools[name] = tool;
                }
            }

            log.info('Extension tools available', {
                total: Object.keys(extensionTools).length,
                filtered: Object.keys(filteredTools).length
            });

            // Convert to Live API format
            const declarations = convertAllTools(filteredTools);

            log.info('Tools converted to Live API format', { count: declarations.length });
            return declarations;

        } catch (error) {
            log.error('Failed to get tool declarations', error);
            return [];
        }
    }

    /**
     * Get default system instruction optimized for voice conversation
     */
    private getDefaultSystemInstruction(): string {
        return `You are an intelligent AI assistant integrated into a Chrome browser extension.

You can help users with:
- Browser navigation and tab management
- Web page interaction (clicking, scrolling, filling forms)
- Information retrieval from the current page
- Managing browser history and bookmarks
- Setting reminders
- Remembering important information

You have access to tools to perform these actions. When users ask you to do something, use the appropriate tools. Always confirm actions before executing them, unless the user has given explicit permission.

Be conversational, friendly, and helpful. Keep responses concise since this is a voice conversation. Speak naturally as if you're having a conversation.

IMPORTANT TOOL USAGE GUIDELINES:

For clicking elements:
- Use clickByText to find and click elements by their visible text
- Example: clickByText with text "Sign In" to click a sign-in button

For typing text into input fields:
- ALWAYS provide the "target" parameter describing which field to type in
- Example: typeInField with text "hello" and target "search box"
- If you don't know which field, first use clickByText to click on the field description, then typeInField
- Example workflow: clickByText("email field") then typeInField("user@example.com", target="email field")

When using tools:
1. Explain what you're about to do briefly
2. Execute the tool with the correct parameters
3. Report the result succinctly

If a tool fails or you encounter an error, explain it clearly and suggest alternatives.`;
    }

    /**
     * Handle audio data from microphone
     */
    private handleAudioData(base64Data: string): void {
        if (!this.session || !this.isSessionActive) {
            return;
        }

        try {
            // Send real-time audio input to Live API
            // The API expects 'media' key with a Blob containing base64 data and mimeType
            // sendRealtimeInput is synchronous, not a Promise
            // @ts-ignore - Live API types not fully exposed
            this.session.sendRealtimeInput({
                media: {
                    data: base64Data,
                    mimeType: AUDIO_CONFIG.MIME_TYPE
                }
            });

        } catch (error) {
            log.error('Error handling audio data', error);
        }
    }

    /**
     * Handle session opened
     */
    private handleSessionOpen(): void {
        log.info('Live API session opened');
        this.isSessionActive = true;
        this.updateStatus('Ready');
    }

    /**
     * Handle incoming messages from Live API
     */
    private async handleMessage(message: LiveServerMessage): Promise<void> {
        log.debug('Received message from Live API', message);

        try {
            // Handle setup complete
            if (message.setupComplete) {
                log.info('Session setup complete');
                return;
            }

            // Handle server content (audio, interruptions, etc.)
            if (message.serverContent) {
                await this.handleServerContent(message.serverContent);
            }

            // Handle tool calls
            if (message.toolCall) {
                await this.handleToolCalls(message.toolCall.functionCalls);
            }

        } catch (error) {
            log.error('Error handling message', error);
            this.handleError(new LiveAPIError(
                LiveAPIErrorType.CONNECTION,
                'Error processing server message',
                error as Error
            ));
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
            this.isModelSpeaking = false;
            this.notifyModelSpeaking(false);
            this.updateStatus('Listening...');
            return;
        }

        // Handle model turn (audio response)
        if (content.modelTurn && content.modelTurn.parts) {
            this.isModelSpeaking = true;
            this.notifyModelSpeaking(true);
            this.updateStatus('Speaking...');

            for (const part of content.modelTurn.parts) {
                // Handle audio data
                if ((part as any).inlineData?.data) {
                    const audioData = (part as any).inlineData.data;
                    try {
                        await this.audioManager.playAudio(audioData);
                    } catch (error) {
                        log.error('Failed to play audio', error);
                        this.handleError(new LiveAPIError(
                            LiveAPIErrorType.AUDIO_PLAYBACK,
                            'Failed to play audio response',
                            error as Error
                        ));
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
            this.isModelSpeaking = false;
            this.notifyModelSpeaking(false);

            if (this.isUserSpeaking) {
                this.updateStatus('Listening...');
            } else {
                this.updateStatus('Ready');
            }
        }
    }

    /**
     * Handle tool calls from the AI
     */
    private async handleToolCalls(functionCalls: FunctionCall[]): Promise<void> {
        log.info('Received tool calls', { count: functionCalls.length });

        this.updateStatus('Thinking...');

        const responses: any[] = [];

        for (const call of functionCalls) {
            log.info('Executing tool', { name: call.name, args: call.args });

            // Notify event handler
            if (this.eventHandlers.onToolCall) {
                this.eventHandlers.onToolCall(call.name, call.args);
            }

            try {
                // Get tool from registry
                const toolDef = getTool(call.name);

                if (!toolDef) {
                    throw new Error(`Tool not found: ${call.name}`);
                }

                // Execute tool with timeout
                const result = await this.executeToolWithTimeout(
                    toolDef.execute,
                    call.args,
                    30000 // 30 second timeout
                );

                log.info('Tool execution completed', { name: call.name, result });

                // Notify event handler
                if (this.eventHandlers.onToolResult) {
                    this.eventHandlers.onToolResult(call.name, result);
                }

                // Truncate large responses to prevent WebSocket message size errors
                const truncatedResult = this.truncateToolResponse(result, call.name);

                // Format response
                responses.push({
                    id: call.id,
                    name: call.name,
                    response: {
                        result: truncatedResult
                    }
                });

            } catch (error) {
                log.error('Tool execution failed', { name: call.name, error });

                // Use error handler to format response
                const { errorResponse, shouldRetry } = ToolExecutionHandler.handleToolError(
                    call.name,
                    error as Error,
                    call.args
                );

                // Send error response
                responses.push({
                    id: call.id,
                    name: call.name,
                    response: errorResponse
                });

                // Notify event handler
                this.handleError(new LiveAPIError(
                    LiveAPIErrorType.TOOL_EXECUTION,
                    `Tool execution failed: ${call.name}`,
                    error as Error
                ));

                // Optionally retry if error is retryable
                if (shouldRetry) {
                    log.info(`Tool ${call.name} is retryable, but not implementing retry in this version`);
                }
            }
        }

        // Send tool responses back to Live API
        if (responses.length > 0) {
            try {
                await this.session.sendToolResponse({
                    functionResponses: responses
                });
                log.info('Tool responses sent', { count: responses.length });
            } catch (error) {
                log.error('Failed to send tool responses', error);
                this.handleError(new LiveAPIError(
                    LiveAPIErrorType.CONNECTION,
                    'Failed to send tool responses',
                    error as Error
                ));
            }
        }
    }

    /**
     * Handle session errors
     */
    private handleSessionError(error: Error): void {
        log.error('Live API session error', error);

        const liveError = new LiveAPIError(
            LiveAPIErrorType.CONNECTION,
            'Live API session error',
            error
        );

        this.handleError(liveError);
        this.updateStatus('Error');
    }

    /**
     * Handle session close
     */
    private handleSessionClose(closeEvent?: any): void {
        log.info('Live API session closed', {
            code: closeEvent?.code,
            reason: closeEvent?.reason,
            wasClean: closeEvent?.wasClean,
            wasActive: this.isSessionActive
        });

        const wasActive = this.isSessionActive;
        this.isSessionActive = false;
        this.isModelSpeaking = false;
        this.isUserSpeaking = false;

        this.updateStatus('Disconnected');

        // Cleanup audio
        this.audioManager.handleInterruption();

        // Check if this is an authentication error vs normal close
        // Only show auth error if:
        // 1. Session was never active (closed immediately after opening)
        // 2. Close code is NOT 1000 (normal close) or 1001 (going away)
        // 3. Connection retry count is 0 (first attempt)
        const isNormalClose = closeEvent?.code === 1000 || closeEvent?.code === 1001;
        const wasImmediateClose = !wasActive && this.connectionRetryCount === 0;

        if (wasImmediateClose && !isNormalClose) {
            log.error('Session closed immediately after opening - possible authentication issue');

            let errorMessage = 'Failed to authenticate with Gemini Live API. Please check:\n' +
                '1. Your API key is valid and not expired\n' +
                '2. Your API key has access to Gemini Live API\n' +
                '3. You may need to enable the Gemini API in Google Cloud Console';

            // Include close event details if available
            if (closeEvent) {
                errorMessage += `\n\nClose Event Details:\n` +
                    `- Code: ${closeEvent.code || 'N/A'}\n` +
                    `- Reason: ${closeEvent.reason || 'N/A'}\n` +
                    `- Was Clean: ${closeEvent.wasClean !== undefined ? closeEvent.wasClean : 'N/A'}`;
            }

            const authError = new LiveAPIError(
                LiveAPIErrorType.CONNECTION,
                errorMessage
            );
            this.handleError(authError);
        } else if (isNormalClose) {
            log.info('Session closed normally (user initiated or clean shutdown)');
        }
    }

    /**
     * Update status and notify handlers
     */
    private updateStatus(status: VoiceModeStatus): void {
        if (this.currentStatus === status) {
            return;
        }

        this.currentStatus = status;
        log.debug('Status updated', { status });

        if (this.eventHandlers.onStatusChange) {
            this.eventHandlers.onStatusChange(status);
        }
    }

    /**
     * Notify model speaking state
     */
    private notifyModelSpeaking(isSpeaking: boolean): void {
        if (this.eventHandlers.onModelSpeaking) {
            this.eventHandlers.onModelSpeaking(isSpeaking);
        }
    }

    /**
     * Notify user speaking state
     */
    private notifyUserSpeaking(isSpeaking: boolean): void {
        if (this.eventHandlers.onUserSpeaking) {
            this.eventHandlers.onUserSpeaking(isSpeaking);
        }
    }

    /**
     * Handle errors and notify handlers
     */
    private handleError(error: LiveAPIError): void {
        log.error('GeminiLiveClient error', {
            type: error.type,
            message: error.message,
            originalError: error.originalError
        });

        if (this.eventHandlers.onError) {
            this.eventHandlers.onError(error);
        }
    }

    /**
     * Handle audio context suspended state
     */
    private async handleAudioContextSuspended(context: AudioContext): Promise<void> {
        log.warn('AudioContext suspended, attempting to resume...');

        try {
            await AudioContextHandler.handleSuspended(
                context,
                (message) => {
                    log.info('Audio context warning:', message);
                    // Could trigger UI notification here
                }
            );
        } catch (error) {
            log.error('Failed to resume audio context', error);
            this.handleError(new LiveAPIError(
                LiveAPIErrorType.AUDIO_PLAYBACK,
                'Audio context suspended',
                error as Error
            ));
        }
    }

    /**
     * Execute tool with timeout
     */
    private async executeToolWithTimeout<T>(
        fn: (args: any) => Promise<T>,
        args: any,
        timeoutMs: number
    ): Promise<T> {
        return Promise.race([
            fn(args),
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error(`Tool execution timeout after ${timeoutMs}ms`)), timeoutMs)
            )
        ]);
    }

    /**
     * Truncate tool response to prevent WebSocket message size errors
     * Live API has limits on message size, especially for large content like page text
     */
    private truncateToolResponse(result: any, toolName: string): any {
        // Max characters for content fields (adjust based on testing)
        const MAX_CONTENT_LENGTH = 50000; // ~50KB of text should be safe

        if (!result || typeof result !== 'object') {
            return result;
        }

        const truncated = { ...result };
        let wasTruncated = false;

        // Handle readPageContent specifically
        if (toolName === 'readPageContent' && truncated.content && typeof truncated.content === 'string') {
            const originalLength = truncated.content.length;
            if (originalLength > MAX_CONTENT_LENGTH) {
                truncated.content = truncated.content.substring(0, MAX_CONTENT_LENGTH);
                truncated.contentLength = truncated.content.length;
                truncated.truncated = true;
                truncated.originalLength = originalLength;
                wasTruncated = true;
                log.warn(`Truncated ${toolName} content from ${originalLength} to ${MAX_CONTENT_LENGTH} chars`);
            }
        }

        // Generic handling for any large string fields
        for (const [key, value] of Object.entries(truncated)) {
            if (typeof value === 'string' && value.length > MAX_CONTENT_LENGTH) {
                truncated[key] = value.substring(0, MAX_CONTENT_LENGTH);
                if (!truncated.truncated) {
                    truncated.truncated = true;
                    truncated.truncatedFields = [key];
                } else if (Array.isArray(truncated.truncatedFields)) {
                    truncated.truncatedFields.push(key);
                } else {
                    truncated.truncatedFields = [key];
                }
                wasTruncated = true;
                log.warn(`Truncated ${toolName}.${key} from ${value.length} to ${MAX_CONTENT_LENGTH} chars`);
            }
        }

        if (wasTruncated) {
            log.info(`Tool response truncated for Live API compatibility`, {
                toolName,
                fields: truncated.truncatedFields
            });
        }

        return truncated;
    }
}
