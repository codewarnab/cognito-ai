/**
 * Save Memory Action
 */

import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { ToolCard } from "../../components/ui/ToolCard";
import * as memoryStore from "../../memory/store";
import { createMemory, type MemoryCategory, type MemorySource } from "../../memory/types";

const log = createLogger("Actions-Memory-Save");

export function useSaveMemory() {
    useFrontendTool({
        name: "saveMemory",
        description: "Save information to memory after user consent. MUST ask user 'Do you want me to remember this?' before calling. Only save after user confirms. Categories: 'fact' (personal info like name, email, preferences) or 'behavior' (rules like 'never ask about X', 'always do Y').",
        parameters: [
            {
                name: "category",
                type: "string",
                description: "Memory category: 'fact' or 'behavior'",
                required: true,
            },
            {
                name: "key",
                type: "string",
                description: "Memory key (e.g., 'user.name', 'user.email', 'behavior.no-emails'). Will be auto-canonicalized.",
                required: true,
            },
            {
                name: "value",
                type: "string",
                description: "The value to store",
                required: true,
            },
            {
                name: "source",
                type: "string",
                description: "Source of memory: 'user', 'task', or 'system'. Defaults to 'user'.",
                required: false,
            },
        ],
        handler: async ({ category, key, value, source }) => {
            try {
                log.info("Saving memory", { category, key });

                const memory = createMemory(
                    key,
                    value,
                    category as MemoryCategory,
                    (source as MemorySource) || "user"
                );

                const saved = await memoryStore.saveMemory(memory);

                return {
                    success: true,
                    id: saved.id,
                    key: saved.key,
                    message: "Memory saved! You can ask me to list or delete memories anytime.",
                };
            } catch (error) {
                log.error("Failed to save memory", error);
                return { success: false, error: String(error) };
            }
        },
        render: ({ status, result, args }) => {
            if (status === "inProgress") {
                return <ToolCard title="Saving Memory" subtitle={`Key: ${args?.key}`} state="loading" icon="💾" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Failed to Save Memory" subtitle={result.error} state="error" icon="💾" />;
                }
                return (
                    <ToolCard title="Memory Saved" state="success" icon="💾">
                        <div style={{ fontSize: '13px' }}>
                            <div><strong>Key:</strong> {result.key}</div>
                            <div style={{ opacity: 0.7, fontSize: '12px', marginTop: '4px' }}>
                                {result.message}
                            </div>
                        </div>
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
