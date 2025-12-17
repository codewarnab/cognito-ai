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

const log = createLogger('attachmentsStore', 'STORAGE');

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
    addFileAttachment: (attachment) =>
      set((state) => {
        state.fileAttachments.push(attachment);
      }),

    addFileAttachments: (attachments) =>
      set((state) => {
        state.fileAttachments.push(...attachments);
      }),

    removeFileAttachment: (id) =>
      set((state) => {
        const index = state.fileAttachments.findIndex((f) => f.id === id);
        if (index !== -1) state.fileAttachments.splice(index, 1);
      }),

    clearFileAttachments: () =>
      set((state) => {
        state.fileAttachments = [];
      }),

    setIsDragging: (isDragging) => set({ isDragging }),

    // Actions - Tabs
    addTabAttachments: (tabs) =>
      set((state) => {
        state.tabAttachments.push(...tabs);
      }),

    removeTabAttachment: (id) =>
      set((state) => {
        const index = state.tabAttachments.findIndex((t) => t.id === id);
        if (index !== -1) state.tabAttachments.splice(index, 1);
      }),

    clearTabAttachments: () =>
      set((state) => {
        state.tabAttachments = [];
      }),

    // Actions - Local PDF
    setLocalPdfInfo: (info) =>
      set((state) => {
        state.localPdfInfo = info;
        // Reset dismissed state when PDF changes
        if (info && state.localPdfInfo?.filePath !== info.filePath) {
          state.isLocalPdfDismissed = false;
        }
      }),

    setIsAttachingLocalPdf: (isAttaching) => set({ isAttachingLocalPdf: isAttaching }),

    dismissLocalPdf: () =>
      set((state) => {
        state.isLocalPdfDismissed = true;
        log.info('Local PDF dismissed', { filePath: state.localPdfInfo?.filePath });
      }),

    resetLocalPdfDismissed: () => set({ isLocalPdfDismissed: false }),

    // Actions - YouTube
    setYouTubeVideoInfo: (info) =>
      set((state) => {
        // Reset dismissed state when video changes
        if (info && state.youtubeVideoInfo?.videoId !== info.videoId) {
          state.isYouTubeDismissed = false;
          state.youtubeMetadata = null;
        }
        state.youtubeVideoInfo = info;
      }),

    setIsAttachingYouTube: (isAttaching) => set({ isAttachingYouTube: isAttaching }),

    setYouTubeMetadata: (metadata) => set({ youtubeMetadata: metadata }),

    setIsFetchingYouTubeMetadata: (isFetching) =>
      set({ isFetchingYouTubeMetadata: isFetching }),

    dismissYouTubeVideo: () =>
      set((state) => {
        state.isYouTubeDismissed = true;
        state.youtubeMetadata = null;
        log.info('YouTube video dismissed', { videoId: state.youtubeVideoInfo?.videoId });
      }),

    resetYouTubeDismissed: () => set({ isYouTubeDismissed: false }),

    // Actions - Selected Text
    setSelectedTextInfo: (info) =>
      set((state) => {
        state.selectedTextInfo = info;
        // Reset dismissed state when text changes
        if (info) {
          state.isSelectedTextDismissed = false;
        }
      }),

    setIsAttachingSelectedText: (isAttaching) => set({ isAttachingSelectedText: isAttaching }),

    dismissSelectedText: () => set({ isSelectedTextDismissed: true }),

    resetSelectedTextDismissed: () => set({ isSelectedTextDismissed: false }),

    // Clear all
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
    clearForNewMessage: () =>
      set((state) => {
        state.fileAttachments = [];
        state.tabAttachments = [];
      }),
  }))
);
