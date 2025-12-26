'use client';

import { useEffect } from 'react';
import { useWebMCP } from '@mcp-b/react-webmcp';
import { z } from 'zod';
import { useToolRegistry } from '../ToolRegistry';
import { examplePrompts } from '@/lib/featuresData';

const TOOL_NAME = 'get_features';
const TOOL_DESCRIPTION = 'Get a list of Cognito AI features and example prompts. Returns categorized features with sample prompts the user can try.';

/**
 * FeaturesTool - WebMCP tool for retrieving features and example prompts
 * 
 * This headless component registers a tool that returns the app's feature
 * categories and example prompts that users can try.
 */
export default function FeaturesTool() {
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
            category: z.string().optional().describe('Optional: Filter by category ID (automation, research, youtube, memory, productivity, content, shopping)'),
        },
        handler: async ({ category }) => {
            try {
                recordToolCall(TOOL_NAME);

                let features = examplePrompts;

                // Filter by category if provided
                if (category) {
                    features = examplePrompts.filter(
                        f => f.id.toLowerCase() === category.toLowerCase()
                    );
                }

                // Transform to plain objects (remove icon which is a React component)
                const result = features.map(f => ({
                    id: f.id,
                    category: f.category,
                    prompts: f.prompts,
                }));

                return {
                    success: true,
                    features: result,
                    totalCategories: result.length,
                    hint: 'Suggest these example prompts to the user to help them explore Cognito features.',
                };
            } catch (error) {
                const err = error instanceof Error ? error : new Error('Unknown error');
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
