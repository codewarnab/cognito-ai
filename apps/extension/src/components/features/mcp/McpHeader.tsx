import React from "react"

interface McpHeaderProps {
    title: string
    onBack: () => void
}

export const McpHeader: React.FC<McpHeaderProps> = ({ title, onBack }) => {
    return (
        <div className="sticky top-0 left-0 right-0 z-50 flex items-center gap-3 px-5 py-4 border-b border-[var(--border-color,rgba(255,255,255,0.08))] bg-[#0a0e1a]/80 backdrop-blur-md">
            <button
                className="flex items-center justify-center w-8 h-8 p-0 bg-transparent border-none rounded-md text-[var(--text-tertiary,rgba(255,255,255,0.4))] cursor-pointer transition-all duration-200 hover:bg-[var(--bg-tertiary,#141f30)] hover:text-[var(--text-primary,#ffffff)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3b82f6] focus-visible:outline-offset-2"
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
            <h2 className="m-0 text-base font-semibold text-[var(--text-primary,#ffffff)]">{title}</h2>
        </div>
    )
}
