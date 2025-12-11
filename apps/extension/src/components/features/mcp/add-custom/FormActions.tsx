import React from "react"

interface FormActionsProps {
  onCancel: () => void
  isSubmitDisabled: boolean
}

export const FormActions: React.FC<FormActionsProps> = ({ onCancel, isSubmitDisabled }) => {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.75rem",
        marginTop: "0.5rem",
        paddingTop: "1rem",
        borderTop: "1px solid rgba(255, 255, 255, 0.1)"
      }}>
      <button
        type="button"
        onClick={onCancel}
        style={{
          flex: 1,
          padding: "0.625rem 1rem",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "6px",
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--text-primary)",
          cursor: "pointer",
          transition: "all 0.2s ease"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"
        }}>
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitDisabled}
        style={{
          flex: 1,
          padding: "0.625rem 1rem",
          backgroundColor: isSubmitDisabled ? "rgba(59, 130, 246, 0.5)" : "rgb(59, 130, 246)",
          border: "none",
          borderRadius: "6px",
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "#fff",
          cursor: isSubmitDisabled ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          opacity: isSubmitDisabled ? 0.6 : 1
        }}
        onMouseEnter={(e) => {
          if (!isSubmitDisabled) {
            e.currentTarget.style.backgroundColor = "rgb(37, 99, 235)"
          }
        }}
        onMouseLeave={(e) => {
          if (!isSubmitDisabled) {
            e.currentTarget.style.backgroundColor = "rgb(59, 130, 246)"
          }
        }}>
        Add Server
      </button>
    </div>
  )
}
