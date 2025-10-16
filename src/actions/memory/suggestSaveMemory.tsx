/**
 * Suggest Save Memory Action
 */

import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { ToolCard } from "../../components/ui/ToolCard";
import { canonicalizeKey } from "../../memory/types";

const log = createLogger("Actions-Memory-Suggest");

export function useSuggestSaveMemory() {
    useFrontendTool({
        name: "suggestSaveMemory",
        description: "Suggest saving information to memory. Use this AFTER completing tasks when you've discovered useful info (credentials, preferences, emails, etc.). ALWAYS ask user 'Do you want me to remember this?' and wait for consent before calling saveMemory.",
        parameters: [
            {
                name: "key",
                type: "string",
                description: "Suggested memory key (e.g., 'user.email', 'api.token')",
                required: true,
            },
            {
                name: "value",
                type: "string",
                description: "The value to potentially save",
                required: true,
            },
            {
                name: "category",
                type: "string",
                description: "Suggested category: 'fact' or 'behavior'",
                required: true,
            },
            {
                name: "reason",
                type: "string",
                description: "Brief explanation of why this should be saved",
                required: false,
            },
        ],
        handler: async ({ key, value, category, reason }) => {
            log.debug("Suggesting memory save", { key, category });
            // This tool just returns a suggestion; actual saving requires user consent
            return {
                suggested: true,
                key: canonicalizeKey(key),
                value,
                category,
                reason: reason || "This might be useful to remember.",
                message: "Ask the user if they want to save this memory before calling saveMemory.",
            };
        },
        render: ({ status, result, args }) => {
            if (status === "inProgress") {
                return <ToolCard title="Suggesting Memory" state="loading" icon="💡" />;
            }
            if (status === "complete" && result) {
                return (
                    <ToolCard title="Memory Suggestion" state="success" icon="💡">
                        <div style={{ fontSize: '13px' }}>
                            <div><strong>{result.key}:</strong> {String(result.value)}</div>
                            <div style={{ opacity: 0.7, fontSize: '11px', marginTop: '4px' }}>
                                {result.reason}
                            </div>
                            <div style={{
                                marginTop: '8px',
                                padding: '6px',
                                background: 'rgba(198, 254, 30, 0.1)',
                                borderRadius: '4px',
                                fontSize: '12px'
                            }}>
                                ℹ️ Awaiting user consent to save
                            </div>
                        </div>
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
