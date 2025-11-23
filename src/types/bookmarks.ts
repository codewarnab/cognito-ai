/**
 * Type definitions for bookmark operations
 */

export interface BookmarkNode {
    id: string;
    title: string;
    url?: string;
    dateAdded?: number;
    dateGroupModified?: number;
    parentId?: string;
    children?: BookmarkNode[];
    index?: number;
}

export interface BookmarkSearchResult {
    id: string;
    title: string;
    url: string;
    parentPath: string;
    dateAdded: number;
}

export interface BookmarkFolder {
    id: string;
    title: string;
    path: string;
    children: BookmarkNode[];
}

export interface BookmarkOrganizationSuggestion {
    bookmarkId: string;
    currentFolder: string;
    suggestedFolder: string;
    reason: string;
}

export interface BookmarkCreateResult {
    success: boolean;
    id: string;
    title: string;
    url?: string;
    folder?: string;
}

export interface BookmarkSearchResults {
    success: boolean;
    count: number;
    total: number;
    bookmarks: Array<{
        id: string;
        title: string;
        url?: string;
        path: string;
        dateAdded?: number;
    }>;
}

export interface BookmarkListResult {
    success: boolean;
    folderId: string;
    count: number;
    items: Array<{
        id: string;
        title: string;
        url?: string;
        type: 'bookmark' | 'folder';
        dateAdded?: number;
        childCount?: number;
    }>;
}

export interface BookmarkDeleteResult {
    success: boolean;
    deletedId: string;
    message: string;
}

export interface BookmarkUpdateResult {
    success: boolean;
    id: string;
    title: string;
    url?: string;
}

export interface BookmarkTreeResult {
    success: boolean;
    tree: any;
    totalFolders: number;
    totalBookmarks?: number;
}

export interface BookmarkOrganizationResult {
    success: boolean;
    suggestions: {
        newFolders: Array<{
            name: string;
            reason: string;
        }>;
        moves: Array<{
            bookmarkId: string;
            bookmarkTitle: string;
            currentFolder: string;
            suggestedFolder: string;
            reason: string;
        }>;
        duplicates: Array<{
            bookmarkIds: string[];
            url: string;
            title: string;
        }>;
    };
    autoCreated: boolean;
}
