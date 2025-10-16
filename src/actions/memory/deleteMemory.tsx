/**
 * Delete Memory Action
 */

import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { ToolCard } from "../../components/ui/ToolCard";
import * as memoryStore from "../../memory/store";
import { canonicalizeKey } from "../../memory/types";

const log = createLogger("Actions-Memory-Delete");

export function useDeleteMemory() {
    useFrontendTool({
        name: "deleteMemory",
        description: "Delete a memory by its key. Use when user asks to forget something or remove a saved memory.",
        parameters: [
            {
                name: "key",
                type: "string",
                description: "The memory key to delete (will be auto-canonicalized)",
                required: true,
            },
        ],
        handler: async ({ key }) => {
            try {
                log.info("Deleting memory", { key });
                const canonKey = canonicalizeKey(key);
                const deleted = await memoryStore.deleteMemoryByKey(canonKey);

                if (!deleted) {
                    return { success: false, message: `No memory found with key: ${canonKey}` };
                }

                return { success: true, key: canonKey, message: "Memory deleted successfully." };
            } catch (error) {
                log.error("Failed to delete memory", error);
                return { success: false, error: String(error) };
            }
        },
        render: ({ status, result, args }) => {
            if (status === "inProgress") {
                return <ToolCard title="Deleting Memory" subtitle={`Key: ${args?.key}`} state="loading" icon="🗑️" />;
            }
            if (status === "complete" && result) {
                if (result.error || !result.success) {
                    return <ToolCard title="Failed to Delete Memory" subtitle={result.error || result.message} state="error" icon="🗑️" />;
                }
                return (
                    <ToolCard title="Memory Deleted" state="success" icon="🗑️">
                        <div style={{ fontSize: '13px' }}>
                            <div>Removed: <strong>{result.key}</strong></div>
                        </div>
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
