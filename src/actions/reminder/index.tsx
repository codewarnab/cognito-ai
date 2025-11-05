import { useCreateReminderAction } from "./createReminder";
import { useListRemindersAction } from "./listReminders";
import { useCancelReminderAction } from "./cancelReminder";

export function registerReminderActions() {
    useCreateReminderAction();
    useListRemindersAction();
    useCancelReminderAction();
}

// Re-export types for external use
export type { Reminder, PendingConfirmation } from "./types";

