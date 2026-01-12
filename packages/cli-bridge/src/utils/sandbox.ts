import { mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logger } from './logger';

/**
 * Name of the isolated sandbox directory
 */
const SANDBOX_NAME = 'cognito-bridge-sandbox';

/**
 * Get or create an isolated sandbox directory for agent execution.
 * 
 * This prevents agents from:
 * - Reading local project files (GEMINI.md, CLAUDE.md, source code)
 * - Writing to the user's file system
 * - Executing dangerous commands in the user's project
 * 
 * The sandbox is a temporary directory that is empty by default,
 * ensuring agents can only interact with browser extension tools.
 */
export function getIsolatedSandboxCwd(): string {
    const sandboxPath = join(tmpdir(), SANDBOX_NAME);

    if (!existsSync(sandboxPath)) {
        mkdirSync(sandboxPath, { recursive: true });
        logger.debug('sandbox', `Created isolated sandbox at: ${sandboxPath}`);
    }

    return sandboxPath;
}

/**
 * Check if we're running in isolated sandbox mode
 * Can be disabled via COGNITO_BRIDGE_ALLOW_LOCAL_ACCESS=true for development
 */
export function isIsolatedMode(): boolean {
    return process.env.COGNITO_BRIDGE_ALLOW_LOCAL_ACCESS !== 'true';
}

/**
 * Get the appropriate CWD based on isolation mode
 * 
 * @param userCwd - The user's original working directory (process.cwd())
 * @returns Sandbox path if isolated mode, otherwise user's CWD
 */
export function getAgentCwd(userCwd: string): string {
    if (isIsolatedMode()) {
        return getIsolatedSandboxCwd();
    }

    logger.debug('sandbox', 'Running in non-isolated mode - agents have local file access');
    return userCwd;
}
