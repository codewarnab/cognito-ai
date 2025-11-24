/**
 * Get Bookmark Tree Tool
 * Retrieves complete bookmark folder hierarchy
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '@ai/tools';
import { useToolUI } from '@ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '@ai/tools/components';
import type { ToolUIState } from '@ai/tools/components';
import { safeBookmarksGetTree } from '../chromeApi/bookmarks';
import { BrowserAPIError } from '../../errors';

const log = createLogger('Tool-GetBookmarkTree');

interface SimplifiedNode {
    id: string;
    title: string;
    url?: string;
    type: 'folder' | 'bookmark';
    children?: SimplifiedNode[];
    bookmarkCount?: number;
}

interface BookmarkTreeResult {
    success: boolean;
    tree: SimplifiedNode;
    totalFolders: number;
    totalBookmarks: number;
    depth: number;
}

/**
 * Simplify bookmark tree structure for better readability
 * Recursively processes the tree and optionally filters out bookmarks
 */
function simplifyTree(node: chrome.bookmarks.BookmarkTreeNode, includeBookmarks: boolean): SimplifiedNode {
    const isFolder = !node.url;

    const simplified: SimplifiedNode = {
        id: node.id,
        title: node.title || (node.id === '0' ? 'Root' : 'Untitled'),
        type: isFolder ? 'folder' : 'bookmark'
    };

    if (!isFolder) {
        simplified.url = node.url;
    }

    // Process children recursively
    if (node.children && node.children.length > 0) {
        if (includeBookmarks) {
            // Include all children
            simplified.children = node.children.map(child => simplifyTree(child, includeBookmarks));
        } else {
            // Only include folders
            simplified.children = node.children
                .filter(child => !child.url)
                .map(child => simplifyTree(child, includeBookmarks));
        }

        // Calculate bookmark count for folders
        if (isFolder) {
            simplified.bookmarkCount = countBookmarksInNode(node);
        }
    }

    return simplified;
}

/**
 * Count total bookmarks in a node and its children
 */
function countBookmarksInNode(node: chrome.bookmarks.BookmarkTreeNode): number {
    if (!node.children) {
        return node.url ? 1 : 0;
    }

    return node.children.reduce((count, child) => {
        if (child.url) {
            return count + 1;
        }
        return count + countBookmarksInNode(child);
    }, 0);
}

/**
 * Count total folders in simplified tree
 */
function countFolders(node: SimplifiedNode): number {
    let count = node.type === 'folder' ? 1 : 0;

    if (node.children) {
        count += node.children.reduce((sum, child) => sum + countFolders(child), 0);
    }

    return count;
}

/**
 * Count total bookmarks in simplified tree
 */
function countBookmarks(node: SimplifiedNode): number {
    let count = node.type === 'bookmark' ? 1 : 0;

    if (node.children) {
        count += node.children.reduce((sum, child) => sum + countBookmarks(child), 0);
    }

    return count;
}

/**
 * Calculate maximum depth of tree
 */
function calculateDepth(node: SimplifiedNode, currentDepth: number = 0): number {
    if (!node.children || node.children.length === 0) {
        return currentDepth;
    }

    return Math.max(...node.children.map(child => calculateDepth(child, currentDepth + 1)));
}

/**
 * Limit tree depth by pruning nodes beyond maxDepth
 */
function limitTreeDepth(node: SimplifiedNode, maxDepth: number, currentDepth: number): SimplifiedNode {
    if (currentDepth >= maxDepth) {
        // Remove children at max depth
        const limited = { ...node };
        delete limited.children;
        return limited;
    }

    if (!node.children) {
        return node;
    }

    return {
        ...node,
        children: node.children.map(child => limitTreeDepth(child, maxDepth, currentDepth + 1))
    };
}

/**
 * Hook to register the getBookmarkTree tool
 */
export function useGetBookmarkTree() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering getBookmarkTree tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'getBookmarkTree',
            description: `Get complete bookmark folder structure with hierarchical organization. Use when user asks "show my bookmark folders", "what's my bookmark organization", "list folder structure", "how are my bookmarks organized", or "show me all bookmark folders and subfolders". Returns a tree structure showing all folders, subfolders, and optionally individual bookmarks. Each folder includes bookmark count. This tool provides a comprehensive overview of the user's entire bookmark organization system, making it easy to understand the folder hierarchy and locate where bookmarks are stored. Default behavior shows only folders with bookmark counts for performance, but can include individual bookmarks if requested. The tree includes special folders like "Bookmarks bar" (ID: 1) and "Other bookmarks" (ID: 2). Use this when the user needs to understand their bookmark structure before performing other bookmark operations like moving, organizing, or searching within specific folders.`,

            parameters: z.object({
                includeBookmarks: z.boolean().optional().default(false).describe(
                    'Include individual bookmarks in the tree (not just folders). ' +
                    'Default: false (shows only folder structure with bookmark counts). ' +
                    'Set to true when user specifically asks to "show all bookmarks", "list everything", or needs to see individual bookmark details. ' +
                    'Warning: Can produce large output for users with many bookmarks (>100).'
                ),
                maxDepth: z.number().int().min(1).max(10).optional().describe(
                    'Optional: Maximum depth of folders to include (1-10). ' +
                    'Use to limit output for deeply nested folder structures. ' +
                    'If not specified, includes all levels.'
                )
            }),

            execute: async ({ includeBookmarks = false, maxDepth }): Promise<BookmarkTreeResult> => {
                try {
                    log.info('TOOL CALL: getBookmarkTree', { includeBookmarks, maxDepth });

                    // Get complete bookmark tree from Chrome API
                    const tree = await safeBookmarksGetTree();

                    if (!tree || tree.length === 0) {
                        throw new Error('Failed to retrieve bookmark tree');
                    }

                    // Simplify the tree structure
                    const rootNode = tree[0];
                    if (!rootNode) {
                        throw new Error('Bookmark tree root node is undefined');
                    }
                    let simplified = simplifyTree(rootNode, includeBookmarks);

                    // Apply depth limit if specified
                    if (maxDepth !== undefined) {
                        simplified = limitTreeDepth(simplified, maxDepth, 0);
                    }

                    // Calculate statistics
                    const totalFolders = countFolders(simplified);
                    const totalBookmarks = countBookmarks(simplified);
                    const depth = calculateDepth(simplified);

                    log.info('✅ Bookmark tree retrieved', { totalFolders, totalBookmarks, depth });

                    return {
                        success: true,
                        tree: simplified,
                        totalFolders,
                        totalBookmarks,
                        depth
                    };
                } catch (error) {
                    log.error('[Tool] Error getting bookmark tree:', error);

                    if (error instanceof BrowserAPIError) {
                        throw error;
                    }

                    throw new Error(error instanceof Error ? error.message : 'Failed to get bookmark tree');
                }
            },
        });

        // Register the UI renderer
        registerToolUI('getBookmarkTree', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
            renderInput: (input: any) => (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ opacity: 0.7 }}>Include bookmarks:</span>
                        <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                            {input.includeBookmarks ? 'Yes' : 'No (folders only)'}
                        </span>
                    </div>
                    {input.maxDepth && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <span style={{ opacity: 0.7 }}>Max depth:</span>
                            <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                {input.maxDepth} levels
                            </span>
                        </div>
                    )}
                </div>
            ),
            renderOutput: (output: any) => (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {output.success ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ opacity: 0.7 }}>📁 Folders:</span>
                                <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                    {output.totalFolders}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ opacity: 0.7 }}>🔖 Bookmarks:</span>
                                <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                    {output.totalBookmarks}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ opacity: 0.7 }}>📊 Max depth:</span>
                                <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                    {output.depth} levels
                                </span>
                            </div>
                        </div>
                    ) : (
                        <span style={{ color: 'var(--error-color)' }}>Failed to retrieve bookmark tree</span>
                    )}
                </div>
            )
        });

        log.info('✅ getBookmarkTree tool registration complete');

        return () => {
            log.info('🧹 Cleaning up getBookmarkTree tool');
            unregisterToolUI('getBookmarkTree');
        };
    }, []);
}
