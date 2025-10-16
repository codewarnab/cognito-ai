import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { ToolCard } from "../../components/ui/ToolCard";
import { findReminder, deleteReminder } from "./storage";

const log = createLogger("Actions-Reminders-Cancel");

export function useCancelReminderAction() {
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
                const reminder = await findReminder(identifier as string);

                if (!reminder) {
                    return { error: "Reminder not found" };
                }

                // Cancel alarm
                await chrome.alarms.clear(`reminder:${reminder.id}`);

                // Remove from storage
                await deleteReminder(reminder.id);

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
