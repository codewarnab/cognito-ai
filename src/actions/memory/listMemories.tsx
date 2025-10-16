/**
 * List Memories Action
 */

import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { ToolCard } from "../../components/ui/ToolCard";
import * as memoryStore from "../../memory/store";
import { type MemoryCategory } from "../../memory/types";

const log = createLogger("Actions-Memory-List");

export function useListMemories() {
    useFrontendTool({
        name: "listMemories",
        description: "List all stored memories, optionally filtered by category ('fact' or 'behavior'). Use this when user asks to see their saved information or you need to review multiple memories.",
        parameters: [
            {
                name: "category",
                type: "string",
                description: "Optional filter: 'fact' or 'behavior'. Leave empty for all memories.",
                required: false,
            },
            {
                name: "limit",
                type: "number",
                description: "Maximum number of memories to return. Defaults to 20.",
                required: false,
            },
        ],
        handler: async ({ category, limit }) => {
            try {
                log.debug("Listing memories", { category, limit });

                const memories = await memoryStore.listMemories({
                    category: category as MemoryCategory | undefined,
                    limit: limit || 20,
                });

                return {
                    success: true,
                    count: memories.length,
                    memories: memories.map((m) => ({
                        id: m.id,
                        key: m.key,
                        value: m.value,
                        category: m.category,
                        source: m.source,
                        createdAt: new Date(m.createdAt).toLocaleString(),
                        pinned: m.pinned || false,
                    })),
                };
            } catch (error) {
                log.error("Failed to list memories", error);
                return { success: false, error: String(error) };
            }
        },
        render: ({ status, result, args }) => {
            if (status === "inProgress") {
                return <ToolCard title="Listing Memories" subtitle={args?.category ? `Category: ${args.category}` : "All categories"} state="loading" icon="📋" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Failed to List Memories" subtitle={result.error} state="error" icon="📋" />;
                }
                if (result.count === 0) {
                    return <ToolCard title="No Memories Found" subtitle="No memories saved yet" state="success" icon="📋" />;
                }
                return (
                    <ToolCard title={`Found ${result.count} ${result.count === 1 ? 'Memory' : 'Memories'}`} state="success" icon="📋">
                        <div style={{ fontSize: '13px', maxHeight: '300px', overflowY: 'auto' }}>
                            {result.memories.map((memory: any, idx: number) => (
                                <div key={memory.id} style={{
                                    marginBottom: '8px',
                                    paddingBottom: '8px',
                                    borderBottom: idx < result.memories.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none'
                                }}>
                                    <div style={{ fontWeight: 600 }}>
                                        {memory.pinned && '📌 '}
                                        {memory.key}
                                    </div>
                                    <div style={{ marginTop: '2px' }}>{String(memory.value)}</div>
                                    <div style={{ opacity: 0.6, fontSize: '11px', marginTop: '4px' }}>
                                        {memory.category} • {memory.source} • {memory.createdAt}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
