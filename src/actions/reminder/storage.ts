import type { Reminder } from "./types";

/**
 * Get all reminders from Chrome storage
 */
export async function getAllReminders(): Promise<Record<string, Reminder>> {
    const { reminders = {} } = await chrome.storage.local.get("reminders");
    return reminders;
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
