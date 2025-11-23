import { createLogger } from '~logger';
import { useCreateBookmark } from './createBookmark';
import { useSearchBookmarks } from './searchBookmarks';
import { useListBookmarks } from './listBookmarks';
import { useDeleteBookmark } from './deleteBookmark';
import { useUpdateBookmark } from './updateBookmark';
import { useGetBookmarkTree } from './getBookmarkTree';
import { useOrganizeBookmarks } from './organizeBookmarks';
import { useBookmarksTool } from './bookmarksTool';

const log = createLogger('Actions-Bookmarks');

export function registerBookmarkActions() {
    useCreateBookmark();
    useSearchBookmarks();
    useListBookmarks();
    useDeleteBookmark();
    useUpdateBookmark();
    useGetBookmarkTree();
    useOrganizeBookmarks();
    useBookmarksTool();

    log.debug('Bookmark actions registered');
}

export {
    useCreateBookmark,
    useSearchBookmarks,
    useListBookmarks,
    useDeleteBookmark,
    useUpdateBookmark,
    useGetBookmarkTree,
    useOrganizeBookmarks,
    useBookmarksTool
};
