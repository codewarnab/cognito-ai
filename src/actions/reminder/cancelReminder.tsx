import { z } from 'zod';
import { useEffect } from 'react';
import { createLogger } from '~logger';
import { CompactToolRenderer } from "../../ai/tools/components";
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { findReminder, deleteReminder } from "./storage";
import type { ToolUIState } from '../../ai/tools/components';

const log = createLogger("Actions-Reminders-Cancel");

export function useCancelReminderAction() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering cancelReminder tool...');

        registerTool({
            name: "cancelReminder",
            description: `Cancel an existing reminder by title or ID. Removes the reminder and clears the scheduled alarm.

WHEN TO USE:
- User asks to "cancel X reminder", "remove reminder for Y", "delete that reminder"
- User changes plans and no longer needs the reminder
- Correcting a mistake (cancel wrong reminder, will create new one)

PRECONDITIONS:
- Reminder must exist and be active
- Must provide either title or ID to identify reminder

WORKFLOW:
1. Search for reminder by title or ID
2. Clear the scheduled browser alarm
3. Delete reminder from storage
4. Return confirmation with reminder title

LIMITATIONS:
- Cannot undo cancellation (must recreate reminder)
- Identifier must match title or ID exactly
- Cannot cancel multiple reminders at once

EXAMPLE: cancelReminder(identifier="workout") -> {success: true, title: "workout", message: "Reminder cancelled"}`,
            parameters: z.object({
                identifier: z.string().describe("Reminder title or ID to cancel. Can be the internal title (e.g., 'workout', 'call mom') or the UUID. Use listReminders first if unsure of exact identifier."),
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

        // Register UI with custom renderers
        registerToolUI('cancelReminder', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
            renderInput: (input: any) => (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', opacity: 0.7 }}>Identifier:</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)', opacity: 0.9 }}>
                            {input.identifier}
                        </span>
                    </div>
                </div>
            ),
            renderOutput: (output: any) => (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                }}>
                    {output.success && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7 }}>Cancelled:</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-primary)', opacity: 0.9 }}>
                                    {output.title}
                                </span>
                            </div>
                        </>
                    )}
                    {output.error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7, color: 'var(--error-color)' }}>
                                {output.error}
                            </span>
                        </div>
                    )}
                </div>
            )
        });

        log.info('✅ cancelReminder tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up cancelReminder tool');
            unregisterToolUI('cancelReminder');
        };
    }, []); // Empty dependency array - only register once on mount
}


