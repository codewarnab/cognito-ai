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
        registerToolUI('cancelReminder', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <ToolCard
                        title="Cancelling Reminder"
                        subtitle={input?.identifier}
                        state="loading"
                        icon="🗑️"
                    />
                );
            }

            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return (
                        <ToolCard
                            title="Failed to Cancel"
                            subtitle={output.error}
                            state="error"
                            icon="🗑️"
                        />
                    );
                }
                return (
                    <ToolCard
                        title="Reminder Cancelled"
                        subtitle={output.title}
                        state="success"
                        icon="🗑️"
                    />
                );
            }

            if (toolState === 'output-error') {
                return (
                    <ToolCard
                        title="Failed to Cancel"
                        subtitle={state.errorText}
                        state="error"
                        icon="🗑️"
                    />
                );
            }

            return null;
        });

        log.info('✅ cancelReminder tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up cancelReminder tool');
            unregisterToolUI('cancelReminder');
        };
    }, []); // Empty dependency array - only register once on mount
}
