import { z } from 'zod';
import { useEffect } from 'react';
import { createLogger } from "../../logger";
import { ToolCard } from "../../components/ui/ToolCard";
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { getActiveReminders } from "./storage";
import type { ToolUIState } from '../../ai/ToolUIContext';

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
        registerToolUI('listReminders', (state: ToolUIState) => {
            const { state: toolState, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <ToolCard title="Loading Reminders" state="loading" icon="📋" />
                );
            }

            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return (
                        <ToolCard
                            title="Failed to Load Reminders"
                            subtitle={output.error}
                            state="error"
                            icon="📋"
                        />
                    );
                }
                return (
                    <ToolCard
                        title={`Active Reminders (${output.count})`}
                        state="success"
                        icon="📋"
                    >
                        {output.count === 0 ? (
                            <div style={{ fontSize: "13px", opacity: 0.7 }}>
                                No active reminders
                            </div>
                        ) : (
                            <div style={{ fontSize: "13px" }}>
                                {output.reminders.map((r: any) => (
                                    <div
                                        key={r.id}
                                        style={{
                                            marginBottom: "var(--spacing-sm)",
                                            paddingBottom: "var(--spacing-sm)",
                                            borderBottom: "1px solid var(--color-border)",
                                        }}
                                    >
                                        <div style={{ fontWeight: 600 }}>{r.title}</div>
                                        <div style={{ opacity: 0.7, fontSize: "12px" }}>
                                            {r.when}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ToolCard>
                );
            }

            if (toolState === 'output-error') {
                return (
                    <ToolCard
                        title="Failed to Load Reminders"
                        subtitle={state.errorText}
                        state="error"
                        icon="📋"
                    />
                );
            }

            return null;
        });

        log.info('✅ listReminders tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up listReminders tool');
            unregisterToolUI('listReminders');
        };
    }, []); // Empty dependency array - only register once on mount
}
