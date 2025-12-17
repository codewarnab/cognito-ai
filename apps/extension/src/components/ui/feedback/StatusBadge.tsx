import React from "react"

interface StatusBadgeProps {
    state: "authenticated" | "not-authenticated"
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ state }) => {
    const isAuthenticated = state === "authenticated"

    return (
        <span
            className={`inline-flex items-center self-start px-2.5 py-1 text-[11px] font-medium rounded-full ${
                isAuthenticated 
                    ? "bg-emerald-500/15 text-emerald-400" 
                    : "bg-[#1e293b]/80 text-white/50"
            }`}
            role="status"
            aria-label={isAuthenticated ? "Authenticated" : "Not Authenticated"}
        >
            {isAuthenticated ? "Authenticated" : "Not Authenticated"}
        </span>
    )
}
