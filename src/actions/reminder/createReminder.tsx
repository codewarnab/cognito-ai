import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { ToolCard } from "../../components/ui/ToolCard";
import { parseDateTimeToEpoch } from "./utils";
import { saveReminder } from "./storage";
import type { Reminder } from "./types";

const log = createLogger("Actions-Reminders-Create");

export function useCreateReminderAction() {
    useFrontendTool({
        name: "createReminder",
        description:
            "Create a fun, engaging reminder with AI-generated title and motivational description. IMPORTANT: Only call this function when you have a SPECIFIC time from the user. If the user says 'tomorrow', 'today', or 'next week' WITHOUT a specific time, you MUST ask them 'What time would you like the reminder?' before calling this function. For workouts: add fitness motivation. For work tasks: add productivity quotes. For personal tasks: add encouraging messages.",
        parameters: [
            {
                name: "title",
                type: "string",
                description: "What to remind about (e.g., 'workout', 'apply for the job', 'call mom')",
                required: true,
            },
            {
                name: "dateTime",
                type: "string",
                description:
                    "Natural language date/time WITH SPECIFIC TIME like 'tomorrow at 2pm', 'next Monday at 9am', 'today at 5pm', 'in 2 hours', etc. Must include a specific time - do NOT pass ambiguous values like just 'tomorrow' or 'today' without time.",
                required: true,
            },
            {
                name: "generatedTitle",
                type: "string",
                description: "AI-generated catchy notification title (max 50 chars) based on the reminder context. Make it fun and engaging!",
                required: true,
            },
            {
                name: "generatedDescription",
                type: "string",
                description: "AI-generated motivational/fun description (max 100 chars). For workout: fitness quote. For work: productivity tip. For personal: encouraging message.",
                required: true,
            },
        ],
        handler: async ({ title, dateTime, generatedTitle, generatedDescription }) => {
            try {
                log.debug("createReminder", { title, dateTime, generatedTitle, generatedDescription });

                // Parse the dateTime string to epoch ms
                const when = parseDateTimeToEpoch(dateTime as string);

                // Get current tab URL
                const [tab] = await chrome.tabs.query({
                    active: true,
                    currentWindow: true,
                });
                const url = tab?.url;

                const id = crypto.randomUUID();
                const reminder: Reminder = {
                    id,
                    title: title as string,
                    when,
                    url,
                    createdAt: Date.now(),
                    generatedTitle: (generatedTitle as string || '').substring(0, 50),
                    generatedDescription: (generatedDescription as string || '').substring(0, 100),
                };

                // Save reminder
                await saveReminder(reminder);

                // Schedule alarm
                await chrome.alarms.create(`reminder:${id}`, { when });

                log.info("Reminder created", { id, title, when });

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
                log.error("Failed to create reminder:", error);
                return {
                    error: "Failed to create reminder",
                    details: error instanceof Error ? error.message : String(error),
                };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return (
                    <ToolCard
                        title="Creating Reminder"
                        subtitle={`"${args.title}" at ${args.dateTime}`}
                        state="loading"
                        icon="⏰"
                    />
                );
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return (
                        <ToolCard
                            title="Failed to Create Reminder"
                            subtitle={result.details || result.error}
                            state="error"
                            icon="⏰"
                        />
                    );
                }
                return (
                    <ToolCard title="Reminder Set" state="success" icon="⏰">
                        <div style={{ fontSize: "13px" }}>
                            <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                                {result.generatedTitle || result.title}
                            </div>
                            <div style={{ marginBottom: "4px", fontSize: "12px" }}>
                                {result.generatedDescription}
                            </div>
                            <div style={{ opacity: 0.7, fontSize: "11px" }}>
                                {result.when}
                            </div>
                        </div>
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
