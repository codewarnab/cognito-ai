import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../logger";
import { ReminderTimePicker } from "../components/ReminderTimePicker";
import { ToolCard } from "../components/ui/ToolCard";

const log = createLogger("Actions-Reminders");

interface Reminder {
    id: string;
    title: string;
    when: number; // epoch ms
    url?: string;
    createdAt: number;
    generatedTitle?: string;
    generatedDescription?: string;
}

// Store pending confirmation state
let pendingConfirmation: {
    title: string;
    when: number;
    resolve: (value: { title: string; when: number } | null) => void;
} | null = null;

export function registerReminderActions() {

    // Main action to create a reminder
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

                // Store reminder
                const { reminders = {} } = await chrome.storage.local.get("reminders");
                reminders[id] = reminder;
                await chrome.storage.local.set({ reminders });

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

    // List active reminders
    useFrontendTool({
        name: "listReminders",
        description: "List all active reminders that are scheduled",
        parameters: [],
        handler: async () => {
            try {
                const { reminders = {} } = await chrome.storage.local.get("reminders");
                const reminderList = Object.values(reminders) as Reminder[];
                const now = Date.now();

                // Filter out past reminders
                const activeReminders = reminderList
                    .filter((r) => r.when > now)
                    .sort((a, b) => a.when - b.when)
                    .map((r) => ({
                        id: r.id,
                        title: r.title,
                        when: new Date(r.when).toLocaleString(),
                        url: r.url,
                    }));

                return {
                    count: activeReminders.length,
                    reminders: activeReminders,
                };
            } catch (error) {
                log.error("Failed to list reminders:", error);
                return { error: "Failed to list reminders" };
            }
        },
        render: ({ status, result }) => {
            if (status === "inProgress") {
                return (
                    <ToolCard title="Loading Reminders" state="loading" icon="📋" />
                );
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return (
                        <ToolCard
                            title="Failed to Load Reminders"
                            subtitle={result.error}
                            state="error"
                            icon="📋"
                        />
                    );
                }
                return (
                    <ToolCard
                        title={`Active Reminders (${result.count})`}
                        state="success"
                        icon="📋"
                    >
                        {result.count === 0 ? (
                            <div style={{ fontSize: "13px", opacity: 0.7 }}>
                                No active reminders
                            </div>
                        ) : (
                            <div style={{ fontSize: "13px" }}>
                                {result.reminders.map((r: any) => (
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
            return null;
        },
    });

    // Cancel a reminder
    useFrontendTool({
        name: "cancelReminder",
        description: "Cancel an existing reminder by its title or ID",
        parameters: [
            {
                name: "identifier",
                type: "string",
                description: "Reminder title or ID to cancel",
                required: true,
            },
        ],
        handler: async ({ identifier }) => {
            try {
                const { reminders = {} } = await chrome.storage.local.get("reminders");
                const reminderList = Object.values(reminders) as Reminder[];

                // Find reminder by ID or title
                const reminder = reminderList.find(
                    (r) =>
                        r.id === identifier ||
                        r.title.toLowerCase().includes((identifier as string).toLowerCase())
                );

                if (!reminder) {
                    return { error: "Reminder not found" };
                }

                // Cancel alarm
                await chrome.alarms.clear(`reminder:${reminder.id}`);

                // Remove from storage
                delete reminders[reminder.id];
                await chrome.storage.local.set({ reminders });

                return {
                    success: true,
                    title: reminder.title,
                    message: `Reminder "${reminder.title}" cancelled`,
                };
            } catch (error) {
                log.error("Failed to cancel reminder:", error);
                return { error: "Failed to cancel reminder" };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return (
                    <ToolCard
                        title="Cancelling Reminder"
                        subtitle={args.identifier}
                        state="loading"
                        icon="🗑️"
                    />
                );
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return (
                        <ToolCard
                            title="Failed to Cancel"
                            subtitle={result.error}
                            state="error"
                            icon="🗑️"
                        />
                    );
                }
                return (
                    <ToolCard
                        title="Reminder Cancelled"
                        subtitle={result.title}
                        state="success"
                        icon="🗑️"
                    />
                );
            }
            return null;
        },
    });
}

// Helper function to parse natural language date/time
function parseDateTimeToEpoch(dateTimeStr: string): number {
    const now = new Date();
    const str = dateTimeStr.toLowerCase().trim();

    // Handle "tomorrow" cases
    if (str.includes("tomorrow")) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Check if a time is specified
        const timeMatch = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10);
            const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            const meridiem = timeMatch[3]?.toLowerCase();

            if (meridiem === "pm" && hours < 12) hours += 12;
            if (meridiem === "am" && hours === 12) hours = 0;

            tomorrow.setHours(hours, minutes, 0, 0);
        } else {
            // Default to 9:00 AM
            tomorrow.setHours(9, 0, 0, 0);
        }

        return tomorrow.getTime();
    }

    // Handle "in X hours/minutes/days"
    const inMatch = str.match(/in\s+(\d+)\s+(minute|hour|day)s?/i);
    if (inMatch) {
        const amount = parseInt(inMatch[1], 10);
        const unit = inMatch[2].toLowerCase();
        const future = new Date(now);

        switch (unit) {
            case "minute":
                future.setMinutes(future.getMinutes() + amount);
                break;
            case "hour":
                future.setHours(future.getHours() + amount);
                break;
            case "day":
                future.setDate(future.getDate() + amount);
                break;
        }

        return future.getTime();
    }

    // Handle "next Monday/Tuesday/etc"
    const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
    ];
    const nextDayMatch = str.match(/next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
    if (nextDayMatch) {
        const targetDay = dayNames.indexOf(nextDayMatch[1].toLowerCase());
        const currentDay = now.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;

        const nextDate = new Date(now);
        nextDate.setDate(nextDate.getDate() + daysToAdd);
        nextDate.setHours(9, 0, 0, 0); // Default to 9 AM

        return nextDate.getTime();
    }

    // Try to parse as a date string
    try {
        const parsed = new Date(dateTimeStr);
        if (!isNaN(parsed.getTime()) && parsed.getTime() > now.getTime()) {
            return parsed.getTime();
        }
    } catch (e) {
        // Fall through
    }

    // Default: tomorrow at 9 AM
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.getTime();
}
