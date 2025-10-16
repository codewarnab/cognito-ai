/**
 * Get Memory Action
 */

import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { ToolCard } from "../../components/ui/ToolCard";
import * as memoryStore from "../../memory/store";
import { canonicalizeKey } from "../../memory/types";

const log = createLogger("Actions-Memory-Get");

export function useGetMemory() {
    useFrontendTool({
        name: "getMemory",
        description: "Retrieve a specific memory by its key. Use this when you need to recall a particular fact (e.g., user's name, email, preferences).",
        parameters: [
            {
                name: "key",
                type: "string",
                description: "The memory key to retrieve (will be auto-canonicalized)",
                required: true,
            },
        ],
        handler: async ({ key }) => {
            try {
                log.debug("Getting memory", { key });
                const canonKey = canonicalizeKey(key);
                const memory = await memoryStore.getMemoryByKey(canonKey);

                if (!memory) {
                    return { found: false, key: canonKey };
                }

                return {
                    found: true,
                    key: memory.key,
                    value: memory.value,
                    category: memory.category,
                    createdAt: new Date(memory.createdAt).toLocaleString(),
                };
            } catch (error) {
                log.error("Failed to get memory", error);
                return { found: false, error: String(error) };
            }
        },
        render: ({ status, result, args }) => {
            if (status === "inProgress") {
                return <ToolCard title="Retrieving Memory" subtitle={`Key: ${args?.key}`} state="loading" icon="🔍" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Failed to Get Memory" subtitle={result.error} state="error" icon="🔍" />;
                }
                if (!result.found) {
                    return <ToolCard title="Memory Not Found" subtitle={`No memory with key: ${args?.key}`} state="error" icon="🔍" />;
                }
                return (
                    <ToolCard title="Memory Retrieved" state="success" icon="🔍">
                        <div style={{ fontSize: '13px' }}>
                            <div><strong>{result.key}:</strong> {String(result.value)}</div>
                            <div style={{ opacity: 0.7, fontSize: '11px', marginTop: '4px' }}>
                                Category: {result.category} • Created: {result.createdAt}
                            </div>
                        </div>
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
