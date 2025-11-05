import React, { useState, useId } from "react";
interface ReminderTimePickerProps {
    initialTitle: string;
    initialWhen: number; // epoch ms
    onConfirm: (title: string, when: number) => void;
    onCancel: () => void;
}

export function ReminderTimePicker({
    initialTitle,
    initialWhen,
    onConfirm,
    onCancel,
}: ReminderTimePickerProps) {
    const [title, setTitle] = useState(initialTitle);
    const [dateTime, setDateTime] = useState(() => {
        const d = new Date(initialWhen);
        // Format as YYYY-MM-DDTHH:mm for datetime-local input
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    });
    const [error, setError] = useState("");
    const datetimeInputId = useId();

    const handleConfirm = () => {
        // Validate title first
        if (!title.trim()) {
            setError("Title is required.");
            return;
        }

        const when = new Date(dateTime).getTime();
        const now = Date.now();
        if (isNaN(when) || when <= now) {
            setError("Please select a valid future date and time.");
            return;
        }

        setError("");
        onConfirm(title, when);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && e.ctrlKey) {
            handleConfirm();
        } else if (e.key === "Escape") {
            onCancel();
        }
    };

    return (
        <div
            style={{
                padding: "var(--spacing-md)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                marginTop: "var(--spacing-sm)",
                marginBottom: "var(--spacing-sm)",
            }}
            onKeyDown={handleKeyDown}
        >
            <div style={{ marginBottom: "var(--spacing-md)" }}>
                <div
                    style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        marginBottom: "var(--spacing-xs)",
                        color: "var(--color-text)",
                    }}
                >
                    Reminder Title
                </div>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What should I remind you about?"
                    style={{
                        width: "100%",
                        padding: "var(--spacing-sm)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "14px",
                        background: "var(--color-background)",
                        color: "var(--color-text)",
                        boxSizing: "border-box",
                    }}
                    autoFocus
                />
            </div>

            <div style={{ marginBottom: "var(--spacing-md)" }}>
                <label
                    htmlFor={datetimeInputId}
                    style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        marginBottom: "var(--spacing-xs)",
                        color: "var(--color-text)",
                        display: "block",
                    }}
                >
                    Date & Time
                </label>
                <input
                    id={datetimeInputId}
                    type="datetime-local"
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "var(--spacing-sm)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "14px",
                        background: "var(--color-background)",
                        color: "var(--color-text)",
                        boxSizing: "border-box",
                    }}
                />
            </div>

            {error && (
                <p
                    role="alert"
                    aria-live="polite"
                    style={{
                        color: "var(--color-error)",
                        marginTop: "var(--spacing-sm)",
                        marginBottom: "var(--spacing-sm)",
                        fontSize: "12px",
                    }}
                >
                    {error}
                </p>
            )}

            <div
                style={{
                    display: "flex",
                    gap: "var(--spacing-sm)",
                    justifyContent: "flex-end",
                }}
            >
                <button
                    type="button"
                    onClick={onCancel}
                    style={{
                        padding: "var(--spacing-sm) var(--spacing-md)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--color-background)",
                        color: "var(--color-text)",
                        fontSize: "14px",
                        cursor: "pointer",
                        fontWeight: 500,
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleConfirm}
                    type="button"
                    style={{
                        padding: "var(--spacing-sm) var(--spacing-md)",
                        border: "none",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--color-primary)",
                        color: "var(--eclipse-black)",
                        fontSize: "14px",
                        cursor: "pointer",
                        fontWeight: 600,
                    }}
                >
                    Confirm Reminder
                </button>
            </div>

            <div
                style={{
                    marginTop: "var(--spacing-sm)",
                    fontSize: "12px",
                    opacity: 0.6,
                    color: "var(--color-text)",
                }}
            >
                Tip: Press Ctrl+Enter to confirm, Escape to cancel
            </div>
        </div>
    );
}
