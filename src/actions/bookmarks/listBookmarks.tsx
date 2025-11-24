/**
 * List Bookmarks Tool
 * Allows AI to list bookmarks from a specific folder
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '@ai/tools';
import { useToolUI } from '@ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '@ai/tools/components';
import type { ToolUIState } from '@ai/tools/components';
import { safeBookmarksGetChildren } from '../chromeApi/bookmarks';
import { BrowserAPIError } from '../../errors';
import type { BookmarkListResult } from '../../types/bookmarks';

const log = createLogger('Tool-ListBookmarks');

/**
 * Hook to register the listBookmarks tool
 */
export function useListBookmarks() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering listBookmarks tool...');

        registerTool({
            name: 'listBookmarks',
            description: `List bookmarks from a specific folder. Use when user asks "show bookmarks in [folder]", "what's in my bookmarks bar", "list my saved sites". Returns bookmarks and subfolders. Default: lists "Other bookmarks".`,

            parameters: z.object({
                folderId: z.string().optional().describe('Folder ID to list. Omit for "Other bookmarks". Special IDs: "0"=root, "1"=bookmarks bar, "2"=other bookmarks'),
                includeSubfolders: z.boolean().optional().default(false).describe('Include subfolders recursively (not yet implemented)')
            }),

            execute: async ({ folderId = '2', includeSubfolders = false }): Promise<BookmarkListResult> => {
                try {
                    log.info('TOOL CALL: listBookmarks', { folderId, includeSubfolders });

                    const children = await safeBookmarksGetChildren(folderId);

                    const items = children.map(item => ({
                        id: item.id,
                        title: item.title || 'Untitled',
                        url: item.url,
                        type: (item.url ? 'bookmark' : 'folder') as 'bookmark' | 'folder',
                        dateAdded: item.dateAdded,
                        childCount: item.children?.length || 0
                    }));

                    log.info('✅ Listed bookmarks', { folderId, count: items.length });

                    return {
                        success: true,
                        folderId,
                        count: items.length,
                        items
                    };
                } catch (error) {
                    log.error('[Tool] Error listing bookmarks:', error);

                    if (error instanceof BrowserAPIError) {
                        throw error;
                    }

                    throw new Error(error instanceof Error ? error.message : 'Failed to list bookmarks');
                }
            },
        });

        // Register the UI renderer
        registerToolUI('listBookmarks', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
            renderInput: (input: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span style={{ opacity: 0.7 }}>Folder ID:</span>
                    <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                        {input.folderId || '2'}
                    </span>
                </div>
            ),
            renderOutput: (output: any) => (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {output.success ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ opacity: 0.7 }}>
                                Found {output.count} item{output.count !== 1 ? 's' : ''}
                            </div>
                            {output.items && output.items.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                                    {output.items.map((item: any) => (
                                        <div key={item.id} style={{
                                            padding: '6px 8px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: '3px',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '11px'
                                        }}>
                                            <div style={{ color: 'var(--text-primary)', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {item.type === 'folder' ? '📁' : '🔖'}
                                                <span>{item.title}</span>
                                                {item.type === 'folder' && item.childCount > 0 && (
                                                    <span style={{ fontSize: '10px', opacity: 0.6 }}>
                                                        ({item.childCount})
                                                    </span>
                                                )}
                                            </div>
                                            {item.url && (
                                                <a href={item.url} target="_blank" rel="noopener noreferrer"
                                                    style={{ fontSize: '10px', opacity: 0.6, textDecoration: 'none', display: 'block', marginTop: '2px' }}>
                                                    {item.url}
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <span style={{ color: 'var(--error-color)' }}>Failed to list bookmarks</span>
                    )}
                </div>
            )
        });

        log.info('✅ listBookmarks tool registration complete');

        return () => {
            log.info('🧹 Cleaning up listBookmarks tool');
            unregisterToolUI('listBookmarks');
        };
    }, []);
}
