/**
 * Register Meta-Tools for Adaptive Mode
 * 
 * This hook registers the discoverTools and executeTools meta-tools
 * that enable on-demand tool discovery and orchestrated execution.
 */

import { useEffect } from 'react';
import { registerTool } from '@/ai/tools';
import { useToolUI } from '@/ai/tools/components';
import { CompactToolRenderer } from '@/ai/tools/components';
import type { ToolUIState } from '@/ai/tools/components';
import { discoverTools, executeTools } from '@/ai/tools/meta';
import { createLogger } from '~logger';

const log = createLogger('MetaTools');

/**
 * Hook to register the meta-tools for Adaptive mode
 */
export function useMetaTools() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering meta-tools for Adaptive mode...');

        // Register discoverTools
        registerTool({
            name: 'discoverTools',
            description: discoverTools.description,
            inputSchema: discoverTools.inputSchema,
            execute: discoverTools.execute,
        });

        registerToolUI('discoverTools', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        // Register executeTools
        registerTool({
            name: 'executeTools',
            description: executeTools.description,
            inputSchema: executeTools.inputSchema,
            execute: executeTools.execute,
        });

        registerToolUI('executeTools', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ Meta-tools registration complete');

        return () => {
            log.info('🧹 Cleaning up meta-tools');
            unregisterToolUI('discoverTools');
            unregisterToolUI('executeTools');
        };
    }, [registerToolUI, unregisterToolUI]);
}
