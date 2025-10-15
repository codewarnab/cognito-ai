import React, { useState, useMemo } from "react"
import { McpHeader } from "./McpHeader"
import { McpServerCard } from "./McpServerCard"
import { MCP_SERVERS } from "../constants/mcpServers"

interface McpManagerProps {
    onBack: () => void
}

export const McpManager: React.FC<McpManagerProps> = ({ onBack }) => {
    const [searchQuery, setSearchQuery] = useState("")

    // Filter servers based on search query
    const filteredServers = useMemo(() => {
        if (!searchQuery.trim()) {
            return MCP_SERVERS
        }

        const query = searchQuery.toLowerCase()
        return MCP_SERVERS.filter(server =>
            server.name.toLowerCase().includes(query) ||
            server.id.toLowerCase().includes(query)
        )
    }, [searchQuery])

    return (
        <div className="mcp-panel">
            <McpHeader title="MCP Server Management" onBack={onBack} />

            {/* Search Bar */}
            <div className="mcp-search-container">
                <div className="mcp-search-wrapper">
                    <svg
                        className="mcp-search-icon"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        className="mcp-search-input"
                        placeholder="Search MCP servers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Search MCP servers"
                    />
                    {searchQuery && (
                        <button
                            className="mcp-search-clear"
                            onClick={() => setSearchQuery("")}
                            aria-label="Clear search"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="mcp-content">
                {filteredServers.length > 0 ? (
                    <ul className="mcp-list" role="list">
                        {filteredServers.map((server) => (
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
                ) : (
                    <div className="mcp-no-results">
                        <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        <p className="mcp-no-results-text">No servers found</p>
                        <p className="mcp-no-results-subtext">
                            Try searching for a different server name
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
