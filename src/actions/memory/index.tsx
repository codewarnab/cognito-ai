/**
 * Memory Actions
 * CopilotKit frontend tools for memory management
 */

import { createLogger } from '~logger';
import { useSaveMemory } from "./saveMemory";
import { useGetMemory } from "./getMemory";
import { useListMemories } from "./listMemories";
import { useDeleteMemory } from "./deleteMemory";

const log = createLogger("Actions-Memory");

export function registerMemoryActions() {
    useSaveMemory();
    useGetMemory();
    useListMemories();
    useDeleteMemory();

    log.debug("Memory actions registered");
}

// Re-export individual hooks for potential direct usage
export {
    useSaveMemory,
    useGetMemory,
    useListMemories,
    useDeleteMemory,
};


