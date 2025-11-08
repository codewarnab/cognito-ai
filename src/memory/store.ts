/**
 * Memory Storage Layer
 * Thin wrapper around @plasmohq/storage with CRUD operations
 */

import { Storage } from "@plasmohq/storage";
import type { StoredMemory, MemoryCategory } from "./types";
import { createLogger } from "../logger";

const memoryLog = createLogger("MemoryStore", "MEMORY_OPERATIONS");

// Storage area: "sync" for cross-Chrome instance sync
export const memoryStorage = new Storage({ area: "sync" });

const MEMORY_KEY_PREFIX = "memory:";
const MEMORY_INDEX_KEY = "memory:index";

/**
 * Index structure: maps memory IDs for efficient lookups
 */
interface MemoryIndex {
  ids: string[];
  keyToId: Record<string, string>; // key -> id mapping
}

/**
 * Get the memory index
 */
async function getIndex(): Promise<MemoryIndex> {
  const index = await memoryStorage.get<MemoryIndex>(MEMORY_INDEX_KEY);
  return index || { ids: [], keyToId: {} };
}

/**
 * Update the memory index
 */
async function updateIndex(index: MemoryIndex): Promise<void> {
  await memoryStorage.set(MEMORY_INDEX_KEY, index);
}

/**
 * Save a memory
 */
export async function saveMemory(memory: StoredMemory): Promise<StoredMemory> {
  memoryLog.debug("Saving memory", { id: memory.id, key: memory.key });

  const index = await getIndex();

  // Check if key already exists
  const existingId = index.keyToId[memory.key];
  if (existingId && existingId !== memory.id) {
    // Update existing memory instead
    const existing = await getMemory(existingId);
    if (existing) {
      existing.value = memory.value;
      existing.updatedAt = Date.now();
      existing.confidence = memory.confidence;
      await memoryStorage.set(`${MEMORY_KEY_PREFIX}${existingId}`, existing);
      memoryLog.info("Updated existing memory", { id: existingId, key: memory.key });
      return existing;
    }
  }

  // Save new memory
  await memoryStorage.set(`${MEMORY_KEY_PREFIX}${memory.id}`, memory);

  // Update index
  if (!index.ids.includes(memory.id)) {
    index.ids.push(memory.id);
  }
  index.keyToId[memory.key] = memory.id;
  await updateIndex(index);

  memoryLog.info("Memory saved", { id: memory.id, key: memory.key });
  return memory;
}

/**
 * Get a memory by ID
 */
export async function getMemory(id: string): Promise<StoredMemory | null> {
  const memory = await memoryStorage.get<StoredMemory>(`${MEMORY_KEY_PREFIX}${id}`);
  return memory || null;
}

/**
 * Get a memory by key
 */
export async function getMemoryByKey(key: string): Promise<StoredMemory | null> {
  const index = await getIndex();
  const id = index.keyToId[key];
  if (!id) return null;
  return getMemory(id);
}

/**
 * List all memories, optionally filtered by category or keys
 */
export async function listMemories(options?: {
  category?: MemoryCategory;
  keys?: string[];
  limit?: number;
}): Promise<StoredMemory[]> {
  const index = await getIndex();
  const memories: StoredMemory[] = [];

  for (const id of index.ids) {
    const memory = await getMemory(id);
    if (!memory) continue;

    // Apply filters
    if (options?.category && memory.category !== options.category) continue;
    if (options?.keys && !options.keys.includes(memory.key)) continue;

    memories.push(memory);

    if (options?.limit && memories.length >= options.limit) break;
  }

  // Sort by updatedAt descending (most recent first)
  memories.sort((a, b) => b.updatedAt - a.updatedAt);

  return memories;
}

/**
 * Delete a memory by ID
 */
export async function deleteMemory(id: string): Promise<boolean> {
  memoryLog.debug("Deleting memory", { id });

  const memory = await getMemory(id);
  if (!memory) return false;

  await memoryStorage.remove(`${MEMORY_KEY_PREFIX}${id}`);

  // Update index
  const index = await getIndex();
  index.ids = index.ids.filter((memId) => memId !== id);
  delete index.keyToId[memory.key];
  await updateIndex(index);

  memoryLog.info("Memory deleted", { id, key: memory.key });
  return true;
}

/**
 * Delete a memory by key
 */
export async function deleteMemoryByKey(key: string): Promise<boolean> {
  const index = await getIndex();
  const id = index.keyToId[key];
  if (!id) return false;
  return deleteMemory(id);
}

/**
 * Delete all memories
 */
export async function clearAllMemories(): Promise<number> {
  const index = await getIndex();
  let count = 0;

  for (const id of index.ids) {
    await memoryStorage.remove(`${MEMORY_KEY_PREFIX}${id}`);
    count++;
  }

  await memoryStorage.set(MEMORY_INDEX_KEY, { ids: [], keyToId: {} });

  memoryLog.info("Cleared all memories", { count });
  return count;
}

/**
 * Search memories by value (substring match)
 */
export async function searchMemories(query: string): Promise<StoredMemory[]> {
  const allMemories = await listMemories();
  const lowerQuery = query.toLowerCase();

  return allMemories.filter((memory) => {
    const keyMatch = memory.key.toLowerCase().includes(lowerQuery);
    const valueMatch = String(memory.value).toLowerCase().includes(lowerQuery);
    return keyMatch || valueMatch;
  });
}

/**
 * Get behavioral preferences only (for injection into context)
 */
export async function getBehavioralPreferences(): Promise<Record<string, unknown>> {
  const behaviors = await listMemories({ category: "behavior" });
  const preferences: Record<string, unknown> = {};

  for (const behavior of behaviors) {
    preferences[behavior.key] = behavior.value;
  }

  return preferences;
}

