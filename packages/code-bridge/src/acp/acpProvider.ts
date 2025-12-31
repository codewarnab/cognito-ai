import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

/**
 * ACP (Agent Communication Protocol) Provider
 * 
 * This is a simplified implementation that spawns a local CLI agent
 * and communicates via stdin/stdout using JSON-RPC style messages.
 * 
 * Note: This is a placeholder implementation. The actual ACP protocol
 * may differ based on the specific agent CLI being used.
 */

export interface ACPProviderConfig {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string | undefined>;
}

export interface ACPMessage {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolCallId?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export class ACPProvider extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: ACPProviderConfig;
  private buffer = '';

  constructor(config: ACPProviderConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the agent process
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error('Agent already started');
    }

    const env = {
      ...process.env,
      ...this.config.env,
    };

    this.process = spawn(this.config.command, this.config.args, {
      cwd: this.config.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleOutput(data.toString('utf-8'));
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      console.error('[ACP stderr]', data.toString('utf-8'));
    });

    this.process.on('close', (code) => {
      this.emit('close', code);
      this.process = null;
    });

    this.process.on('error', (err) => {
      this.emit('error', err);
    });

    // Wait a bit for the process to start
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Handle output from the agent
   */
  private handleOutput(data: string): void {
    this.buffer += data;

    // Try to parse complete JSON messages (newline-delimited)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as ACPMessage;
        this.emit('message', message);
      } catch {
        // Not JSON, treat as plain text
        this.emit('message', { type: 'text', content: line } as ACPMessage);
      }
    }
  }

  /**
   * Send a message to the agent
   */
  send(message: Record<string, unknown>): void {
    if (!this.process?.stdin) {
      throw new Error('Agent not started');
    }

    this.process.stdin.write(JSON.stringify(message) + '\n');
  }

  /**
   * Send a chat message and get streaming response
   */
  async chat(params: {
    messages: Array<{ role: string; content: string }>;
    systemPrompt?: string;
  }): Promise<void> {
    this.send({
      type: 'chat',
      messages: params.messages,
      systemPrompt: params.systemPrompt,
    });
  }

  /**
   * Stop the agent process
   */
  cleanup(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

/**
 * Create an ACP provider instance
 */
export function createACPProvider(config: ACPProviderConfig): ACPProvider {
  return new ACPProvider(config);
}
