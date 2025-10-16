/**
 * Memory Types and Helpers
 * Defines data models for the memory system
 */

export type MemoryCategory = "fact" | "behavior";
export type MemorySource = "user" | "task" | "system";

export interface StoredMemory {
  id: string;
  category: MemoryCategory;
  key: string;
  value: unknown;
  source: MemorySource;
  createdAt: number;
  updatedAt: number;
  confidence?: number; // 0-1
  pinned?: boolean;
}

/**
 * Type guards
 */
export function isMemoryCategory(value: unknown): value is MemoryCategory {
  return value === "fact" || value === "behavior";
}

export function isMemorySource(value: unknown): value is MemorySource {
  return value === "user" || value === "task" || value === "system";
}

/**
 * Key canonicalization: converts keys to consistent format
 * Example: "User Name" -> "user.name"
 */
export function canonicalizeKey(key: string): string {
  return key
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
}

/**
 * Helper to create a new memory object
 */
export function createMemory(
  key: string,
  value: unknown,
  category: MemoryCategory,
  source: MemorySource = "user"
): StoredMemory {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    category,
    key: canonicalizeKey(key),
    value,
    source,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Detection patterns for extracting memories from text
 */
export const DETECTION_PATTERNS = {
  name: /(?:my name is|call me|i'm|i am)\s+([a-z]+(?:\s+[a-z]+)*)/i,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  phone: /\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/,
  profession: /(?:i am a|i work as|my job is|i'm a)\s+([a-z\s]+)/i,
  location: /(?:i live in|i'm in|i'm from|located in)\s+([a-z\s,]+)/i,
  behavioral: /(?:never|always|don't|do not)\s+(.+)/i,
};

/**
 * Extract potential memories from user message
 */
export interface DetectedMemory {
  key: string;
  value: unknown;
  category: MemoryCategory;
  pattern: keyof typeof DETECTION_PATTERNS;
}

export function detectMemories(text: string): DetectedMemory[] {
  const detected: DetectedMemory[] = [];

  // Name detection
  const nameMatch = text.match(DETECTION_PATTERNS.name);
  if (nameMatch) {
    detected.push({
      key: "user.name",
      value: nameMatch[1].trim(),
      category: "fact",
      pattern: "name",
    });
  }

  // Email detection
  const emailMatch = text.match(DETECTION_PATTERNS.email);
  if (emailMatch) {
    detected.push({
      key: "user.email",
      value: emailMatch[0],
      category: "fact",
      pattern: "email",
    });
  }

  // Profession detection
  const professionMatch = text.match(DETECTION_PATTERNS.profession);
  if (professionMatch) {
    detected.push({
      key: "user.profession",
      value: professionMatch[1].trim(),
      category: "fact",
      pattern: "profession",
    });
  }

  // Location detection
  const locationMatch = text.match(DETECTION_PATTERNS.location);
  if (locationMatch) {
    detected.push({
      key: "user.location",
      value: locationMatch[1].trim(),
      category: "fact",
      pattern: "location",
    });
  }

  // Behavioral rules
  const behavioralMatch = text.match(DETECTION_PATTERNS.behavioral);
  if (behavioralMatch) {
    detected.push({
      key: `behavior.${canonicalizeKey(behavioralMatch[1].slice(0, 30))}`,
      value: behavioralMatch[0].trim(),
      category: "behavior",
      pattern: "behavioral",
    });
  }

  return detected;
}

