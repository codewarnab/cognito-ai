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
                "Create a reminder with a custom AI-generated title and description for the notification. IMPORTANT: You MUST generate BOTH a catchy title AND a motivational description for every reminder. Only call this function when you have a SPECIFIC time from the user. If the user says 'tomorrow', 'today', or 'next week' WITHOUT a specific time, you MUST ask them 'What time would you like the reminder?' before calling this function. Examples: For workouts: title='💪 Time to Get Fit!', description='Your body will thank you! Let\\'s crush this workout!' For work tasks: title='🎯 Career Boost Time', description='Success is built one step at a time. You got this!' For personal tasks: title='❤️ Connect with Loved Ones', description='The best investment is time with family.'",
            parameters: z.object({
                title: z.string().describe("Short reminder task (e.g., 'workout', 'apply for the job', 'call mom') - this is the internal reference"),
                dateTime: z.string().describe("Natural language date/time WITH SPECIFIC TIME like 'tomorrow at 2pm', 'next Monday at 9am', 'today at 5pm', 'in 2 hours', etc. Must include a specific time - do NOT pass ambiguous values like just 'tomorrow' or 'today' without time."),
                generatedTitle: z.string().describe("REQUIRED: AI-generated catchy notification TITLE (max 50 chars). Use emojis and make it engaging! Examples: '💪 Time to Get Fit!', '🎯 Career Boost Time', '❤️ Connect with Loved Ones'. This will be the MAIN notification headline the user sees."),
                generatedDescription: z.string().describe("REQUIRED: AI-generated motivational/fun DESCRIPTION (max 100 chars). Add context and motivation! Examples: For workout: 'Your body will thank you! Let\\'s crush this workout!' For work: 'Success is built one step at a time.' For personal: 'The best investment is time with family.' This will be the notification message body."),
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
        // Using default CompactToolRenderer - no custom UI needed

        log.info('✅ createReminder tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up createReminder tool');
            unregisterToolUI('createReminder');
        };
    }, []); // Empty dependency array - only register once on mount
}
