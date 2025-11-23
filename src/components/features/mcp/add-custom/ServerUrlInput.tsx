import React, { useState } from "react"
import { Info } from "lucide-react"

interface ServerUrlInputProps {
  value: string
  onChange: (value: string) => void
}

export const ServerUrlInput: React.FC<ServerUrlInputProps> = ({ value, onChange }) => {
  const [showUrlInfo, setShowUrlInfo] = useState(false)

  return (
    <div>
      <label
        htmlFor="serverUrl"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.875rem",
          fontWeight: 500,
          marginBottom: "0.5rem",
          color: "var(--text-primary)"
        }}>
        Server URL *
        <div
          style={{ position: "relative", display: "inline-flex" }}
          onMouseEnter={() => setShowUrlInfo(true)}
          onMouseLeave={() => setShowUrlInfo(false)}>
          <Info size={14} style={{ cursor: "help", color: "var(--text-secondary)" }} />
          {showUrlInfo && (
            <div
              style={{
                position: "absolute",
                left: "20px",
                top: "-8px",
                backgroundColor: "rgba(0, 0, 0, 0.95)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "6px",
                padding: "0.75rem",
                fontSize: "0.75rem",
                color: "var(--text-primary)",
                width: "280px",
                zIndex: 1000,
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
              }}>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Examples:</div>
              <div style={{ fontFamily: "monospace", fontSize: "0.7rem", lineHeight: "1.6" }}>
                https://api.example.com/mcp
                <br />
                https://mcp.example.com/sse
              </div>
            </div>
          )}
        </div>
      </label>
      <input
        id="serverUrl"
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://api.example.com/mcp"
        required
        style={{
          width: "100%",
          padding: "0.625rem 0.75rem",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "6px",
          fontSize: "0.875rem",
          color: "var(--text-primary)",
          outline: "none",
          transition: "all 0.2s ease"
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "rgba(59, 130, 246, 0.5)"
          e.target.style.backgroundColor = "rgba(255, 255, 255, 0.08)"
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "rgba(255, 255, 255, 0.1)"
          e.target.style.backgroundColor = "rgba(255, 255, 255, 0.05)"
        }}
      />
    </div>
  )
}
