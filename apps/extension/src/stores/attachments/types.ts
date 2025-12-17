/**
 * Attachments Store Types
 *
 * Types for file, tab, PDF, YouTube, and selected text attachments.
 */

import type { FileAttachmentData } from '@/components/features/chat/components/attachments/FileAttachment';
import type { TabAttachmentData } from '@/components/features/chat/components/attachments/TabAttachment';

export interface LocalPdfInfo {
  url: string;
  filename: string;
  filePath: string;
}

export interface YouTubeVideoInfo {
  videoId: string;
  url: string;
  title: string;
  channelName?: string;
  thumbnailUrl?: string;
}

export interface YouTubeVideoMetadata {
  videoId: string;
  title?: string;
  author?: string;
  thumbnail?: string;
  durationSeconds?: number;
  description?: string;
  isPrefetched: boolean;
}

export interface SelectedTextInfo {
  text: string;
  url: string;
  title: string;
}

export interface AttachmentsState {
  // File attachments
  fileAttachments: FileAttachmentData[];
  isDragging: boolean;

  // Tab attachments
  tabAttachments: TabAttachmentData[];

  // Local PDF detection
  localPdfInfo: LocalPdfInfo | null;
  isLocalPdfDismissed: boolean;
  isAttachingLocalPdf: boolean;

  // YouTube detection
  youtubeVideoInfo: YouTubeVideoInfo | null;
  isYouTubeDismissed: boolean;
  isAttachingYouTube: boolean;
  youtubeMetadata: YouTubeVideoMetadata | null;
  isFetchingYouTubeMetadata: boolean;

  // Selected text
  selectedTextInfo: SelectedTextInfo | null;
  isSelectedTextDismissed: boolean;
  isAttachingSelectedText: boolean;

  // Actions - Files
  addFileAttachment: (attachment: FileAttachmentData) => void;
  addFileAttachments: (attachments: FileAttachmentData[]) => void;
  removeFileAttachment: (id: string) => void;
  clearFileAttachments: () => void;
  setIsDragging: (isDragging: boolean) => void;

  // Actions - Tabs
  addTabAttachments: (tabs: TabAttachmentData[]) => void;
  removeTabAttachment: (id: string) => void;
  clearTabAttachments: () => void;

  // Actions - Local PDF
  setLocalPdfInfo: (info: LocalPdfInfo | null) => void;
  setIsAttachingLocalPdf: (isAttaching: boolean) => void;
  dismissLocalPdf: () => void;
  resetLocalPdfDismissed: () => void;

  // Actions - YouTube
  setYouTubeVideoInfo: (info: YouTubeVideoInfo | null) => void;
  setIsAttachingYouTube: (isAttaching: boolean) => void;
  setYouTubeMetadata: (metadata: YouTubeVideoMetadata | null) => void;
  setIsFetchingYouTubeMetadata: (isFetching: boolean) => void;
  dismissYouTubeVideo: () => void;
  resetYouTubeDismissed: () => void;

  // Actions - Selected Text
  setSelectedTextInfo: (info: SelectedTextInfo | null) => void;
  setIsAttachingSelectedText: (isAttaching: boolean) => void;
  dismissSelectedText: () => void;
  resetSelectedTextDismissed: () => void;

  // Clear all
  clearAll: () => void;

  // After send - clears file and tab attachments only
  clearForNewMessage: () => void;
}
