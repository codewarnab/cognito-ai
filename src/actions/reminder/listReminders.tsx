import { z } from 'zod';
import { useEffect } from 'react';
import { createLogger } from '~logger';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { getActiveReminders } from "./storage";

const log = createLogger("Actions-Reminders-List");

export function useListRemindersAction() {
    const {  unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering listReminders tool...');

        registerTool({
            name: "listReminders",
            description: `List all active (scheduled) reminders. Shows upcoming reminders that haven't fired yet.

WHEN TO USE:
- User asks "what reminders do I have?", "show my reminders", "list upcoming reminders"
- Checking if a reminder already exists before creating duplicate
- Managing or reviewing scheduled reminders

PRECONDITIONS:
- None (returns empty list if no reminders)

WORKFLOW:
1. Query storage for active reminders
2. Filter out past/fired reminders
3. Return list with id, title, scheduled time, and URL
4. Sorted by scheduled time (soonest first)

LIMITATIONS:
- Only shows active reminders (not past/fired ones)
- Cannot filter by time range or title
- Returns all active reminders (no pagination)

EXAMPLE: listReminders() -> {count: 3, reminders: [{id: "...", title: "workout", when: "tomorrow at 6am", url: "..."}]}`,
            parameters: z.object({}),
            execute: async () => {
                try {
                    log.info("TOOL CALL: listReminders");
                    const activeReminders = await getActiveReminders();

                    const formattedReminders = activeReminders.map((r) => ({
                        id: r.id,
                        title: r.title,
                        when: new Date(r.when).toLocaleString(),
                        url: r.url,
                    }));

                    log.info('✅ Listed reminders', { count: formattedReminders.length });

                    return {
                        count: formattedReminders.length,
                        reminders: formattedReminders,
                    };
                } catch (error) {
                    log.error('[Tool] Error listing reminders:', error);
                    return { error: "Failed to list reminders" };
                }
            },
        });

        // Register the UI renderer for this tool
        // Using default CompactToolRenderer - no custom UI needed

        log.info('✅ listReminders tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up listReminders tool');
            unregisterToolUI('listReminders');
        };
    }, []); // Empty dependency array - only register once on mount
}


