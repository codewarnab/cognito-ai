import { z } from 'zod';
import { useEffect } from 'react';
import { createLogger } from "../../logger";
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

