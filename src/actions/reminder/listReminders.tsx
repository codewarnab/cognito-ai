import { z } from 'zod';
import { useEffect } from 'react';
import { createLogger } from "../../logger";
import { ToolCard } from "../../components/ui/ToolCard";
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { getActiveReminders } from "./storage";
import type { ToolUIState } from '../../ai/tools/components';

const log = createLogger("Actions-Reminders-List");

export function useListRemindersAction() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering listReminders tool...');

        registerTool({
            name: "listReminders",
            description: "List all active reminders that are scheduled",
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

