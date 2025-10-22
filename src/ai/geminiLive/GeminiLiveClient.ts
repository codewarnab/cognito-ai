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
import {
    browserActionAgentDeclaration,
    executeBrowserActionAgent,
    getBrowserCapabilitiesSummary
} from '../agents/browserActionAgent';
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
    private agentToolExecutors: Map<string, (args: any) => Promise<any>> = new Map();

    // Instance tracking for preventing multiple sessions
    private static instanceCount = 0;
    private instanceId: number;
    private isCleanedUp = false;
    private sessionStartPromise: Promise<void> | null = null;

    constructor(config: GeminiLiveClientConfig) {
        // Track instance creation
        GeminiLiveClient.instanceCount++;
        this.instanceId = GeminiLiveClient.instanceCount;

        if (GeminiLiveClient.instanceCount > 1) {
            log.warn(`⚠️ Multiple GeminiLiveClient instances detected! Current count: ${GeminiLiveClient.instanceCount}. Consider using GeminiLiveManager for singleton management.`);
        }

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

        log.info(`GeminiLiveClient #${this.instanceId} created`, {
            model: this.config.model,
            voiceName: this.config.voiceName,
            enableTools: this.config.enableTools,
            totalInstances: GeminiLiveClient.instanceCount
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
        if (this.isCleanedUp) {
            throw new LiveAPIError(
                LiveAPIErrorType.SESSION_CLOSED,
                `Client #${this.instanceId} has been cleaned up and cannot start a session`
            );
        }

        if (!this.isInitialized) {
            throw new LiveAPIError(
                LiveAPIErrorType.INITIALIZATION,
                'Client not initialized. Call initialize() first.'
            );
        }

        if (this.isSessionActive) {
            log.warn(`Session already active on client #${this.instanceId}`);
            return;
        }

        // If session start is in progress, wait for it
        if (this.sessionStartPromise) {
            log.info(`Session start already in progress for client #${this.instanceId}, waiting...`);
            return this.sessionStartPromise;
        }

        // API key is hardcoded in initialize(), no need to validate here
        log.info(`Starting session with hardcoded API key on client #${this.instanceId}`);

        const wsHandler = this.errorHandler.getWebSocketHandler();

        this.sessionStartPromise = wsHandler.handleConnectionFailure(
            async () => {
                try {
                    this.updateStatus('Connecting...');
                    log.info(`Starting Live API session on client #${this.instanceId}...`);

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
                                log.info(`Live API session opened via callback on client #${this.instanceId}`);
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

                    log.info(`Live API session connected on client #${this.instanceId}`);
                    this.connectionRetryCount = 0; // Reset on success

                } catch (error) {
                    this.connectionRetryCount++;
                    const liveError = new LiveAPIError(
                        LiveAPIErrorType.CONNECTION,
                        `Failed to connect to Live API on client #${this.instanceId}`,
                        error as Error
                    );
                    this.handleError(liveError);
                    throw liveError;
                } finally {
                    this.sessionStartPromise = null;
                }
            },
            (status) => this.updateStatus(status as VoiceModeStatus)
        ).then(() => { });

        return this.sessionStartPromise;
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

            // Clear agent tool executors
            this.agentToolExecutors.clear();

            this.isSessionActive = false;
            this.updateStatus('Ready');

            log.info('Live API session stopped');

        } catch (error) {
            log.error('Error stopping session', error);
            // Continue cleanup even if close fails
            this.session = null;
            this.agentToolExecutors.clear();
            this.isSessionActive = false;
            this.updateStatus('Error');
        }
    }

    /**
     * Cleanup all resources
     */
    cleanup(): void {
        if (this.isCleanedUp) {
            log.warn(`Client #${this.instanceId} already cleaned up`);
            return;
        }

        log.info(`Cleaning up GeminiLiveClient #${this.instanceId}...`);

        // Stop session if active
        if (this.isSessionActive) {
            this.stopSession().catch(err => log.error('Error in cleanup stopSession', err));
        }

        // Cleanup audio manager
        this.audioManager.cleanup();

        this.client = null;
        this.isInitialized = false;
        this.isCleanedUp = true;
        this.updateStatus('Ready');

        // Decrement instance count
        GeminiLiveClient.instanceCount--;

        log.info(`GeminiLiveClient #${this.instanceId} cleaned up. Remaining instances: ${GeminiLiveClient.instanceCount}`);
    }

    /**
     * Get instance diagnostics
     */
    getDiagnostics(): {
        instanceId: number;
        isInitialized: boolean;
        isSessionActive: boolean;
        isCleanedUp: boolean;
        currentStatus: VoiceModeStatus;
        totalInstances: number;
    } {
        return {
            instanceId: this.instanceId,
            isInitialized: this.isInitialized,
            isSessionActive: this.isSessionActive,
            isCleanedUp: this.isCleanedUp,
            currentStatus: this.currentStatus,
            totalInstances: GeminiLiveClient.instanceCount
        };
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
     * MODIFIED: Now only exposes agent tool instead of individual browser tools
     * Gemini Live models struggle with structured tool calling, so we use an agent
     */
    private async getToolDeclarations(): Promise<any[]> {
        try {
            log.info('🤖 Preparing agent tool for Gemini Live (voice-optimized)');

            // Instead of exposing all tools, we expose ONLY the intelligent agent
            // that can handle natural language task descriptions

            // Create executor wrapper and store it for handleToolCalls
            const browserActionExecutor = async (args: any) => {
                return await executeBrowserActionAgent(args);
            };

            // Store executor in the map so handleToolCalls can find it
            this.agentToolExecutors.set('executeBrowserAction', browserActionExecutor);

            log.info('Agent tool prepared', {
                name: browserActionAgentDeclaration.name,
                description: browserActionAgentDeclaration.description?.substring(0, 100) + '...'
            });

            // Return the declaration directly (already in Gemini Live format)
            return [browserActionAgentDeclaration];

        } catch (error) {
            log.error('Failed to get tool declarations', error);
            return [];
        }
    }

    /**
     * Get default system instruction optimized for voice conversation with agent-based tool use
     */
    private getDefaultSystemInstruction(): string {
        // Get browser capabilities summary from the agent
        const capabilities = getBrowserCapabilitiesSummary();

        return `You are an intelligent AI assistant integrated into a Chrome browser extension, speaking via voice.

${capabilities}

**How to Use Your Tool:**

You have ONE main tool available:

**executeBrowserAction** - For ALL browser-related tasks including YouTube video analysis
   - Describe what you want to do in DETAILED natural language
   - The tool handles technical execution - you provide clear intent
   - For complex tasks, include all necessary details in your task description
   - Examples: "Click the sign in button", "Type hello into the search box", "Analyze this YouTube video and tell me the key takeaways"



**What You Can Do With YouTube Videos:**
- Summarizing YouTube videos (any length, auto-chunked)
- Extracting key takeaways and main points
- Answering ANY specific questions about video content
- Analyzing topics, themes, and important information
- Providing timestamps and detailed breakdowns
- Comparing multiple videos
- Finding specific information in videos

**When User Asks About a YouTube Video:**
1. ✅ ALWAYS help - NEVER decline
2. ✅ Immediately delegate to executeBrowserAction with detailed task description
3. ✅ Include the user's specific question or request
4. ✅ Be enthusiastic and helpful
5. ❌ NEVER say: "I can't watch videos", "I can't access video content", "I don't have that capability"

**YouTube Examples:**

User: "Summarize this YouTube video" OR "Summarize this video" OR "What's this video about?"
You: "I'll analyze the video and provide a comprehensive summary for you!" 
→ executeBrowserAction("Analyze the YouTube video currently open in the active tab and provide a comprehensive summary including the main topic, key points, and important takeaways")

User: "Analyze this video" OR "Tell me about this video"
You: "Let me analyze this video for you!"
→ executeBrowserAction("Analyze the YouTube video currently open in the active tab and provide a comprehensive summary including the main topic, key points, and important takeaways")

User: "What are the key takeaways from this video?"
You: "I'll extract the key takeaways for you right now!"
→ executeBrowserAction("Analyze the YouTube video in the active tab and identify the key takeaways and main points")

User: "What is this video about?"
You: "Let me check what this video covers!"
→ executeBrowserAction("Analyze the YouTube video currently playing and explain what it's about, including the main topic and purpose")

User: "Give me the main points from this video"
You: "I'll extract the main points for you right away!"
→ executeBrowserAction("Analyze the YouTube video currently open and identify all the main points, key arguments, and important information discussed")

User: "Can you watch this video?" OR "Can you help with this video?"
You: "Absolutely! I can analyze this video for you. What would you like to know about it?"
[Wait for their specific request, then delegate appropriately]



- **LANGUAGE**: ALWAYS speak in English unless the user explicitly asks you to respond in another language. If the user speaks in another language but doesn't specifically request a response in that language, continue responding in English.

- **Task Descriptions Must Be DETAILED**:
  - Include specific details: what to click, what to type, where to navigate
  - For YouTube: specify what information you want extracted
  - If user request is vague, ask clarifying questions BEFORE delegating
  - Example: User says "type my email" → Ask "What email address should I type, and in which field?"

- **Confirm When Uncertain**:
  - If missing critical details (email address, specific button name, etc.), ASK the user
  - Don't make assumptions about user data or preferences
  - For navigation tasks, confirm the exact URL if ambiguous
  - Example: User says "open my profile" → Ask "Which website's profile would you like to open?"

- **After Task Completion**:
  - Report what was accomplished
  - Suggest relevant next actions based on context
  - Example: After opening YouTube → "I've opened YouTube. Would you like me to search for something specific, or analyze a particular video?"

- **Be Conversational**:
  - Friendly and natural voice interaction
  - Acknowledge actions before executing
  - Keep responses concise but informative
  - Proactively suggest capabilities when relevant

**Comprehensive Examples:**

User: "Click the login button"
You: "I'll click the login button for you." 
→ executeBrowserAction("Locate and click the login button on the current page")

User: "Type my email"
You: "What email address would you like me to type, and which field should I enter it in?"
User: "john@example.com in the email field"
You: "I'll type john@example.com into the email field."
→ executeBrowserAction("Type john@example.com into the email input field on the current page")

User: "What does this page say?"
You: "Let me read the page content for you." 
→ executeBrowserAction("Read and extract all the main text content from the current page")

User: "Open LinkedIn"
You: "Opening LinkedIn in a new tab." 
→ executeBrowserAction("Open https://www.linkedin.com in a new browser tab")
Then suggest: "LinkedIn is now open. Would you like me to search for someone or navigate to your profile?"

User: "Give me the main points from this video"
You: "I'll analyze the video and extract the main points."
→ executeBrowserAction("Analyze the YouTube video currently open and identify all the main points, key arguments, and important information discussed")
Then suggest: "I've extracted the main points. Would you like me to dive deeper into any specific topic, or help you take notes?"

You're having a natural conversation with the user. The technical complexity is handled by the intelligent browser agent - your job is to understand user intent, gather necessary details, and delegate with clear, comprehensive task descriptions.`;
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
        log.info('🔧 Received tool calls from Gemini Live', {
            count: functionCalls.length,
            tools: functionCalls.map(fc => ({ name: fc.name, args: fc.args }))
        });

        this.updateStatus('Thinking...');

        const responses: any[] = [];

        for (const call of functionCalls) {
            log.info('🎯 Executing tool', {
                name: call.name,
                args: call.args,
                callId: call.id
            });

            // Notify event handler
            if (this.eventHandlers.onToolCall) {
                this.eventHandlers.onToolCall(call.name, call.args);
            }

            try {
                // First check if this is an agent tool
                const agentExecutor = this.agentToolExecutors.get(call.name);

                let result: any;

                if (agentExecutor) {
                    // Execute agent tool
                    log.info('🤖 Executing agent tool (Browser Action Agent)', {
                        name: call.name,
                        taskDescription: call.args?.taskDescription
                    });

                    const startTime = Date.now();
                    result = await agentExecutor(call.args); // No timeout - allow agent to complete
                    const duration = Date.now() - startTime;

                    log.info('✅ Agent tool completed', {
                        name: call.name,
                        duration: `${duration}ms`,
                        resultType: typeof result,
                        hasResult: !!result,
                        resultKeys: typeof result === 'object' && result ? Object.keys(result) : [],
                        resultPreview: JSON.stringify(result).substring(0, 300) + '...'
                    });
                } else {
                    // Fallback: Get tool from registry (for backwards compatibility)
                    const toolDef = getTool(call.name);

                    if (!toolDef) {
                        throw new Error(`Tool not found: ${call.name}`);
                    }

                    // Execute regular tool with timeout
                    log.info('🔨 Executing regular tool from registry', { name: call.name });
                    const startTime = Date.now();
                    result = await toolDef.execute(call.args); // No timeout
                    const duration = Date.now() - startTime;

                    log.info('✅ Regular tool completed', {
                        name: call.name,
                        duration: `${duration}ms`,
                        resultPreview: JSON.stringify(result).substring(0, 200) + '...'
                    });
                }

                log.info('📊 Tool execution completed - Full result', {
                    name: call.name,
                    result,
                    resultJSON: JSON.stringify(result, null, 2)
                });

                // Notify event handler
                if (this.eventHandlers.onToolResult) {
                    this.eventHandlers.onToolResult(call.name, result);
                }

                // Truncate large responses to prevent WebSocket message size errors
                const truncatedResult = this.truncateToolResponse(result, call.name);

                log.info('📦 Preparing response for Gemini Live', {
                    name: call.name,
                    callId: call.id,
                    originalResultLength: JSON.stringify(result).length,
                    truncatedResultLength: JSON.stringify(truncatedResult).length,
                    wasTruncated: JSON.stringify(result).length !== JSON.stringify(truncatedResult).length,
                    truncatedResult: truncatedResult
                });

                // Format response
                responses.push({
                    id: call.id,
                    name: call.name,
                    response: {
                        result: truncatedResult
                    }
                });

            } catch (error) {
                log.error('❌ Tool execution failed', {
                    name: call.name,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });

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
                log.info('📤 Sending tool responses back to Gemini Live', {
                    count: responses.length,
                    responses: responses.map(r => ({
                        id: r.id,
                        name: r.name,
                        hasResult: !!r.response?.result,
                        resultType: typeof r.response?.result,
                        resultPreview: JSON.stringify(r.response).substring(0, 200) + '...'
                    })),
                    fullResponses: responses
                });

                await this.session.sendToolResponse({
                    functionResponses: responses
                });

                log.info('✅ Tool responses sent successfully to Gemini Live', {
                    count: responses.length
                });
            } catch (error) {
                log.error('❌ Failed to send tool responses', {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    responses
                });
                this.handleError(new LiveAPIError(
                    LiveAPIErrorType.CONNECTION,
                    'Failed to send tool responses',
                    error as Error
                ));
            }
        } else {
            log.warn('⚠️ No tool responses to send (all tools may have failed)');
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
