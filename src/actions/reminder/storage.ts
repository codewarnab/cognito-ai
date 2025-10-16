import type { Reminder } from "./types";

/**
 * Get all reminders from Chrome storage
 */
export async function getAllReminders(): Promise<Record<string, Reminder>> {
    try {
        const result = await chrome.storage.local.get("reminders");
        const rawReminders = (result && (result as any).reminders) ?? {};

        if (typeof rawReminders !== "object" || rawReminders === null) {
            console.warn("Expected reminders to be an object, received:", rawReminders);
            return {};
        }

        const sanitized: Record<string, Reminder> = {};
        for (const [key, value] of Object.entries(rawReminders as Record<string, unknown>)) {
            if (typeof key !== "string") {
                console.warn("Skipping reminder with non-string key:", key);
                continue;
            }
            if (isReminder(value)) {
                sanitized[key] = value;
            } else {
                console.warn("Skipping malformed reminder entry:", { key, value });
            }
        }

        return sanitized;
    } catch (error) {
        console.error("Failed to read reminders from chrome.storage.local:", error);
        return {};
    }
}

function isReminder(candidate: unknown): candidate is Reminder {
    if (candidate === null || typeof candidate !== "object") {
        return false;
    }
    const r = candidate as Record<string, unknown>;
    const hasRequiredFields =
        typeof r.id === "string" &&
        typeof r.title === "string" &&
        typeof r.when === "number" &&
        typeof r.createdAt === "number";

    if (!hasRequiredFields) {
        return false;
    }

    const optionalFieldsAreValid =
        (r.url === undefined || typeof r.url === "string") &&
        (r.generatedTitle === undefined || typeof r.generatedTitle === "string") &&
        (r.generatedDescription === undefined || typeof r.generatedDescription === "string");

    return optionalFieldsAreValid;
}

/**
 * Save a reminder to Chrome storage
 */
export async function saveReminder(reminder: Reminder): Promise<void> {
    const reminders = await getAllReminders();
    reminders[reminder.id] = reminder;
    await chrome.storage.local.set({ reminders });
}

/**
 * Delete a reminder from Chrome storage
 */
export async function deleteReminder(id: string): Promise<void> {
    const reminders = await getAllReminders();
    delete reminders[id];
    await chrome.storage.local.set({ reminders });
}

/**
 * Get active reminders (future reminders only)
 */
export async function getActiveReminders(): Promise<Reminder[]> {
    const reminders = await getAllReminders();
    const reminderList = Object.values(reminders);
    const now = Date.now();

    return reminderList
        .filter((r) => r.when > now)
        .sort((a, b) => a.when - b.when);
}

/**
 * Find a reminder by ID or title
 */
export async function findReminder(identifier: string): Promise<Reminder | null> {
    const reminders = await getAllReminders();
    const reminderList = Object.values(reminders);

    return (
        reminderList.find(
            (r) =>
                r.id === identifier ||
                r.title.toLowerCase().includes(identifier.toLowerCase())
        ) || null
    );
}
