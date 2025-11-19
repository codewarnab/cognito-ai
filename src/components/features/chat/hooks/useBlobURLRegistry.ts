/**
 * Blob URL Registry
 * Manages lifecycle of Blob URLs to prevent memory leaks
 */

import { useEffect, useRef } from 'react';
import { createLogger } from '@logger';

const log = createLogger('BlobURLRegistry');

/**
 * Global registry of active Blob URLs
 * Maps message IDs to their Blob URLs
 */
class BlobURLRegistry {
    private registry = new Map<string, Set<string>>();

    /**
     * Register a Blob URL for a specific message
     */
    register(messageId: string, url: string): void {
        if (!this.registry.has(messageId)) {
            this.registry.set(messageId, new Set());
        }
        this.registry.get(messageId)!.add(url);
        log.debug(`Registered Blob URL for message ${messageId}`, { url, totalUrls: this.registry.size });
    }

    /**
     * Revoke a specific Blob URL
     */
    revoke(url: string): void {
        try {
            URL.revokeObjectURL(url);
            log.debug(`Revoked Blob URL`, { url });
        } catch (error) {
            log.error('Error revoking Blob URL:', error);
        }
    }

    /**
     * Revoke all Blob URLs for a specific message
     */
    revokeMessage(messageId: string): void {
        const urls = this.registry.get(messageId);
        if (urls) {
            urls.forEach(url => this.revoke(url));
            this.registry.delete(messageId);
            log.debug(`Revoked all Blob URLs for message ${messageId}`, { count: urls.size });
        }
    }

    /**
     * Revoke all Blob URLs in the registry
     */
    revokeAll(): void {
        const totalUrls = Array.from(this.registry.values()).reduce((sum, urls) => sum + urls.size, 0);
        this.registry.forEach((urls) => {
            urls.forEach(url => this.revoke(url));
        });
        this.registry.clear();
        log.debug(`Revoked all Blob URLs`, { totalUrls });
    }

    /**
     * Get total number of registered URLs
     */
    getStats(): { messages: number; urls: number } {
        const urls = Array.from(this.registry.values()).reduce((sum, urls) => sum + urls.size, 0);
        return { messages: this.registry.size, urls };
    }
}

// Global singleton instance
const globalRegistry = new BlobURLRegistry();

/**
 * Hook to manage Blob URL lifecycle for a message
 * Automatically revokes URLs when the message is unmounted
 */
export function useBlobURLRegistry(messageId: string) {
    const registeredUrls = useRef<Set<string>>(new Set());

    // Register a URL for this message
    const registerUrl = (url: string) => {
        registeredUrls.current.add(url);
        globalRegistry.register(messageId, url);
    };

    // Revoke a specific URL
    const revokeUrl = (url: string) => {
        registeredUrls.current.delete(url);
        globalRegistry.revoke(url);
    };

    // Cleanup: revoke all URLs for this message when component unmounts
    useEffect(() => {
        return () => {
            // Revoke all URLs registered by this component
            registeredUrls.current.forEach(url => {
                globalRegistry.revoke(url);
            });
            registeredUrls.current.clear();
        };
    }, [messageId]);

    return { registerUrl, revokeUrl };
}

/**
 * Get registry statistics (for debugging)
 */
export function getBlobURLRegistryStats() {
    return globalRegistry.getStats();
}

/**
 * Revoke all Blob URLs (for cleanup on unmount)
 */
export function revokeAllBlobURLs() {
    globalRegistry.revokeAll();
}
