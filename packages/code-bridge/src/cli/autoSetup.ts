/**
 * Auto CLI Setup
 *
 * Automatically detects and configures CLI tools (Gemini CLI, Claude Code)
 * to use the code-bridge MCP server.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

export interface SetupResult {
    cli: string;
    status: 'configured' | 'already_configured' | 'not_installed' | 'error';
    message?: string;
}

/**
 * Auto-setup all supported CLIs
 */
export function autoSetupCLIs(port: number): SetupResult[] {
    const results: SetupResult[] = [];

    results.push(setupGeminiCLI(port));
    results.push(setupClaudeCLI(port));

    return results;
}

/**
 * Check if Gemini CLI is installed
 */
function isGeminiCLIInstalled(): boolean {
    try {
        execSync('gemini --version', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Setup Gemini CLI with MCP server
 */
function setupGeminiCLI(port: number): SetupResult {
    // Check if gemini CLI is installed
    if (!isGeminiCLIInstalled()) {
        return { cli: 'Gemini CLI', status: 'not_installed' };
    }

    const settingsPath = join(homedir(), '.gemini', 'settings.json');
    const mcpUrl = `http://127.0.0.1:${port}/mcp`;

    try {
        // Ensure directory exists
        mkdirSync(dirname(settingsPath), { recursive: true });

        // Read or initialize settings
        let settings: any = {};
        if (existsSync(settingsPath)) {
            try {
                settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
            } catch {
                // If invalid JSON, start fresh (or could backup, but for now simple overwrite of invalid/empty file is safer for recovery)
            }
        }

        // Initialize mcpServers if missing
        if (!settings.mcpServers) {
            settings.mcpServers = {};
        }

        const existingConfig = settings.mcpServers.cognito;

        // Check if update is needed (url mismatch or 'type' field exists)
        const needsUpdate =
            !existingConfig || existingConfig.url !== mcpUrl || existingConfig.type !== undefined;

        if (!needsUpdate) {
            return { cli: 'Gemini CLI', status: 'already_configured' };
        }

        // Update configuration
        settings.mcpServers.cognito = {
            url: mcpUrl,
            trust: true,
        };

        // Explicitly ensure 'type' is undefined (fixes the "Unrecognized key" error)
        // Note: The assignment above replaces the whole object, so 'type' is gone, 
        // but if we were merging, we'd delete it: delete settings.mcpServers.cognito.type;

        // Write back to file
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

        return { cli: 'Gemini CLI', status: 'configured' };
    } catch (e) {
        return {
            cli: 'Gemini CLI',
            status: 'error',
            message: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * Setup Claude Code with MCP server
 */
function setupClaudeCLI(port: number): SetupResult {
    const claudeDir = join(homedir(), '.claude');
    const mcpConfigPath = join(claudeDir, 'mcp.json');

    // Check if Claude Code directory exists (indicates it's installed)
    if (!existsSync(claudeDir)) {
        return { cli: 'Claude Code', status: 'not_installed' };
    }

    // Check if already registered
    if (existsSync(mcpConfigPath)) {
        try {
            const config = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
            if (config.mcpServers?.cognito) {
                // Check if the URL matches (in case port changed)
                const existingUrl = config.mcpServers.cognito.url;
                const expectedUrl = `http://127.0.0.1:${port}/mcp`;
                if (existingUrl === expectedUrl) {
                    return { cli: 'Claude Code', status: 'already_configured' };
                }
                // Port mismatch - update below
            }
        } catch {
            // Continue with registration
        }
    }

    // Register by writing to mcp.json
    try {
        // Read existing config or create new one
        let config: { mcpServers?: Record<string, { url: string }> } = { mcpServers: {} };
        if (existsSync(mcpConfigPath)) {
            try {
                config = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
            } catch {
                // Use empty config if parsing fails
            }
        }

        config.mcpServers = config.mcpServers || {};
        config.mcpServers.cognito = {
            url: `http://127.0.0.1:${port}/mcp`,
        };

        // Ensure directory exists and write config
        mkdirSync(dirname(mcpConfigPath), { recursive: true });
        writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));

        return { cli: 'Claude Code', status: 'configured' };
    } catch (e) {
        return {
            cli: 'Claude Code',
            status: 'error',
            message: e instanceof Error ? e.message : String(e),
        };
    }
}
