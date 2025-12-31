import { spawn } from 'node:child_process';
import type { AgentDefinition } from './types.js';

/**
 * Available coding agents
 */
export const CODE_MODE_AGENTS: AgentDefinition[] = [
  {
    name: 'Gemini CLI',
    command: 'gemini',
    args: ['--experimental-acp'],
    envHints: ['GEMINI_API_KEY'],
  },
  {
    name: 'Claude Code',
    command: 'claude',
    args: ['--acp'],
    envHints: ['ANTHROPIC_API_KEY'],
  },
  {
    name: 'Codex CLI',
    command: 'codex',
    args: ['--acp'],
    envHints: ['OPENAI_API_KEY'],
  },
];

/**
 * Check if a command exists on PATH
 */
export function checkCommandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Use 'where' on Windows, 'which' on Unix
    const checkCmd = process.platform === 'win32' ? 'where' : 'which';
    
    const child = spawn(checkCmd, [command], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    
    child.on('close', (code) => {
      resolve(code === 0);
    });
    
    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Get agent availability info
 */
export async function getAgentsWithAvailability(): Promise<
  Array<AgentDefinition & { available: boolean }>
> {
  const results = await Promise.all(
    CODE_MODE_AGENTS.map(async (agent) => ({
      ...agent,
      available: await checkCommandExists(agent.command),
    }))
  );
  
  return results;
}

/**
 * Find an agent by name
 */
export function findAgent(name: string): AgentDefinition | undefined {
  return CODE_MODE_AGENTS.find(
    (a) => a.name.toLowerCase() === name.toLowerCase()
  );
}
