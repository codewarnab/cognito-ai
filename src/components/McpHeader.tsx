import React from "react"

interface McpHeaderProps {
    title: string
    onBack: () => void
}

export const McpHeader: React.FC<McpHeaderProps> = ({ title, onBack }) => {
    return (
        <div className="mcp-header">
            <button
                className="mcp-header__back-btn"
                onClick={onBack}
                aria-label="Back to chat"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M12.5 15L7.5 10L12.5 5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </button>
            <h2 className="mcp-header__title">{title}</h2>
        </div>
    )
}
