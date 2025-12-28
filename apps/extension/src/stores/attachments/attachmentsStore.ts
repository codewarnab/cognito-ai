/**
 * Attachments Store
 *
 * Manages file, tab, PDF, YouTube, and selected text attachments.
 * Replaces useFileAttachments, useLocalPdfAttachment, useYouTubeVideoAttachment hooks.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createLogger } from '~logger';
import type { AttachmentsState } from './types';

const log = createLogger('attachmentsStore', 'ATTACHMENTS_STORAGE');

export const useAttachmentsStore = create<AttachmentsState>()(
  immer((set) => ({
    // Initial state - Files
    fileAttachments: [],
    isDragging: false,

    // Initial state - Tabs
    tabAttachments: [],

    // Initial state - Local PDF
    localPdfInfo: null,
    isLocalPdfDismissed: false,
    isAttachingLocalPdf: false,

    // Initial state - YouTube
    youtubeVideoInfo: null,
    isYouTubeDismissed: false,
    isAttachingYouTube: false,
    youtubeMetadata: null,
    isFetchingYouTubeMetadata: false,

    // Initial state - Selected Text
    selectedTextInfo: null,
    isSelectedTextDismissed: false,
    isAttachingSelectedText: false,

    // Actions - Files
    /**
     * Adds a single file attachment to the store.
     * @param attachment - The file attachment to add
     */
    addFileAttachment: (attachment) =>
      set((state) => {
        state.fileAttachments.push(attachment);
      }),

    /**
     * Adds multiple file attachments to the store.
     * @param attachments - Array of file attachments to add
     */
    addFileAttachments: (attachments) =>
      set((state) => {
        state.fileAttachments.push(...attachments);
      }),

    /**
     * Removes a file attachment by ID.
     * @param id - The unique identifier of the attachment to remove
     */
    removeFileAttachment: (id) =>
      set((state) => {
        const index = state.fileAttachments.findIndex((f) => f.id === id);
        if (index !== -1) state.fileAttachments.splice(index, 1);
      }),

    /**
     * Clears all file attachments from the store.
     */
    clearFileAttachments: () =>
      set((state) => {
        state.fileAttachments = [];
      }),

    /**
     * Sets the drag state for file drop handling.
     * @param isDragging - Whether a file is being dragged over the drop zone
     */
    setIsDragging: (isDragging) => set({ isDragging }),

    // Actions - Tabs
    /**
     * Adds multiple tab attachments to the store.
     * @param tabs - Array of tab attachments to add
     */
    addTabAttachments: (tabs) =>
      set((state) => {
        state.tabAttachments.push(...tabs);
      }),

    /**
     * Removes a tab attachment by ID.
     * @param id - The unique identifier of the tab attachment to remove
     */
    removeTabAttachment: (id) =>
      set((state) => {
        const index = state.tabAttachments.findIndex((t) => t.id === id);
        if (index !== -1) state.tabAttachments.splice(index, 1);
      }),

    /**
     * Clears all tab attachments from the store.
     */
    clearTabAttachments: () =>
      set((state) => {
        state.tabAttachments = [];
      }),

    // Actions - Local PDF
    /**
     * Sets the local PDF info and resets dismissed state if PDF changed.
     * @param info - The PDF info object or null to clear
     */
    setLocalPdfInfo: (info) =>
      set((state) => {
        state.localPdfInfo = info;
        // Reset dismissed state when PDF changes
        if (info && state.localPdfInfo?.filePath !== info.filePath) {
          state.isLocalPdfDismissed = false;
        }
      }),

    /**
     * Sets the attaching state for local PDF.
     * @param isAttaching - Whether a PDF is currently being attached
     */
    setIsAttachingLocalPdf: (isAttaching) => set({ isAttachingLocalPdf: isAttaching }),

    /**
     * Dismisses the local PDF suggestion.
     */
    dismissLocalPdf: () =>
      set((state) => {
        state.isLocalPdfDismissed = true;
        log.info('Local PDF dismissed', { filePath: state.localPdfInfo?.filePath });
      }),

    /**
     * Resets the local PDF dismissed state.
     */
    resetLocalPdfDismissed: () => set({ isLocalPdfDismissed: false }),

    // Actions - YouTube
    /**
     * Sets the YouTube video info and resets dismissed state if video changed.
     * @param info - The YouTube video info object or null to clear
     */
    setYouTubeVideoInfo: (info) =>
      set((state) => {
        // Reset dismissed state when video changes
        if (info && state.youtubeVideoInfo?.videoId !== info.videoId) {
          state.isYouTubeDismissed = false;
          state.youtubeMetadata = null;
        }
        state.youtubeVideoInfo = info;
      }),

    /**
     * Sets the attaching state for YouTube video.
     * @param isAttaching - Whether a YouTube video is currently being attached
     */
    setIsAttachingYouTube: (isAttaching) => set({ isAttachingYouTube: isAttaching }),

    /**
     * Sets the YouTube video metadata.
     * @param metadata - The video metadata object or null to clear
     */
    setYouTubeMetadata: (metadata) => set({ youtubeMetadata: metadata }),

    /**
     * Sets the fetching state for YouTube metadata.
     * @param isFetching - Whether metadata is currently being fetched
     */
    setIsFetchingYouTubeMetadata: (isFetching) =>
      set({ isFetchingYouTubeMetadata: isFetching }),

    /**
     * Dismisses the YouTube video suggestion.
     */
    dismissYouTubeVideo: () =>
      set((state) => {
        state.isYouTubeDismissed = true;
        state.youtubeMetadata = null;
        log.info('YouTube video dismissed', { videoId: state.youtubeVideoInfo?.videoId });
      }),

    /**
     * Resets the YouTube dismissed state.
     */
    resetYouTubeDismissed: () => set({ isYouTubeDismissed: false }),

    // Actions - Selected Text
    /**
     * Sets the selected text info and resets dismissed state if text changed.
     * @param info - The selected text info object or null to clear
     */
    setSelectedTextInfo: (info) =>
      set((state) => {
        // Only reset dismissed state when text actually changes
        // This prevents the suggestion from reappearing after adding as attachment
        const textChanged = info?.text !== state.selectedTextInfo?.text;
        if (info && textChanged) {
          state.isSelectedTextDismissed = false;
        }
        state.selectedTextInfo = info;
      }),

    /**
     * Sets the attaching state for selected text.
     * @param isAttaching - Whether selected text is currently being attached
     */
    setIsAttachingSelectedText: (isAttaching) => set({ isAttachingSelectedText: isAttaching }),

    /**
     * Dismisses the selected text suggestion.
     */
    dismissSelectedText: () => set({ isSelectedTextDismissed: true }),

    /**
     * Resets the selected text dismissed state.
     */
    resetSelectedTextDismissed: () => set({ isSelectedTextDismissed: false }),

    // Clear all
    /**
     * Clears all attachments and resets dismissed states.
     */
    clearAll: () =>
      set((state) => {
        state.fileAttachments = [];
        state.tabAttachments = [];
        state.isLocalPdfDismissed = false;
        state.isYouTubeDismissed = false;
        state.isSelectedTextDismissed = false;
        state.youtubeMetadata = null;
      }),

    // After send - clears file and tab attachments only
    /**
     * Clears file and tab attachments for a new message.
     * Preserves PDF, YouTube, and selected text states.
     */
    clearForNewMessage: () =>
      set((state) => {
        state.fileAttachments = [];
        state.tabAttachments = [];
      }),
  }))
);
