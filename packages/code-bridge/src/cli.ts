#!/usr/bin/env node

import { startBridgeServer } from './server.js';

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
  --help, -h        Show this help message

Examples:
  cognito-bridge
  cognito-bridge --port 9000
  cognito-bridge --cwd /path/to/project
`);
    process.exit(0);
  }

  const port = Number(getArg('--port') || '8787');
  const host = getArg('--host') || '127.0.0.1';
  const cwd = getArg('--cwd') || process.cwd();

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error('Error: Invalid port number');
    process.exit(1);
  }

  await startBridgeServer({ host, port, cwd });
}

main().catch((err) => {
  console.error('[cognito-bridge] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
