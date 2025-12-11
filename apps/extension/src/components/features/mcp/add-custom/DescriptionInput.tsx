import React from "react"

interface DescriptionInputProps {
  value: string
  onChange: (value: string) => void
  maxLength: number
}

export const DescriptionInput: React.FC<DescriptionInputProps> = ({ value, onChange, maxLength }) => {
  return (
    <div>
      <label
        htmlFor="description"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.875rem",
          fontWeight: 500,
          marginBottom: "0.5rem",
          color: "var(--text-primary)"
        }}>
        <span>Description</span>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 400,
            color:
              value.length > maxLength
                ? "rgb(239, 68, 68)"
                : "var(--text-secondary, rgba(255, 255, 255, 0.6))"
          }}>
          {value.length}/{maxLength}
        </span>
      </label>
      <textarea
        id="description"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Brief description of what this server does..."
        rows={3}
        maxLength={maxLength}
        style={{
          width: "100%",
          padding: "0.625rem 0.75rem",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          border: `1px solid ${value.length > maxLength ? "rgb(239, 68, 68)" : "rgba(255, 255, 255, 0.1)"}`,
          borderRadius: "6px",
          fontSize: "0.875rem",
          color: "var(--text-primary)",
          outline: "none",
          transition: "all 0.2s ease",
          resize: "none",
          fontFamily: "inherit"
        }}
        onFocus={(e) => {
          if (value.length <= maxLength) {
            e.target.style.borderColor = "rgba(59, 130, 246, 0.5)"
          }
          e.target.style.backgroundColor = "rgba(255, 255, 255, 0.08)"
        }}
        onBlur={(e) => {
          e.target.style.borderColor =
            value.length > maxLength
              ? "rgb(239, 68, 68)"
              : "rgba(255, 255, 255, 0.1)"
          e.target.style.backgroundColor = "rgba(255, 255, 255, 0.05)"
        }}
      />
    </div>
  )
}
