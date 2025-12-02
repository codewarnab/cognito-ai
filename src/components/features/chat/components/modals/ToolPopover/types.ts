import type { ToolsMode } from '@/types/settings';
import type { McpTool } from '@/mcp/types';

export type ToolMode = ToolsMode;

export interface McpToolWithServer extends McpTool {
    serverId: string;
    serverName: string;
}

export interface ToolsPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    onCountChange?: (extensionCount: number, mcpCount: number) => void;
}

export interface ToolCategoryProps {
    category: string;
    tools: string[];
    enabledMap: Record<string, boolean>;
    isExpanded: boolean;
    supermemoryConfigured: boolean;
    showSupermemoryTooltip: string | null;
    searchQuery?: string;
    onToggleCategory: (category: string) => void;
    onToggleTool: (tool: string, checked: boolean) => void;
    onToggleCategoryAll: (e: React.MouseEvent, category: string, tools: string[]) => void;
    onSetSupermemoryTooltip: (tool: string | null) => void;
}

export interface McpCategoryProps {
    serverId: string;
    serverName: string;
    tools: McpToolWithServer[];
    disabledTools: string[];
    isExpanded: boolean;
    searchQuery?: string;
    onToggleCategory: (category: string) => void;
    onToggleTool: (serverId: string, toolName: string, checked: boolean) => void;
    onToggleCategoryAll: (e: React.MouseEvent, serverId: string, tools: McpToolWithServer[]) => void;
}

export interface WebMcpTool {
    name: string;
    originalName: string;
    description?: string;
    domain?: string;
    favicon?: string;
}

export interface WebMcpSectionProps {
    tools: WebMcpTool[];
    disabledTools: string[];
    isLoading: boolean;
    enabledCount: number;
    isExpanded: boolean;
    searchQuery?: string;
    onToggleCategory: (category: string) => void;
    onToggleTool: (toolName: string, checked: boolean) => void;
    onToggleCategoryAll: (e: React.MouseEvent) => void;
}
