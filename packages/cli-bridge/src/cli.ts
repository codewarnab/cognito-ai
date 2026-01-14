#!/usr/bin/env node
import 'dotenv/config';
import { startBridgeServer } from './server';
import { autoSetupCLIs } from './cli/autoSetup';
import { logger } from './utils/logger';
import { getAgentCwd, isIsolatedMode } from './utils/sandbox';

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    console.log(`
Cognito CLI Bridge - Local coding agent server

Usage:
  cognito-bridge [options]

Options:
  --port <number>   Port to listen on (default: 8787)
  --host <string>   Host to bind to (default: 127.0.0.1)

  --gemini-model <id> Gemini model id for local chat (default: gemini-2.5-flash)
  --no-auto-setup   Skip automatic CLI tool configuration (Gemini CLI, Claude Code, Codex CLI)
  --help, -h        Show this help message

Environment Variables:
  COGNITO_BRIDGE_ALLOW_LOCAL_ACCESS=true   Disable sandbox isolation (NOT recommended)

Security:
  By default, agents run in an isolated sandbox and cannot access your local files.
  This prevents agents from reading project files (GEMINI.md, CLAUDE.md, source code)
  or executing dangerous shell commands in your project directory.

Examples:
  cognito-bridge
  cognito-bridge --port 9000

  cognito-bridge --gemini-model gemini-2.5-pro
`);
    process.exit(0);
  }

  const port = Number(getArg('--port') || '8787');
  const host = getArg('--host') || '127.0.0.1';
  const userCwd = process.cwd();
  const cwd = getAgentCwd(userCwd); // Use isolated sandbox by default
  const skipAutoSetup = hasFlag('--no-auto-setup');
  const geminiModel = getArg('--gemini-model');

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error('Error: Invalid port number');
    process.exit(1);
  }

  // Configuration surface for the AI SDK Gemini provider (Option B).
  // Chat handler reads COGNITO_GEMINI_MODEL as a default model id.
  if (geminiModel) {
    process.env.COGNITO_GEMINI_MODEL = geminiModel;
  }

  // Log isolation mode status
  if (isIsolatedMode()) {
    logger.info(`🔒 Sandbox isolation ENABLED - agents cannot access local files`);
    logger.debug('security', `Sandbox CWD: ${cwd}`);
  } else {
    logger.warn(`⚠️ Sandbox isolation DISABLED - agents have local file access!`);
  }

  await startBridgeServer({ host, port, cwd });

  // Auto-setup CLI tools (Gemini CLI, Claude Code, Codex CLI)
  if (!skipAutoSetup) {
    const results = autoSetupCLIs(port);

    const cliLines = results.map((result) => {
      const status =
        result.status === 'configured' ? 'Auto-configured' :
          result.status === 'already_configured' ? 'Already configured' :
            result.status === 'not_installed' ? 'Not installed' : `Error: ${result.message}`;

      const type: 'success' | 'warning' | 'dim' =
        result.status === 'configured' || result.status === 'already_configured' ? 'success' :
          result.status === 'not_installed' ? 'dim' : 'warning';

      const icon = type === 'success' ? '✓' : type === 'dim' ? '○' : '⚠';

      return { text: `${icon} ${result.cli}: ${status}`, type };
    });

    logger.box({
      title: 'CLI Integration',
      lines: cliLines,
      footer: { text: 'Tip: Run CLI tool once to complete OAuth login', type: 'dim' },
    });
  }
}

main().catch((err) => {
  console.error('[cognito-bridge] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
