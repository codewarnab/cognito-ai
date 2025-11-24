/**
 * Create Bookmark Tool
 * Allows AI to save bookmarks to Chrome
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '@ai/tools';
import { useToolUI } from '@ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '@ai/tools/components';
import type { ToolUIState } from '@ai/tools/components';
import { safeBookmarksCreate } from '../chromeApi/bookmarks';
import { BrowserAPIError } from '../../errors';
import type { BookmarkCreateResult } from '../../types/bookmarks';

const log = createLogger('Tool-CreateBookmark');

/**
 * Hook to register the createBookmark tool
 */
export function useCreateBookmark() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering createBookmark tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'createBookmark',
            description: `Save a bookmark to Chrome bookmarks. Use when user wants to "bookmark this", "save page", "add to bookmarks". Can specify folder (default: "Other bookmarks"). Returns bookmark ID and location. REQUIRES CONSENT: Ask "Want me to bookmark this?" first. Cannot bookmark chrome:// pages.`,

            parameters: z.object({
                url: z.string().describe('Full URL to bookmark (must include https:// or http://)'),
                title: z.string().describe('Bookmark title. If not provided, uses page title'),
                folderId: z.string().optional().describe('Optional: Parent folder ID. Omit to save in "Other bookmarks" (ID: "2"). Special IDs: "1" = bookmarks bar')
            }),

            execute: async ({ url, title, folderId }): Promise<BookmarkCreateResult> => {
                try {
                    log.info('TOOL CALL: createBookmark', { url, title, folderId });

                    // Validate URL
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        throw new Error('URL must start with http:// or https://');
                    }

                    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
                        throw new Error('Cannot bookmark chrome:// or chrome-extension:// pages');
                    }

                    const bookmark = await safeBookmarksCreate({
                        url,
                        title,
                        parentId: folderId || '2' // Default to "Other bookmarks"
                    });

                    log.info('✅ Bookmark created', { id: bookmark.id, title: bookmark.title });

                    return {
                        success: true,
                        id: bookmark.id,
                        title: bookmark.title,
                        url: bookmark.url,
                        folder: bookmark.parentId
                    };
                } catch (error) {
                    log.error('[Tool] Error creating bookmark:', error);

                    if (error instanceof BrowserAPIError) {
                        throw error;
                    }

                    throw new Error(error instanceof Error ? error.message : 'Failed to create bookmark');
                }
            },
        });

        // Register the UI renderer
        registerToolUI('createBookmark', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
            renderInput: (input: any) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ opacity: 0.7 }}>Title:</span>
                        <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                            {input.title}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ opacity: 0.7 }}>URL:</span>
                        <a href={input.url} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'var(--text-primary)', textDecoration: 'none', opacity: 0.9, fontSize: '11px' }}>
                            {input.url}
                        </a>
                    </div>
                </div>
            ),
            renderOutput: (output: any) => (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {output.success ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ opacity: 0.7 }}>Saved:</span>
                            <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                {output.title}
                            </span>
                        </div>
                    ) : (
                        <span style={{ color: 'var(--error-color)' }}>Failed to create bookmark</span>
                    )}
                </div>
            )
        });

        log.info('✅ createBookmark tool registration complete');

        return () => {
            log.info('🧹 Cleaning up createBookmark tool');
            unregisterToolUI('createBookmark');
        };
    }, []);
}
