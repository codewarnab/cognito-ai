/**
 * Type-safe query builders and result types
 */

import type { ChatThread, SettingsTypeMap } from './schema';

// Type-safe setting getter/setter
export type GetSetting = <K extends keyof SettingsTypeMap>(
  key: K
) => Promise<SettingsTypeMap[K] | undefined>;

export type SetSetting = <K extends keyof SettingsTypeMap>(
  key: K,
  value: SettingsTypeMap[K]
) => Promise<void>;

// Query result types
export interface ThreadWithMessageCount extends ChatThread {
  messageCount: number;
}

export interface ThreadQueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface MessageQueryOptions {
  threadId?: string;
  limit?: number;
  offset?: number;
  startDate?: number;
  endDate?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}
