import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { ToolCard } from "../../components/ui/ToolCard";
import { getActiveReminders } from "./storage";

const log = createLogger("Actions-Reminders-List");

export function useListRemindersAction() {
    useFrontendTool({
        name: "listReminders",
        description: "List all active reminders that are scheduled",
        parameters: [],
        handler: async () => {
            try {
                const activeReminders = await getActiveReminders();

                const formattedReminders = activeReminders.map((r) => ({
                    id: r.id,
                    title: r.title,
                    when: new Date(r.when).toLocaleString(),
                    url: r.url,
                }));

                return {
                    count: formattedReminders.length,
                    reminders: formattedReminders,
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
}
