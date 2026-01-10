import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import type { ContentPart } from '../types.js';

/**
 * ACP (Agent Client Protocol) Provider
 * 
 * Uses the official @agentclientprotocol/sdk to communicate with
 * agents like Gemini CLI via JSON-RPC over stdio.
 */

/**
 * Convert extension content parts to ACP ContentBlock format
 */
function convertToACPContentBlocks(parts: ContentPart[]): acp.ContentBlock[] {
  return parts.map((part): acp.ContentBlock => {
    switch (part.type) {
      case 'text':
        return { type: 'text', text: part.text };
      case 'image':
        return { type: 'image', data: part.data, mimeType: part.mimeType };
      case 'audio':
        return { type: 'audio', data: part.data, mimeType: part.mimeType };
      case 'resource':
        return {
          type: 'resource',
          resource: {
            blob: part.data,
            mimeType: part.mimeType,
            uri: `file://${part.name}`,
          },
        };
      default:
        throw new Error(`Unknown content type: ${(part as { type: string }).type}`);
    }
  });
}

export interface ACPProviderConfig {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string | undefined>;
  /**
   * MCP servers the agent should connect to for this ACP session.
   * This is the primary way we "give tools" to ACP agents (Gemini CLI, Claude Code, etc).
   */
  mcpServers?: acp.McpServer[];
}

export interface ACPMessage {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done' | 'status';
  content?: string;
  toolName?: string;
  toolCallId?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  status?: string;
}

/**
 * Client implementation that handles agent requests
 */
class BridgeClient implements acp.Client {
  private emitter: EventEmitter;

  constructor(emitter: EventEmitter) {
    this.emitter = emitter;
  }

  async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
    console.log('[ACP Client] Permission requested:', params.toolCall.title);

    // Auto-approve for now (you can make this interactive later)
    // Just use the first option available
    const allowOption = params.options[0];

    return {
      outcome: {
        outcome: 'selected',
        optionId: allowOption.optionId,
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;

    console.log('[ACP Client] Session update:', update.sessionUpdate);

    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        if (update.content.type === 'text') {
          this.emitter.emit('message', {
            type: 'text',
            content: update.content.text,
          } as ACPMessage);
        }
        break;

      case 'tool_call':
        this.emitter.emit('message', {
          type: 'tool_call',
          toolName: update.title,
          toolCallId: update.toolCallId,
          args: {},
        } as ACPMessage);
        break;

      case 'tool_call_update':
        console.log(`[ACP Client] Tool call ${update.toolCallId} updated: ${update.status}`);
        break;

      default:
        console.log(`[ACP Client] Unhandled update: ${update.sessionUpdate}`);
        break;
    }
  }

  async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
    console.log('[ACP Client] writeTextFile:', params.path);
    // The bridge should handle file operations
    return {};
  }

  async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
    console.log('[ACP Client] readTextFile:', params.path);
    // The bridge should handle file operations
    return { content: '' };
  }
}

export class ACPProvider extends EventEmitter {
  private process: ChildProcess | null = null;
  private connection: acp.ClientSideConnection | null = null;
  private sessionId: string | null = null;
  private config: ACPProviderConfig;

  constructor(config: ACPProviderConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the agent process and initialize ACP connection
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error('Agent already started');
    }

    const env = {
      ...process.env,
      ...this.config.env,
    };

    console.log('[ACP] Starting agent...');
    console.log('[ACP]   Command:', this.config.command);
    console.log('[ACP]   Args:', this.config.args.join(' '));
    console.log('[ACP]   CWD:', this.config.cwd);

    this.emit('message', { type: 'status', status: 'Starting agent...' } as ACPMessage);

    return new Promise((resolve, reject) => {
      const proc = spawn(this.config.command, this.config.args, {
        cwd: this.config.cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        // Required on Windows to execute .cmd/.bat files (like npm-installed CLIs)
        shell: process.platform === 'win32',
      });

      console.log('[ACP] Process spawned, PID:', proc.pid);
      this.emit('message', { type: 'status', status: 'Process spawned...' } as ACPMessage);

      this.process = proc;

      proc.stderr?.on('data', (data: Buffer) => {
        const output = data.toString('utf-8');
        console.error('[ACP stderr]', output);
      });

      proc.on('close', (code) => {
        console.log('[ACP] Process closed with code:', code);
        this.emit('close', code);
        this.process = null;
        this.connection = null;
        this.sessionId = null;
      });

      proc.on('error', (err) => {
        console.error('[ACP] Process error:', err.message);
        this.emit('error', err);
        this.process = null;
        reject(new Error(`Failed to spawn agent process: ${err.message}`));
      });

      // Set up ACP connection using the SDK
      this.initializeConnection(proc)
        .then(() => {
          console.log('[ACP] Connection initialized');
          resolve();
        })
        .catch((err) => {
          console.error('[ACP] Connection initialization failed:', err.message);
          proc.kill();
          reject(err);
        });
    });
  }

  /**
   * Initialize the ACP connection with the agent
   */
  private async initializeConnection(proc: ChildProcess): Promise<void> {
    // Create streams for communication
    const input = Writable.toWeb(proc.stdin!);
    const output = Readable.toWeb(proc.stdout!) as ReadableStream<Uint8Array>;

    // Create the client and connection
    const client = new BridgeClient(this);
    const stream = acp.ndJsonStream(input, output);
    this.connection = new acp.ClientSideConnection((_agent) => client, stream);

    console.log('[ACP] Initializing protocol...');
    this.emit('message', { type: 'status', status: 'Initializing protocol...' } as ACPMessage);

    // Initialize the connection
    const initResult = await this.connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
      },
    });

    console.log(`[ACP] Connected to agent (protocol v${initResult.protocolVersion})`);
    this.emit('message', { type: 'status', status: 'Connected to agent...' } as ACPMessage);

    // Create a new session
    this.emit('message', { type: 'status', status: 'Creating session...' } as ACPMessage);
    const sessionResult = await this.connection.newSession({
      cwd: this.config.cwd,
      mcpServers: this.config.mcpServers ?? [],
    });

    this.sessionId = sessionResult.sessionId;
    console.log(`[ACP] Created session: ${this.sessionId}`);
    this.emit('message', { type: 'status', status: 'Session ready' } as ACPMessage);
  }

  /**
   * Send a chat message and get streaming response
   * Supports multimodal content: text, images, audio, and documents
   */
  async chat(params: {
    messages: Array<{ role: string; content: ContentPart[] }>;
    systemPrompt?: string;
  }): Promise<void> {
    if (!this.connection || !this.sessionId) {
      throw new Error('Agent not started');
    }

    // Get the last user message
    const lastUserMessage = params.messages
      .filter(m => m.role === 'user')
      .pop();

    if (!lastUserMessage) {
      this.emit('message', { type: 'error', error: 'No user message found' } as ACPMessage);
      this.emit('message', { type: 'done' } as ACPMessage);
      return;
    }

    // Convert content parts to ACP format
    const promptBlocks = convertToACPContentBlocks(lastUserMessage.content);

    // Prepend system prompt if provided
    if (params.systemPrompt) {
      promptBlocks.unshift({ type: 'text', text: params.systemPrompt });
    }

    // Log what we're sending
    const textParts = lastUserMessage.content.filter(p => p.type === 'text');
    const imageParts = lastUserMessage.content.filter(p => p.type === 'image');
    const audioParts = lastUserMessage.content.filter(p => p.type === 'audio');
    const resourceParts = lastUserMessage.content.filter(p => p.type === 'resource');

    console.log('[ACP] Sending multimodal prompt:', {
      textParts: textParts.length,
      images: imageParts.length,
      audio: audioParts.length,
      resources: resourceParts.length,
    });

    this.emit('message', { type: 'status', status: 'Sending message...' } as ACPMessage);

    try {
      const promptResult = await this.connection.prompt({
        sessionId: this.sessionId,
        prompt: promptBlocks,
      });

      console.log(`[ACP] Agent completed with: ${promptResult.stopReason}`);
      this.emit('message', { type: 'done' } as ACPMessage);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[ACP] Prompt error:', errorMessage);
      this.emit('message', { type: 'error', error: errorMessage } as ACPMessage);
      this.emit('message', { type: 'done' } as ACPMessage);
    }
  }

  /**
   * Stop the agent process
   */
  cleanup(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.connection = null;
      this.sessionId = null;
    }
  }
}

/**
 * Create an ACP provider instance
 */
export function createACPProvider(config: ACPProviderConfig): ACPProvider {
  return new ACPProvider(config);
}
