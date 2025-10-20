import { z } from 'zod';
import { useEffect } from 'react';
import { createLogger } from "../../logger";
import { ToolCard } from "../../components/ui/ToolCard";
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { parseDateTimeToEpoch } from "./utils";
import { saveReminder } from "./storage";
import type { Reminder } from "./types";
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger("Actions-Reminders-Create");

export function useCreateReminderAction() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering createReminder tool...');

        registerTool({
            name: "createReminder",
            description:
                "Create a fun, engaging reminder with AI-generated title and motivational description. IMPORTANT: Only call this function when you have a SPECIFIC time from the user. If the user says 'tomorrow', 'today', or 'next week' WITHOUT a specific time, you MUST ask them 'What time would you like the reminder?' before calling this function. For workouts: add fitness motivation. For work tasks: add productivity quotes. For personal tasks: add encouraging messages.",
            parameters: z.object({
                title: z.string().describe("What to remind about (e.g., 'workout', 'apply for the job', 'call mom')"),
                dateTime: z.string().describe("Natural language date/time WITH SPECIFIC TIME like 'tomorrow at 2pm', 'next Monday at 9am', 'today at 5pm', 'in 2 hours', etc. Must include a specific time - do NOT pass ambiguous values like just 'tomorrow' or 'today' without time."),
                generatedTitle: z.string().describe("AI-generated catchy notification title (max 50 chars) based on the reminder context. Make it fun and engaging!"),
                generatedDescription: z.string().describe("AI-generated motivational/fun description (max 100 chars). For workout: fitness quote. For work: productivity tip. For personal: encouraging message."),
            }),
            execute: async ({ title, dateTime, generatedTitle, generatedDescription }) => {
                try {
                    log.info("TOOL CALL: createReminder", { title, dateTime, generatedTitle, generatedDescription });

                    // Parse the dateTime string to epoch ms
                    const when = parseDateTimeToEpoch(dateTime);

                    // Get current tab URL
                    const [tab] = await chrome.tabs.query({
                        active: true,
                        currentWindow: true,
                    });
                    const url = tab?.url;

                    const id = crypto.randomUUID();
                    const reminder: Reminder = {
                        id,
                        title,
                        when,
                        url,
                        createdAt: Date.now(),
                        generatedTitle: generatedTitle.substring(0, 50),
                        generatedDescription: generatedDescription.substring(0, 100),
                    };

                    // Save reminder
                    await saveReminder(reminder);

                    // Schedule alarm
                    await chrome.alarms.create(`reminder:${id}`, { when });

                    log.info("✅ Reminder created", { id, title, when });

                    return {
                        success: true,
                        id,
                        title: reminder.title,
                        generatedTitle: reminder.generatedTitle,
                        generatedDescription: reminder.generatedDescription,
                        when: new Date(when).toLocaleString(),
                        message: `Reminder set for ${new Date(when).toLocaleString()}`,
                    };
                } catch (error) {
                    log.error('[Tool] Error creating reminder:', error);
                    return {
                        error: "Failed to create reminder",
                        details: error instanceof Error ? error.message : String(error),
                    };
                }
            },
        });

        // Register the UI renderer for this tool
        registerToolUI('createReminder', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <ToolCard
                        title="Creating Reminder"
                        subtitle={`"${input?.title}" at ${input?.dateTime}`}
                        state="loading"
                        icon="⏰"
                    />
                );
            }

            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return (
                        <ToolCard
                            title="Failed to Create Reminder"
                            subtitle={output.details || output.error}
                            state="error"
                            icon="⏰"
                        />
                    );
                }
                return (
                    <ToolCard title="Reminder Set" state="success" icon="⏰">
                        <div style={{ fontSize: "13px" }}>
                            <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                                {output.generatedTitle || output.title}
                            </div>
                            <div style={{ marginBottom: "4px", fontSize: "12px" }}>
                                {output.generatedDescription}
                            </div>
                            <div style={{ opacity: 0.7, fontSize: "11px" }}>
                                {output.when}
                            </div>
                        </div>
                    </ToolCard>
                );
            }

            if (toolState === 'output-error') {
                return (
                    <ToolCard
                        title="Failed to Create Reminder"
                        subtitle={state.errorText}
                        state="error"
                        icon="⏰"
                    />
                );
            }

            return null;
        });

        log.info('✅ createReminder tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up createReminder tool');
            unregisterToolUI('createReminder');
        };
    }, []); // Empty dependency array - only register once on mount
}
