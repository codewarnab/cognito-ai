import React, { useState } from "react"

export const InfoBanner: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      style={{
        padding: "0.625rem 0.75rem",
        marginBottom: "1rem",
        backgroundColor: "rgba(59, 130, 246, 0.08)",
        border: "1px solid rgba(59, 130, 246, 0.25)",
        borderRadius: "6px",
        fontSize: "0.8125rem",
        color: "var(--text-primary)",
        cursor: "pointer",
        transition: "all 0.2s ease"
      }}
      onClick={() => setIsExpanded(!isExpanded)}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.12)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.08)"
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "rgb(59, 130, 246)", flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div style={{ flex: 1 }}>
          Remote MCP servers only {isExpanded ? "" : "(click for details)"}
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            color: "rgb(59, 130, 246)",
            flexShrink: 0,
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease"
          }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {isExpanded && (
        <div style={{ marginTop: "0.5rem", paddingLeft: "1.5rem", fontSize: "0.75rem", color: "var(--text-secondary, rgba(255, 255, 255, 0.7))" }}>
          We currently support remote MCP servers only. STDIO MCP server support coming soon.
        </div>
      )}
    </div>
  )
}
