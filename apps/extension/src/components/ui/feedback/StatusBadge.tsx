import React from "react"

interface StatusBadgeProps {
    state: "authenticated" | "not-authenticated"
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ state }) => {
    const isAuthenticated = state === "authenticated"

    return (
        <span
            className={`status-badge ${isAuthenticated ? "status-badge--authenticated" : "status-badge--not-authenticated"}`}
            role="status"
            aria-label={isAuthenticated ? "Authenticated" : "Not Authenticated"}
        >
            {isAuthenticated ? "Authenticated" : "Not Authenticated"}
        </span>
    )
}
