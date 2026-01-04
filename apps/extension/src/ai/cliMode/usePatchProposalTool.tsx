/**
 * Hook to register the propose_patch tool UI
 * This renders patch proposals from the code bridge
 */

import { useEffect } from 'react';
import { useToolUI } from '@/ai/tools/components';
import { PatchProposalCard } from '@/components/features/codeMode';
import type { ToolUIState } from '@/ai/tools/components/ToolUIContext';

export function usePatchProposalTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        registerToolUI('propose_patch', (state: ToolUIState) => {
            const { input } = state;

            if (!input?.patchId || !input?.unifiedDiff) {
                return null;
            }

            return (
                <PatchProposalCard
                    patchId={input.patchId}
                    unifiedDiff={input.unifiedDiff}
                    summary={input.summary}
                />
            );
        });

        return () => {
            unregisterToolUI('propose_patch');
        };
    }, [registerToolUI, unregisterToolUI]);
}
