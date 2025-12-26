'use client';

import { useWebMcp } from '@/components/providers/WebMcpContext';
import FeaturesTool from './tools/FeaturesTool';
import TroubleshootingTool from './tools/TroubleshootingTool';
import NavigationTool from './tools/NavigationTool';

/**
 * WebMcpTools - Container for all WebMCP tools
 * 
 * This component aggregates all WebMCP tools and only renders them
 * when the WebMCP environment is initialized.
 */
export function WebMcpTools() {
    const { isInitialized } = useWebMcp();

    // Don't render tools until WebMCP is ready
    if (!isInitialized) {
        return null;
    }

    return (
        <>
            <FeaturesTool />
            <TroubleshootingTool />
            <NavigationTool />
        </>
    );
}
