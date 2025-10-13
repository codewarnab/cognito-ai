/**
 * MCP Tool Call Visualization Component
 * Displays MCP tool calls with icons, status, arguments, and results
 */

import { Notion } from "../../assets/notion";
import { Figma } from "../../assets/figma";
import { GitHub } from "../../assets/github";
import { Linear } from "../../assets/linear";
import { Supabase } from "../../assets/supabase";

interface McpToolCallProps {
    name: string;
    status: "executing" | "complete" | "failed";
    args?: Record<string, any>;
    result?: any;
}

// Map tool names to their corresponding icons
const getToolIcon = (toolName: string) => {
    const name = toolName.toLowerCase();

    if (name.includes("notion")) return Notion;
    if (name.includes("figma")) return Figma;
    if (name.includes("github") || name.includes("git")) return GitHub;
    if (name.includes("linear")) return Linear;
    if (name.includes("supabase")) return Supabase;

    // Default icon (generic tool)
    return null;
};

const getStatusColor = (status: string) => {
    switch (status) {
        case "executing":
            return "bg-blue-500";
        case "complete":
            return "bg-green-500";
        case "failed":
            return "bg-red-500";
        default:
            return "bg-gray-500";
    }
};

const getStatusText = (status: string) => {
    switch (status) {
        case "executing":
            return "Running...";
        case "complete":
            return "Complete";
        case "failed":
            return "Failed";
        default:
            return status;
    }
};

function McpToolCall({ name, status, args, result }: McpToolCallProps) {
    const Icon = getToolIcon(name);
    const statusColor = getStatusColor(status);
    const statusText = getStatusText(status);

    return (
        <div className="mcp-tool-call">
            <div className="mcp-tool-header">
                <div className="mcp-tool-info">
                    {Icon && (
                        <div className="mcp-tool-icon">
                            <Icon width={20} height={20} />
                        </div>
                    )}
                    <span className="mcp-tool-name">{name}</span>
                </div>
                <div className={`mcp-tool-status ${statusColor}`}>
                    {status === "executing" && (
                        <div className="mcp-loading-spinner" />
                    )}
                    <span>{statusText}</span>
                </div>
            </div>

            {args && Object.keys(args).length > 0 && (
                <details className="mcp-tool-section" open={status === "executing"}>
                    <summary className="mcp-tool-section-title">Arguments</summary>
                    <pre className="mcp-tool-content">
                        {JSON.stringify(args, null, 2)}
                    </pre>
                </details>
            )}

            {result && status === "complete" && (
                <details className="mcp-tool-section" open>
                    <summary className="mcp-tool-section-title">Result</summary>
                    <pre className="mcp-tool-content">
                        {typeof result === "string"
                            ? result
                            : JSON.stringify(result, null, 2)}
                    </pre>
                </details>
            )}

            {status === "failed" && result && (
                <div className="mcp-tool-error">
                    <span className="mcp-tool-error-title">Error:</span>
                    <pre className="mcp-tool-content">
                        {typeof result === "string"
                            ? result
                            : JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

export default McpToolCall;
