'use client';

import { useEffect } from 'react';
import { useWebMCP } from '@mcp-b/react-webmcp';
import { z } from 'zod';
import { useToolRegistry } from '../ToolRegistry';
import { troubleshootingData } from '@/lib/troubleshootingData';

const TOOL_NAME = 'troubleshoot';
const TOOL_DESCRIPTION = 'Search for troubleshooting solutions to common Cognito AI issues. Returns causes and step-by-step solutions.';

/**
 * TroubleshootingTool - WebMCP tool for finding solutions to issues
 * 
 * This headless component registers a tool that searches the troubleshooting
 * database and returns relevant causes and solutions.
 */
export default function TroubleshootingTool() {
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
            query: z.string().optional().describe('Search query to find relevant troubleshooting guides (e.g., "voice mode", "MCP tools", "lagging")'),
            listAll: z.boolean().optional().describe('If true, returns all troubleshooting items without filtering'),
        },
        handler: async ({ query, listAll }) => {
            try {
                recordToolCall(TOOL_NAME);

                let results = troubleshootingData;

                // Filter by search query if provided and not listing all
                if (query && !listAll) {
                    const searchTerm = query.toLowerCase();
                    results = troubleshootingData.filter(item =>
                        item.issue.toLowerCase().includes(searchTerm) ||
                        item.causes.some(cause => cause.toLowerCase().includes(searchTerm)) ||
                        item.solutions.some(solution => solution.toLowerCase().includes(searchTerm))
                    );
                }

                return {
                    success: true,
                    results: results.map(item => ({
                        id: item.id,
                        issue: item.issue,
                        causes: item.causes,
                        solutions: item.solutions,
                    })),
                    totalResults: results.length,
                    hint: results.length === 0 
                        ? 'No matching issues found. Try a different search term or use listAll: true to see all issues.'
                        : 'Present these solutions to the user to help them resolve their issue.',
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
