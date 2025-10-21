import { z } from 'zod';
import { useEffect } from 'react';
import { createLogger } from "../../logger";
import { ToolCard } from "../../components/ui/ToolCard";
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { findReminder, deleteReminder } from "./storage";
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger("Actions-Reminders-Cancel");

export function useCancelReminderAction() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering cancelReminder tool...');

        registerTool({
            name: "cancelReminder",
            description: "Cancel an existing reminder by its title or ID",
            parameters: z.object({
                identifier: z.string().describe("Reminder title or ID to cancel"),
            }),
            execute: async ({ identifier }) => {
                try {
                    log.info("TOOL CALL: cancelReminder", { identifier });
                    const reminder = await findReminder(identifier);

                    if (!reminder) {
                        return { error: "Reminder not found" };
                    }

                    // Cancel alarm
                    await chrome.alarms.clear(`reminder:${reminder.id}`);

                    // Remove from storage
                    await deleteReminder(reminder.id);

                    log.info('✅ Reminder cancelled', { id: reminder.id, title: reminder.title });

                    return {
                        success: true,
                        title: reminder.title,
                        message: `Reminder "${reminder.title}" cancelled`,
                    };
                } catch (error) {
                    log.error('[Tool] Error cancelling reminder:', error);
                    return { error: "Failed to cancel reminder" };
                }
            },
        });

        // Register the UI renderer for this tool
        // Using default CompactToolRenderer - no custom UI needed

        log.info('✅ cancelReminder tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up cancelReminder tool');
            unregisterToolUI('cancelReminder');
        };
    }, []); // Empty dependency array - only register once on mount
}
