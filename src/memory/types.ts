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
  confidence?: Confidence; // 0-1 branded
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
  const normalized = key
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.+/g, ".") // collapse consecutive dots
    .replace(/^\.+|\.+$/g, ""); // trim leading/trailing dots

  if (normalized.length === 0) {
    throw new Error("canonicalizeKey: key is empty after normalization");
  }

  return normalized;
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
  name: /(?:my name is|call me|i'm|i am)\s+([\p{L}][\p{L}\s'-]*)/iu,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  phone: /\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/,
  profession: /(?:i am a|i work as|my job is|i'm a)\s+([\p{L}\s'-]+)/iu,
  location: /(?:i live in|i'm in|i'm from|located in)\s+([\p{L}\s,'-]+)/iu,
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

  // Phone detection
  const phoneMatch = text.match(DETECTION_PATTERNS.phone);
  if (phoneMatch) {
    detected.push({
      key: "user.phone",
      value: phoneMatch[0],
      category: "fact",
      pattern: "phone",
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

/**
 * Branded Confidence type to guarantee values are within [0, 1].
 */
export type Confidence = number & { __brand: "Confidence" };

/**
 * Runtime validator/factory for Confidence. Returns a branded value only if in range [0, 1].
 * If clamp is true, out-of-range inputs are clamped; otherwise an Error is thrown.
 */
export function createConfidence(value: number, options?: { clamp?: boolean }): Confidence {
  const clamp = options?.clamp === true;
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error("Confidence must be a finite number");
  }
  let v = value;
  if (v < 0 || v > 1) {
    if (!clamp) {
      throw new Error("Confidence must be between 0 and 1 inclusive");
    }
    v = Math.min(1, Math.max(0, v));
  }
  return v as Confidence;
}

/**
 * Type guard for Confidence branded values.
 */
export function isConfidence(value: unknown): value is Confidence {
  return typeof value === "number" && value >= 0 && value <= 1;
}

