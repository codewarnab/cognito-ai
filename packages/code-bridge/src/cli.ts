#!/usr/bin/env node

import { startBridgeServer } from './server.js';
import { autoSetupCLIs } from './cli/autoSetup.js';

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
Cognito Code Bridge - Local coding agent server

Usage:
  cognito-bridge [options]

Options:
  --port <number>   Port to listen on (default: 8787)
  --host <string>   Host to bind to (default: 127.0.0.1)
  --cwd <path>      Working directory for file operations (default: current directory)
  --gemini-model <id> Gemini model id for local chat (default: gemini-3-flash-preview)
  --no-auto-setup   Skip automatic CLI tool configuration (Gemini CLI, Claude Code)
  --help, -h        Show this help message

Examples:
  cognito-bridge
  cognito-bridge --port 9000
  cognito-bridge --cwd /path/to/project
  cognito-bridge --gemini-model gemini-3-pro-preview
`);
    process.exit(0);
  }

  const port = Number(getArg('--port') || '8787');
  const host = getArg('--host') || '127.0.0.1';
  const cwd = getArg('--cwd') || process.cwd();
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

  await startBridgeServer({ host, port, cwd });

  // Auto-setup CLI tools (Gemini CLI, Claude Code)
  if (!skipAutoSetup) {
    console.log('');
    console.log('CLI Integration:');
    const results = autoSetupCLIs(port);

    for (const result of results) {
      const icon =
        result.status === 'configured' ? '✓' :
          result.status === 'already_configured' ? '✓' :
            result.status === 'not_installed' ? '○' : '⚠';

      const status =
        result.status === 'configured' ? 'Auto-configured' :
          result.status === 'already_configured' ? 'Already configured' :
            result.status === 'not_installed' ? 'Not installed' : `Error: ${result.message}`;

      console.log(`  ${icon} ${result.cli}: ${status}`);
    }

    console.log('');
    console.log('Tip: If you use Gemini OAuth, run "gemini" once to complete login.');
    console.log('');
  }
}

main().catch((err) => {
  console.error('[cognito-bridge] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
