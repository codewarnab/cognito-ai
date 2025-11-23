import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '../../ai/tools/components';
import type { ToolUIState } from '../../ai/tools/components';
import { BrowserAPIError } from '../../errors';
import {
  safeBookmarksCreate,
  safeBookmarksSearch,
  safeBookmarksGet,
  safeBookmarksGetTree,
  safeBookmarksGetChildren,
  safeBookmarksRemove,
  safeBookmarksUpdate
} from '../chromeApi/bookmarks';
import type {
  BookmarkCreateResult,
  BookmarkSearchResults,
  BookmarkListResult,
  BookmarkDeleteResult,
  BookmarkUpdateResult
} from '../../types/bookmarks';

const log = createLogger('Tool-BookmarksUnified');

function errorWithHints(message: string, hints: string[]) {
  return { success: false, error: `${message}\nHints:\n${hints.map(h => `- ${h}`).join('\n')}` };
}

async function getBookmarkPath(bookmarkId: string): Promise<string> {
  try {
    const bookmarks = await safeBookmarksGet(bookmarkId);
    if (bookmarks.length === 0) return 'Unknown';
    const bookmark = bookmarks[0];
    if (!bookmark) return 'Unknown';
    if (!bookmark.parentId) return 'Root';
    const parts: string[] = [];
    let currentId: string | undefined = bookmark.parentId;
    while (currentId && currentId !== '0') {
      const parents = await safeBookmarksGet(currentId);
      if (parents.length === 0) break;
      const parent = parents[0];
      if (!parent) break;
      parts.unshift(parent.title || 'Unnamed');
      currentId = parent.parentId;
    }
    return parts.join(' > ') || 'Other bookmarks';
  } catch {
    return 'Unknown';
  }
}

type SimplifiedNode = {
  id: string;
  title: string;
  url?: string;
  type: 'folder' | 'bookmark';
  children?: SimplifiedNode[];
  bookmarkCount?: number;
};

function simplifyTree(node: chrome.bookmarks.BookmarkTreeNode, includeBookmarks: boolean): SimplifiedNode {
  const isFolder = !node.url;
  const simplified: SimplifiedNode = {
    id: node.id,
    title: node.title || (node.id === '0' ? 'Root' : 'Untitled'),
    type: isFolder ? 'folder' : 'bookmark'
  };
  if (!isFolder) simplified.url = node.url;
  if (node.children && node.children.length > 0) {
    if (includeBookmarks) {
      simplified.children = node.children.map(child => simplifyTree(child, includeBookmarks));
    } else {
      simplified.children = node.children.filter(child => !child.url).map(child => simplifyTree(child, includeBookmarks));
    }
    if (isFolder) {
      simplified.bookmarkCount = countBookmarksInNode(node);
    }
  }
  return simplified;
}

function countBookmarksInNode(node: chrome.bookmarks.BookmarkTreeNode): number {
  if (!node.children) return node.url ? 1 : 0;
  return node.children.reduce((count, child) => count + (child.url ? 1 : countBookmarksInNode(child)), 0);
}

function countFolders(node: SimplifiedNode): number {
  let count = node.type === 'folder' ? 1 : 0;
  if (node.children) count += node.children.reduce((sum, child) => sum + countFolders(child), 0);
  return count;
}

function countBookmarks(node: SimplifiedNode): number {
  let count = node.type === 'bookmark' ? 1 : 0;
  if (node.children) count += node.children.reduce((sum, child) => sum + countBookmarks(child), 0);
  return count;
}

function calculateDepth(node: SimplifiedNode, current: number = 0): number {
  if (!node.children || node.children.length === 0) return current;
  return Math.max(...node.children.map(child => calculateDepth(child, current + 1)));
}

function limitTreeDepth(node: SimplifiedNode, maxDepth: number, current: number): SimplifiedNode {
  if (current >= maxDepth) {
    const limited = { ...node };
    delete (limited as any).children;
    return limited;
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map(child => limitTreeDepth(child, maxDepth, current + 1)) };
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

type BookmarkInfo = {
  id: string;
  title: string;
  url: string;
  parentId?: string;
  domain: string;
  path: string;
};

async function getAllBookmarks(): Promise<BookmarkInfo[]> {
  const tree = await safeBookmarksGetTree();
  const bookmarks: BookmarkInfo[] = [];
  function traverse(node: chrome.bookmarks.BookmarkTreeNode, path: string = '') {
    const currentPath = path ? `${path} > ${node.title}` : node.title;
    if (node.url) {
      bookmarks.push({ id: node.id, title: node.title, url: node.url, parentId: node.parentId, domain: extractDomain(node.url), path: currentPath });
    }
    if (node.children) node.children.forEach(child => traverse(child, currentPath));
  }
  tree.forEach(n => traverse(n));
  return bookmarks;
}

function analyzeBookmarkPatterns(bookmarks: BookmarkInfo[]) {
  const newFolders: { name: string; reason: string; bookmarkCount: number; domains: string[] }[] = [];
  const moves: { bookmarkId: string; bookmarkTitle: string; currentFolder: string; suggestedFolder: string; reason: string }[] = [];
  const duplicates: { url: string; title: string; bookmarkIds: string[]; count: number }[] = [];
  const domainGroups = new Map<string, BookmarkInfo[]>();
  bookmarks.forEach(b => { if (!domainGroups.has(b.domain)) domainGroups.set(b.domain, []); const g = domainGroups.get(b.domain); if (g) g.push(b); });
  domainGroups.forEach((items, domain) => {
    if (items.length >= 3 && domain !== 'unknown') {
      const parentFolders = new Set(items.map(b => b.parentId));
      if (parentFolders.size > 1) {
        const domainPart = domain.split('.')[0] || 'Bookmarks';
        newFolders.push({ name: domainPart.charAt(0).toUpperCase() + domainPart.slice(1), reason: `${items.length} bookmarks from ${domain} are scattered across ${parentFolders.size} folders`, bookmarkCount: items.length, domains: [domain] });
        items.forEach(b => {
          const folderName = domain.split('.')[0] || 'Uncategorized';
          moves.push({ bookmarkId: b.id, bookmarkTitle: b.title, currentFolder: b.path, suggestedFolder: folderName, reason: `Group ${domain} bookmarks together` });
        });
      }
    }
  });
  const keywords = ['tutorial', 'documentation', 'docs', 'guide', 'blog', 'article', 'video', 'tool', 'resource'];
  const keywordGroups = new Map<string, BookmarkInfo[]>();
  bookmarks.forEach(b => { const lt = b.title.toLowerCase(); keywords.forEach(k => { if (lt.includes(k)) { if (!keywordGroups.has(k)) keywordGroups.set(k, []); const g = keywordGroups.get(k); if (g) g.push(b); } }); });
  keywordGroups.forEach((items, k) => {
    if (items.length >= 4) {
      const domains = [...new Set(items.map(b => b.domain))];
      const parentFolders = new Set(items.map(b => b.parentId));
      if (parentFolders.size > 2) {
        newFolders.push({ name: k.charAt(0).toUpperCase() + k.slice(1) + 's', reason: `${items.length} ${k}-related bookmarks from ${domains.length} different sites`, bookmarkCount: items.length, domains: domains.slice(0, 5) });
      }
    }
  });
  const urlMap = new Map<string, BookmarkInfo[]>();
  bookmarks.forEach(b => { if (!urlMap.has(b.url)) urlMap.set(b.url, []); const g = urlMap.get(b.url); if (g) g.push(b); });
  urlMap.forEach((items, url) => { if (items.length > 1 && items[0]) { duplicates.push({ url, title: items[0].title, bookmarkIds: items.map(x => x.id), count: items.length }); } });
  return { newFolders, moves, duplicates };
}

function calculateAnalysis(bookmarks: BookmarkInfo[]) {
  const domains = new Set(bookmarks.map(b => b.domain));
  const folders = new Map<string, number>();
  let uncategorized = 0;
  bookmarks.forEach(b => { const folder = b.parentId || 'uncategorized'; folders.set(folder, (folders.get(folder) || 0) + 1); if (folder === '2') uncategorized++; });
  return { totalBookmarks: bookmarks.length, uniqueDomains: domains.size, averageBookmarksPerFolder: folders.size > 0 ? Math.round(bookmarks.length / folders.size) : 0, uncategorized };
}

const paramsSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), url: z.string().describe('Full URL to bookmark (http:// or https://)'), title: z.string().optional().describe('Bookmark title'), folderId: z.string().optional().describe('Parent folder ID, default "2"') }),
  z.object({ action: z.literal('search'), query: z.string().describe('Search query for title/URL'), limit: z.number().optional().default(10).describe('Max results 1-50') }),
  z.object({ action: z.literal('list'), folderId: z.string().optional().describe('Folder ID to list, default "2"'), includeSubfolders: z.boolean().optional().default(false).describe('Include subfolders') }),
  z.object({ action: z.literal('delete'), bookmarkId: z.string().describe('Bookmark ID to delete') }),
  z.object({ action: z.literal('update'), bookmarkId: z.string().describe('Bookmark ID to update'), title: z.string().optional().describe('New title'), url: z.string().optional().describe('New URL starting with http(s)') }),
  z.object({ action: z.literal('tree'), includeBookmarks: z.boolean().optional().default(false).describe('Include individual bookmarks'), maxDepth: z.number().optional().describe('Max folder depth 1-10') }),
  z.object({ action: z.literal('organize'), folderId: z.string().optional().describe('Folder ID to analyze'), autoCreate: z.boolean().optional().default(false).describe('Auto-create suggested folders'), minGroupSize: z.number().optional().default(3).describe('Minimum size for new folder suggestions') })
]);

export function useBookmarksTool() {
  const { registerToolUI, unregisterToolUI } = useToolUI();
  useEffect(() => {
    log.info('🔧 Registering bookmarksTool...');
    registerTool({
      name: 'bookmarksTool',
      description: 'Unified bookmarks tool: create, search, list, delete, update, get tree, organize. Use action parameter to select operation.',
      parameters: paramsSchema,
      execute: async (args: any) => {
        try {
          const parsed = paramsSchema.parse(args);
          if (parsed.action === 'create') {
            const { url, title, folderId } = parsed;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
              return errorWithHints('Invalid URL', ['Use http:// or https://', 'Example: https://example.com']);
            }
            if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
              return errorWithHints('Cannot bookmark chrome:// or extension pages', ['Provide a normal web URL', 'Example: https://docs.github.com']);
            }
            const bookmark = await safeBookmarksCreate({ url, title, parentId: folderId || '2' });
            const result: BookmarkCreateResult = { success: true, id: bookmark.id, title: bookmark.title, url: bookmark.url, folder: bookmark.parentId };
            return result;
          }
          if (parsed.action === 'search') {
            const { query, limit = 10 } = parsed;
            if (!query || query.trim().length < 2) {
              return errorWithHints('Query too short', ['Provide at least 2 characters', 'Examples: react, github, example.com']);
            }
            const actualLimit = Math.min(Math.max(1, limit), 50);
            const results = await safeBookmarksSearch(query);
            const limited = results.slice(0, actualLimit);
            const enriched = await Promise.all(limited.map(async b => ({ id: b.id, title: b.title, url: b.url, path: await getBookmarkPath(b.id), dateAdded: b.dateAdded })));
            const out: BookmarkSearchResults = { success: true, count: enriched.length, total: results.length, bookmarks: enriched };
            return out;
          }
          if (parsed.action === 'list') {
            const { folderId = '2', includeSubfolders = false } = parsed;
            const children = await safeBookmarksGetChildren(folderId);
            const items = children.map(item => ({ id: item.id, title: item.title || 'Untitled', url: item.url, type: (item.url ? 'bookmark' : 'folder') as 'bookmark' | 'folder', dateAdded: item.dateAdded, childCount: item.children?.length || 0 }));
            const out: BookmarkListResult = { success: true, folderId, count: items.length, items };
            if (includeSubfolders) {
              return errorWithHints('Recursive listing not implemented', ['Set includeSubfolders=false', 'Use getBookmarkTree for hierarchy']);
            }
            return out;
          }
          if (parsed.action === 'delete') {
            const { bookmarkId } = parsed;
            const bookmarks = await safeBookmarksGet(bookmarkId);
            if (bookmarks.length === 0) return errorWithHints(`Bookmark not found: ${bookmarkId}`, ['Verify ID via search/list', 'IDs are strings like "123"']);
            const bookmark = bookmarks[0];
            if (!bookmark) return errorWithHints(`Bookmark not found: ${bookmarkId}`, ['Verify ID via search/list']);
            if (!bookmark.url) return errorWithHints('Cannot delete folders', ['Delete individual bookmarks only', 'Use list with folderId to inspect contents']);
            if (['0', '1', '2'].includes(bookmarkId)) return errorWithHints('Cannot delete special folders', ['IDs 0,1,2 are protected']);
            await safeBookmarksRemove(bookmarkId);
            const out: BookmarkDeleteResult = { success: true, deletedId: bookmarkId, message: 'Bookmark deleted successfully' };
            return out;
          }
          if (parsed.action === 'update') {
            const { bookmarkId, title, url } = parsed;
            if (!title && !url) return errorWithHints('Provide title or url', ['Set at least one field', 'Example: {action:"update", bookmarkId:"123", title:"New"}']);
            if (url) {
              if (!url.startsWith('http://') && !url.startsWith('https://')) return errorWithHints('Invalid URL', ['Use http:// or https://']);
              if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return errorWithHints('URL cannot be chrome:// or extension', ['Provide a normal web URL']);
            }
            const changes: chrome.bookmarks.BookmarkChangesArg = {};
            if (title) changes.title = title;
            if (url) changes.url = url;
            const updated = await safeBookmarksUpdate(bookmarkId, changes);
            const out: BookmarkUpdateResult = { success: true, id: updated.id, title: updated.title, url: updated.url };
            return out;
          }
          if (parsed.action === 'tree') {
            const { includeBookmarks = false, maxDepth } = parsed;
            const tree = await safeBookmarksGetTree();
            if (!tree || tree.length === 0) return errorWithHints('Failed to retrieve bookmark tree', ['Ensure bookmarks permission is granted']);
            const rootNode = tree[0];
            if (!rootNode) return errorWithHints('Bookmark tree root missing', ['Try again']);
            let simplified = simplifyTree(rootNode, includeBookmarks);
            if (maxDepth !== undefined) {
              if (typeof maxDepth !== 'number' || maxDepth < 1 || maxDepth > 10) return errorWithHints('Invalid maxDepth', ['Use a number between 1 and 10']);
              simplified = limitTreeDepth(simplified, maxDepth, 0);
            }
            const totalFolders = countFolders(simplified);
            const totalBookmarks = countBookmarks(simplified);
            const depth = calculateDepth(simplified);
            return { success: true, tree: simplified, totalFolders, totalBookmarks, depth };
          }
          if (parsed.action === 'organize') {
            const { folderId, autoCreate = false, minGroupSize = 3 } = parsed;
            if (minGroupSize < 2 || minGroupSize > 10) return errorWithHints('Invalid minGroupSize', ['Use between 2 and 10']);
            let bookmarks: BookmarkInfo[];
            if (folderId) {
              const children = await safeBookmarksGetChildren(folderId);
              bookmarks = children.filter(n => n.url).map(n => ({ id: n.id, title: n.title, url: n.url!, parentId: n.parentId, domain: extractDomain(n.url!), path: n.title }));
            } else {
              bookmarks = await getAllBookmarks();
            }
            if (bookmarks.length === 0) {
              return { success: true, suggestions: { newFolders: [], moves: [], duplicates: [] }, analysis: { totalBookmarks: 0, uniqueDomains: 0, averageBookmarksPerFolder: 0, uncategorized: 0 } };
            }
            const suggestions = analyzeBookmarkPatterns(bookmarks);
            suggestions.newFolders = suggestions.newFolders.filter(f => f.bookmarkCount >= minGroupSize);
            const analysis = calculateAnalysis(bookmarks);
            const autoCreatedFolders: string[] = [];
            if (autoCreate && suggestions.newFolders.length > 0) {
              for (const s of suggestions.newFolders) {
                try {
                  const created = await safeBookmarksCreate({ title: s.name, parentId: folderId || '2' });
                  autoCreatedFolders.push(created.id);
                } catch {}
              }
            }
            return { success: true, suggestions, analysis, autoCreatedFolders: autoCreate ? autoCreatedFolders : undefined };
          }
          return errorWithHints('Unknown action', ['Valid actions: create, search, list, delete, update, tree, organize']);
        } catch (error) {
          if (error instanceof BrowserAPIError) throw error;
          return errorWithHints(error instanceof Error ? error.message : 'Failed to run bookmarksTool', ['Check parameters for selected action']);
        }
      }
    });
    registerToolUI('bookmarksTool', (state: ToolUIState) => {
      return <CompactToolRenderer state={state} />;
    });
    log.info('✅ bookmarksTool registration complete');
    return () => {
      log.info('🧹 Cleaning up bookmarksTool');
      unregisterToolUI('bookmarksTool');
    };
  }, []);
}