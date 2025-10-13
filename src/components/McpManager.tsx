import React from "react"
import { McpHeader } from "./McpHeader"
import { McpServerCard } from "./McpServerCard"
import { Notion } from "../../assets/notion"
import { Supabase } from "../../assets/supabase"
import { GitHub } from "../../assets/github"

interface McpManagerProps {
    onBack: () => void
}

interface ServerConfig {
    id: string
    name: string
    icon: React.ReactNode
    initialEnabled?: boolean
    initialAuthenticated?: boolean
}

const servers: ServerConfig[] = [
    {
        id: "notion",
        name: "Notion",
        icon: <Notion />,
        initialEnabled: false,
        initialAuthenticated: false
    },
    {
        id: "supabase",
        name: "Supabase",
        icon: <Supabase />,
        initialEnabled: false,
        initialAuthenticated: false
    },
    {
        id: "github",
        name: "GitHub",
        icon: <GitHub />,
        initialEnabled: false,
        initialAuthenticated: false
    }
]

export const McpManager: React.FC<McpManagerProps> = ({ onBack }) => {
    return (
        <div className="mcp-panel">
            <McpHeader title="MCP Server Management" onBack={onBack} />
            <div className="mcp-content">
                <ul className="mcp-list" role="list">
                    {servers.map((server) => (
                        <li key={server.id}>
                            <McpServerCard
                                id={server.id}
                                name={server.name}
                                icon={server.icon}
                                initialEnabled={server.initialEnabled}
                                initialAuthenticated={server.initialAuthenticated}
                            />
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
