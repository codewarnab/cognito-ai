/**
 * Service Worker Keep-Alive Management
 * 
 * Chrome MV3 service workers can be terminated after 30 seconds of inactivity.
 * This module provides functionality to keep the service worker alive when
 * MCP servers are enabled by periodically calling Chrome APIs.
 * 
 * Strategy: Call chrome.runtime.getPlatformInfo every 20 seconds to prevent
 * service worker termination (Chrome 110+ exploit).
 */

import { createLogger } from '~logger';
import { serverStates } from '../mcp/state';

const log = createLogger('Background-KeepAlive', 'BACKGROUND');

/**
 * Chrome API keep-alive interval to prevent service worker termination.
 * This exploit calls chrome.runtime.getPlatformInfo every 20 seconds
 * to keep the service worker running when MCP servers are enabled.
 */
let keepAliveInterval: number | null = null;

/**
 * Start keep-alive when at least one MCP server is enabled
 * 
 * Initiates a periodic timer that calls chrome.runtime.getPlatformInfo every 20 seconds.
 * This prevents the service worker from being terminated while MCP servers are active.
 * 
 * Note: This is only needed when at least one MCP server is enabled. When all servers
 * are disabled, the keep-alive should be stopped to conserve resources.
 */
export function startMCPKeepAlive(): void {
    if (keepAliveInterval !== null) {
        log.info('Keep-alive already running');
        return;
    }

    log.info('Starting MCP keep-alive to prevent service worker termination');

    // Call chrome.runtime.getPlatformInfo every 20 seconds
    // This keeps service worker alive indefinitely (Chrome 110+ exploit)
    keepAliveInterval = setInterval(() => {
        chrome.runtime.getPlatformInfo(() => {
            // No-op callback, just keeping worker alive
        });
    }, 20000) as unknown as number;

    log.info('Keep-alive started successfully');
}

/**
 * Stop keep-alive when all MCP servers are disabled
 * 
 * Clears the periodic timer to allow the service worker to be terminated normally.
 * This should be called when the last MCP server is disabled to conserve resources.
 */
export function stopMCPKeepAlive(): void {
    if (keepAliveInterval === null) {
        return;
    }

    log.info('Stopping MCP keep-alive');
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    log.info('Keep-alive stopped');
}

/**
 * Check if any MCP server is currently enabled
 * 
 * Iterates through all server states to determine if at least one server
 * is currently enabled. This is used to decide whether keep-alive should
 * be active or not.
 * 
 * @returns True if at least one MCP server is enabled, false otherwise
 */
export function hasEnabledMCPServers(): boolean {
    for (const [_serverId, state] of serverStates) {
        if (state.isEnabled) {
            return true;
        }
    }
    return false;
}

/**
 * Update keep-alive state based on enabled MCP servers
 * 
 * Checks if any MCP servers are enabled and starts or stops the keep-alive
 * mechanism accordingly. This should be called whenever a server is enabled
 * or disabled to ensure the keep-alive state is synchronized.
 * 
 * Logic:
 * - If at least one server is enabled and keep-alive is not running: start it
 * - If no servers are enabled and keep-alive is running: stop it
 */
export function updateKeepAliveState(): void {
    const hasEnabled = hasEnabledMCPServers();

    if (hasEnabled && keepAliveInterval === null) {
        startMCPKeepAlive();
    } else if (!hasEnabled && keepAliveInterval !== null) {
        stopMCPKeepAlive();
    }
}

