/**
 * Tool Renderer Component
 * Catches all MCP tool calls and renders them with McpToolCall component
 */

import { useCopilotAction } from "@copilotkit/react-core";
import type { CatchAllActionRenderProps } from "@copilotkit/react-core";
import McpToolCall from "./McpToolCall";

export function ToolRenderer() {
    useCopilotAction({
        /**
         * The asterisk (*) matches all tool calls from MCP servers
         */
        name: "*",
        description: "Catch-all action to visualize MCP tool calls",
        parameters: [],
        handler: async () => {
            // No-op handler - MCP tools are handled by the server
            // This is just for visualization
        },
        render: ({ name, status, args, result }: CatchAllActionRenderProps<[]>) => {
            // Map CopilotKit status to our component status
            const mappedStatus = status === "inProgress" ? "executing" : status;
            return (
                <McpToolCall
                    status={mappedStatus as "executing" | "complete" | "failed"}
                    name={name}
                    args={args}
                    result={result}
                />
            );
        },
    } as any);

    // This component doesn't render anything directly
    return null;
}
