import React from "react"

interface ServerNameInputProps {
  value: string
  onChange: (value: string) => void
}

export const ServerNameInput: React.FC<ServerNameInputProps> = ({ value, onChange }) => {
  return (
    <div>
      <label
        htmlFor="serverName"
        style={{
          display: "block",
          fontSize: "0.875rem",
          fontWeight: 500,
          marginBottom: "0.5rem",
          color: "var(--text-primary)"
        }}>
        Server Name *
      </label>
      <input
        id="serverName"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., My Custom Server"
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
