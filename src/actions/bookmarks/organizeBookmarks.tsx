/**
 * Organize Bookmarks Tool
 * AI-powered bookmark organization with pattern analysis and suggestions
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '@/ai/tools';
import { useToolUI } from '@/ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '@/ai/tools/components';
import type { ToolUIState } from '@/ai/tools/components';
import { safeBookmarksGetTree, safeBookmarksGetChildren, safeBookmarksCreate } from '../chromeApi/bookmarks';
import { BrowserAPIError } from '../../errors';

const log = createLogger('Tool-OrganizeBookmarks');

interface BookmarkInfo {
    id: string;
    title: string;
    url: string;
    parentId?: string;
    domain: string;
    path: string;
}

interface FolderSuggestion {
    name: string;
    reason: string;
    bookmarkCount: number;
    domains: string[];
}

interface MoveSuggestion {
    bookmarkId: string;
    bookmarkTitle: string;
    currentFolder: string;
    suggestedFolder: string;
    reason: string;
}

interface DuplicateInfo {
    url: string;
    title: string;
    bookmarkIds: string[];
    count: number;
}

interface OrganizationResult {
    success: boolean;
    suggestions: {
        newFolders: FolderSuggestion[];
        moves: MoveSuggestion[];
        duplicates: DuplicateInfo[];
    };
    analysis: {
        totalBookmarks: number;
        uniqueDomains: number;
        averageBookmarksPerFolder: number;
        uncategorized: number;
    };
    autoCreatedFolders?: string[];
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, '');
    } catch {
        return 'unknown';
    }
}

/**
 * Get all bookmarks recursively with metadata
 */
async function getAllBookmarks(): Promise<BookmarkInfo[]> {
    const tree = await safeBookmarksGetTree();
    const bookmarks: BookmarkInfo[] = [];

    function traverse(node: chrome.bookmarks.BookmarkTreeNode, path: string = '') {
        const currentPath = path ? `${path} > ${node.title}` : node.title;

        if (node.url) {
            bookmarks.push({
                id: node.id,
                title: node.title,
                url: node.url,
                parentId: node.parentId,
                domain: extractDomain(node.url),
                path: currentPath
            });
        }

        if (node.children) {
            node.children.forEach(child => traverse(child, currentPath));
        }
    }

    tree.forEach(node => traverse(node));
    return bookmarks;
}

/**
 * Analyze bookmark patterns and suggest organization
 */
function analyzeBookmarkPatterns(bookmarks: BookmarkInfo[]): {
    newFolders: FolderSuggestion[];
    moves: MoveSuggestion[];
    duplicates: DuplicateInfo[];
} {
    const newFolders: FolderSuggestion[] = [];
    const moves: MoveSuggestion[] = [];
    const duplicates: DuplicateInfo[] = [];

    // 1. Group by domain
    const domainGroups = new Map<string, BookmarkInfo[]>();
    bookmarks.forEach(bookmark => {
        const domain = bookmark.domain;
        if (!domainGroups.has(domain)) {
            domainGroups.set(domain, []);
        }
        const group = domainGroups.get(domain);
        if (group) {
            group.push(bookmark);
        }
    });

    // 2. Suggest folders for domains with multiple bookmarks
    domainGroups.forEach((items, domain) => {
        if (items.length >= 3 && domain !== 'unknown') {
            // Check if they're already in the same folder
            const parentFolders = new Set(items.map(b => b.parentId));
            if (parentFolders.size > 1) {
                const domainPart = domain.split('.')[0] || 'Bookmarks';
                newFolders.push({
                    name: domainPart.charAt(0).toUpperCase() + domainPart.slice(1),
                    reason: `${items.length} bookmarks from ${domain} are scattered across ${parentFolders.size} folders`,
                    bookmarkCount: items.length,
                    domains: [domain]
                });

                // Suggest moves
                items.forEach(bookmark => {
                    const folderName = domain.split('.')[0] || 'Uncategorized';
                    moves.push({
                        bookmarkId: bookmark.id,
                        bookmarkTitle: bookmark.title,
                        currentFolder: bookmark.path,
                        suggestedFolder: folderName,
                        reason: `Group ${domain} bookmarks together`
                    });
                });
            }
        }
    });

    // 3. Detect keyword patterns in titles
    const keywords = ['tutorial', 'documentation', 'docs', 'guide', 'blog', 'article', 'video', 'tool', 'resource'];
    const keywordGroups = new Map<string, BookmarkInfo[]>();

    bookmarks.forEach(bookmark => {
        const lowerTitle = bookmark.title.toLowerCase();
        keywords.forEach(keyword => {
            if (lowerTitle.includes(keyword)) {
                if (!keywordGroups.has(keyword)) {
                    keywordGroups.set(keyword, []);
                }
                const group = keywordGroups.get(keyword);
                if (group) {
                    group.push(bookmark);
                }
            }
        });
    });

    keywordGroups.forEach((items, keyword) => {
        if (items.length >= 4) {
            const domains = [...new Set(items.map(b => b.domain))];
            const parentFolders = new Set(items.map(b => b.parentId));

            if (parentFolders.size > 2) {
                newFolders.push({
                    name: keyword.charAt(0).toUpperCase() + keyword.slice(1) + 's',
                    reason: `${items.length} ${keyword}-related bookmarks from ${domains.length} different sites`,
                    bookmarkCount: items.length,
                    domains: domains.slice(0, 5) // Limit to first 5
                });
            }
        }
    });

    // 4. Find exact duplicates (same URL)
    const urlMap = new Map<string, BookmarkInfo[]>();
    bookmarks.forEach(bookmark => {
        if (!urlMap.has(bookmark.url)) {
            urlMap.set(bookmark.url, []);
        }
        const group = urlMap.get(bookmark.url);
        if (group) {
            group.push(bookmark);
        }
    });

    urlMap.forEach((items, url) => {
        if (items.length > 1 && items[0]) {
            duplicates.push({
                url,
                title: items[0].title,
                bookmarkIds: items.map(b => b.id),
                count: items.length
            });
        }
    });

    return { newFolders, moves, duplicates };
}

/**
 * Calculate analysis statistics
 */
function calculateAnalysis(bookmarks: BookmarkInfo[]): {
    totalBookmarks: number;
    uniqueDomains: number;
    averageBookmarksPerFolder: number;
    uncategorized: number;
} {
    const domains = new Set(bookmarks.map(b => b.domain));
    const folders = new Map<string, number>();
    let uncategorized = 0;

    bookmarks.forEach(bookmark => {
        const folder = bookmark.parentId || 'uncategorized';
        folders.set(folder, (folders.get(folder) || 0) + 1);

        // Count bookmarks in "Other bookmarks" as uncategorized
        if (folder === '2') {
            uncategorized++;
        }
    });

    return {
        totalBookmarks: bookmarks.length,
        uniqueDomains: domains.size,
        averageBookmarksPerFolder: folders.size > 0 ? Math.round(bookmarks.length / folders.size) : 0,
        uncategorized
    };
}

/**
 * Hook to register the organizeBookmarks tool
 */
export function useOrganizeBookmarks() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering organizeBookmarks tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'organizeBookmarks',
            description: `Analyze bookmarks and provide intelligent organization suggestions using pattern detection and AI analysis. Use when user asks "organize my bookmarks", "clean up bookmarks", "suggest bookmark folders", "how should I organize my bookmarks", "find duplicate bookmarks", or "help me structure my bookmarks better". This tool performs comprehensive analysis including: (1) Domain-based grouping - identifies bookmarks from the same website that should be grouped together, (2) Keyword pattern detection - finds bookmarks with similar titles/topics (tutorials, documentation, blogs, tools, etc.) that could be organized into category folders, (3) Duplicate detection - finds exact duplicate URLs saved multiple times, (4) Folder distribution analysis - shows how bookmarks are currently distributed and suggests improvements. Returns actionable suggestions for creating new folders, moving bookmarks to better locations, and removing duplicates. Does NOT automatically make changes unless 'autoCreate' is true - requires user consent. Each suggestion includes reasoning and affected bookmark counts. Use this when user wants to improve their bookmark organization but isn't sure how. The tool analyzes the entire bookmark collection (or specific folder) and provides a comprehensive organization plan. Particularly useful for users with 50+ bookmarks who have lost track of their structure.`,

            parameters: z.object({
                folderId: z.string().optional().describe(
                    'Optional: Specific folder ID to analyze. ' +
                    'If not provided, analyzes all bookmarks across entire bookmark tree. ' +
                    'Use specific folder ID to focus analysis on a subset (e.g., "2" for "Other bookmarks"). ' +
                    'Get folder IDs from listBookmarks or getBookmarkTree tools.'
                ),
                autoCreate: z.boolean().optional().default(false).describe(
                    'If true, automatically create suggested folders (requires user consent). ' +
                    'Default: false (only provides suggestions without making changes). ' +
                    'IMPORTANT: Only set to true if user explicitly agrees to auto-create folders. ' +
                    'Ask "Should I automatically create these folders?" before enabling.'
                ),
                minGroupSize: z.number().optional().default(3).describe(
                    'Minimum number of bookmarks required to suggest a new folder (2-10). ' +
                    'Default: 3. Lower values create more granular folders, higher values only suggest folders for larger groups. ' +
                    'Use lower values (2-3) for small bookmark collections, higher values (5+) for large collections.'
                )
            }),

            execute: async ({ folderId, autoCreate = false, minGroupSize = 3 }): Promise<OrganizationResult> => {
                try {
                    log.info('TOOL CALL: organizeBookmarks', { folderId, autoCreate, minGroupSize });

                    // Get bookmarks to analyze
                    let bookmarks: BookmarkInfo[];

                    if (folderId) {
                        // Get bookmarks from specific folder
                        const children = await safeBookmarksGetChildren(folderId);
                        bookmarks = children
                            .filter(node => node.url)
                            .map(node => ({
                                id: node.id,
                                title: node.title,
                                url: node.url!,
                                parentId: node.parentId,
                                domain: extractDomain(node.url!),
                                path: node.title
                            }));
                    } else {
                        // Get all bookmarks
                        bookmarks = await getAllBookmarks();
                    }

                    if (bookmarks.length === 0) {
                        return {
                            success: true,
                            suggestions: {
                                newFolders: [],
                                moves: [],
                                duplicates: []
                            },
                            analysis: {
                                totalBookmarks: 0,
                                uniqueDomains: 0,
                                averageBookmarksPerFolder: 0,
                                uncategorized: 0
                            }
                        };
                    }

                    // Analyze patterns
                    const suggestions = analyzeBookmarkPatterns(bookmarks);

                    // Filter by minGroupSize
                    suggestions.newFolders = suggestions.newFolders.filter(f => f.bookmarkCount >= minGroupSize);

                    // Calculate analysis statistics
                    const analysis = calculateAnalysis(bookmarks);

                    // Optionally auto-create folders
                    const autoCreatedFolders: string[] = [];
                    if (autoCreate && suggestions.newFolders.length > 0) {
                        log.info('Auto-creating suggested folders', { count: suggestions.newFolders.length });

                        for (const suggestion of suggestions.newFolders) {
                            try {
                                const created = await safeBookmarksCreate({
                                    title: suggestion.name,
                                    parentId: folderId || '2' // Default to "Other bookmarks"
                                });
                                autoCreatedFolders.push(created.id);
                                log.info('Created folder', { id: created.id, name: suggestion.name });
                            } catch (error) {
                                log.error('Failed to create folder', { name: suggestion.name, error });
                            }
                        }
                    }

                    log.info('✅ Bookmark organization analysis complete', {
                        newFolders: suggestions.newFolders.length,
                        moves: suggestions.moves.length,
                        duplicates: suggestions.duplicates.length,
                        autoCreated: autoCreatedFolders.length
                    });

                    return {
                        success: true,
                        suggestions,
                        analysis,
                        autoCreatedFolders: autoCreate ? autoCreatedFolders : undefined
                    };
                } catch (error) {
                    log.error('[Tool] Error organizing bookmarks:', error);

                    if (error instanceof BrowserAPIError) {
                        throw error;
                    }

                    throw new Error(error instanceof Error ? error.message : 'Failed to organize bookmarks');
                }
            },
        });

        // Register the UI renderer
        registerToolUI('organizeBookmarks', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
            renderInput: (input: any) => (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ opacity: 0.7 }}>Scope:</span>
                        <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                            {input.folderId ? `Folder ${input.folderId}` : 'All bookmarks'}
                        </span>
                    </div>
                    {input.autoCreate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: 'var(--warning-color)' }}>
                            <span>⚠️ Auto-create enabled</span>
                        </div>
                    )}
                </div>
            ),
            renderOutput: (output: any) => (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {output.success ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ opacity: 0.7 }}>📊 Analyzed:</span>
                                <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                    {output.analysis.totalBookmarks} bookmarks
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ opacity: 0.7 }}>📁 Folder suggestions:</span>
                                <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                    {output.suggestions.newFolders.length}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ opacity: 0.7 }}>🔄 Move suggestions:</span>
                                <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                    {output.suggestions.moves.length}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ opacity: 0.7 }}>🔍 Duplicates found:</span>
                                <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                    {output.suggestions.duplicates.length}
                                </span>
                            </div>
                            {output.autoCreatedFolders && output.autoCreatedFolders.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: 'var(--success-color)' }}>
                                    <span>✅ Created {output.autoCreatedFolders.length} folders</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <span style={{ color: 'var(--error-color)' }}>Failed to analyze bookmarks</span>
                    )}
                </div>
            )
        });

        log.info('✅ organizeBookmarks tool registration complete');

        return () => {
            log.info('🧹 Cleaning up organizeBookmarks tool');
            unregisterToolUI('organizeBookmarks');
        };
    }, []);
}
