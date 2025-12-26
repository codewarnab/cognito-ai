'use client';

import { useEffect } from 'react';
import { useWebMCP } from '@mcp-b/react-webmcp';
import { z } from 'zod';
import { useToolRegistry } from '../ToolRegistry';
import { useRouter } from 'next/navigation';

const TOOL_NAME = 'navigate_to_page';
const TOOL_DESCRIPTION = 'Navigate to a page in the Cognito webapp. Available pages: settings, providers, features, troubleshooting, onboarding, reminders, changelog.';

// Valid paths for navigation
const VALID_PATHS = [
    '/settings',
    '/providers',
    '/features',
    '/troubleshooting',
    '/onboarding',
    '/reminders',
    '/changelog',
    '/',
] as const;

/**
 * NavigationTool - WebMCP tool for navigating the webapp
 * 
 * This headless component registers a tool that allows AI agents
 * to navigate users to different pages in the webapp.
 */
export default function NavigationTool() {
    const router = useRouter();
    const { registerTool, recordToolCall, recordToolError } = useToolRegistry();

    // Register with internal registry for diagnostics
    useEffect(() => {
        registerTool({ name: TOOL_NAME, description: TOOL_DESCRIPTION });
    }, [registerTool]);

    // Register with WebMCP
    useWebMCP({
        name: TOOL_NAME,
        description: TOOL_DESCRIPTION,
        inputSchema: {
            path: z.string().describe('The page path to navigate to. Valid paths: /settings, /providers, /features, /troubleshooting, /onboarding, /reminders, /changelog, /'),
        },
        handler: async ({ path }) => {
            try {
                recordToolCall(TOOL_NAME);

                const normalizedPath = path.startsWith('/') ? path : `/${path}`;

                // Validate the path
                if (!VALID_PATHS.includes(normalizedPath as typeof VALID_PATHS[number])) {
                    return {
                        success: false,
                        error: `Invalid path: ${normalizedPath}. Valid paths are: ${VALID_PATHS.join(', ')}`,
                        validPaths: VALID_PATHS,
                    };
                }

                // Navigate to the page
                router.push(normalizedPath);

                return {
                    success: true,
                    navigatedTo: normalizedPath,
                    message: `Successfully navigated to ${normalizedPath}`,
                };
            } catch (error) {
                const err = error instanceof Error ? error : new Error('Navigation failed');
                recordToolError(TOOL_NAME, err);
                return {
                    success: false,
                    error: err.message,
                };
            }
        },
    });

    return null; // Headless component
}
