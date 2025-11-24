import { captureTabSnapshot, type TabSnapshotResult } from './tabSnapshot';
import type { TabAttachmentData } from '@/components/features/chat/components/TabAttachment';
import { createLogger } from '~logger';

const log = createLogger('TabProcessor', 'UTILS');

/**
 * Processed tab data ready for AI consumption
 */
export interface ProcessedTab {
  id: string;
  title: string;
  url: string;
  content: string | null;
  favicon?: string;
  error?: string;
}

/**
 * Process tab attachment for AI message
 * Uses existing captureTabSnapshot under the hood
 */
export async function processTabForMessage(
  tabData: TabAttachmentData
): Promise<ProcessedTab> {
  const tabId = parseInt(tabData.id, 10);

  log.info('Processing tab for message', {
    tabId,
    title: tabData.title,
    url: tabData.url
  });

  // Use existing snapshot capture
  const snapshot = await captureTabSnapshot(tabId);

  return {
    id: tabData.id,
    title: tabData.title,
    url: tabData.url,
    content: snapshot.snapshot,
    favicon: tabData.favIconUrl,
    error: snapshot.error || undefined
  };
}

/**
 * Process multiple tabs in parallel
 */
export async function processTabsForMessage(
  tabs: TabAttachmentData[]
): Promise<ProcessedTab[]> {
  log.info('Processing multiple tabs', { count: tabs.length });

  const results = await Promise.all(
    tabs.map(tab => processTabForMessage(tab))
  );

  const successCount = results.filter(r => !r.error).length;
  log.info('Tabs processed', {
    total: tabs.length,
    successful: successCount
  });

  return results;
}
