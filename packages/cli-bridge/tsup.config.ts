import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node18',
  platform: 'node',
  outDir: 'dist',
  // Add shebang for CLI entry point
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Don't bundle dependencies - they should be installed by npm
  // NOTE: @cognito/shared is intentionally NOT external — it's bundled inline
  // because it's a workspace-only package not published to npm.
  external: [
    '@modelcontextprotocol/sdk',
    'ai',
    'ai-sdk-provider-claude-code',
    'ai-sdk-provider-codex-cli',
    'ai-sdk-provider-gemini-cli',
    'chalk',
    'dotenv',
    'zod',
  ],
});
