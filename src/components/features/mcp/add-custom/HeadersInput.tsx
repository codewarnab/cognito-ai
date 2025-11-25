import React, { useState } from "react"
import { Info, Plus, Trash2, Eye, EyeOff } from "lucide-react"

export interface KeyValuePair {
    key: string
    value: string
}

interface HeadersInputProps {
    headers: KeyValuePair[]
    onChange: (headers: KeyValuePair[]) => void
    disabled?: boolean
}

// Check if a key name might contain sensitive information
const isSensitiveKey = (key: string): boolean => {
    const sensitivePatterns = [
        /key/i,
        /token/i,
        /secret/i,
        /password/i,
        /pass/i,
        /auth/i,
        /credential/i,
        /bearer/i,
    ]
    return sensitivePatterns.some((pattern) => pattern.test(key))
}

// Mask a sensitive value
const maskValue = (value: string): string => {
    if (!value) return ""
    if (value.length < 8) return "••••••"
    return (
        value.substring(0, 3) +
        "•".repeat(Math.min(10, value.length - 4)) +
        value.substring(value.length - 1)
    )
}

export const HeadersInput: React.FC<HeadersInputProps> = ({
    headers,
    onChange,
    disabled = false,
}) => {
    const [newHeader, setNewHeader] = useState<KeyValuePair>({ key: "", value: "" })
    const [showValues, setShowValues] = useState<Record<number, boolean>>({})
    const [showInfo, setShowInfo] = useState(false)

    const addHeader = () => {
        if (!newHeader.key.trim()) return
        onChange([...headers, { key: newHeader.key.trim(), value: newHeader.value }])
        setNewHeader({ key: "", value: "" })
    }

    const removeHeader = (index: number) => {
        const updated = headers.filter((_, i) => i !== index)
        onChange(updated)
        // Clean up showValues state
        const newShowValues = { ...showValues }
        delete newShowValues[index]
        setShowValues(newShowValues)
    }

    const toggleShowValue = (index: number) => {
        setShowValues((prev) => ({
            ...prev,
            [index]: !prev[index],
        }))
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            addHeader()
        }
    }

    return (
        <div style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    marginBottom: "0.5rem",
                }}>
                HTTP Headers
                <div
                    style={{ position: "relative", display: "inline-flex" }}
                    onMouseEnter={() => setShowInfo(true)}
                    onMouseLeave={() => setShowInfo(false)}>
                    <Info size={14} style={{ cursor: "help", color: "var(--text-secondary)" }} />
                    {showInfo && (
                        <div
                            style={{
                                position: "absolute",
                                left: "-100px",
                                bottom: "100%",
                                marginBottom: "8px",
                                backgroundColor: "rgba(0, 0, 0, 0.95)",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                borderRadius: "6px",
                                padding: "0.75rem",
                                fontSize: "0.75rem",
                                color: "var(--text-primary)",
                                width: "320px",
                                maxWidth: "90vw",
                                zIndex: 1000,
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                                lineHeight: "1.5",
                                whiteSpace: "normal",
                            }}>
                            <div style={{ marginBottom: "0.5rem", fontWeight: 600 }}>Custom HTTP Headers</div>
                            <div style={{ marginBottom: "0.5rem" }}>
                                Add custom headers to send with every request to this MCP server. Useful for:
                            </div>
                            <ul style={{ margin: "0.5rem 0", paddingLeft: "1.25rem" }}>
                                <li>API key authentication (X-API-Key)</li>
                                <li>Bearer token authentication</li>
                                <li>Custom authorization headers</li>
                            </ul>
                            <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", opacity: 0.8 }}>
                                Note: Sensitive values are masked for security but stored securely.
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div
                style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary, rgba(255, 255, 255, 0.7))",
                    marginBottom: "0.75rem",
                }}>
                {disabled
                    ? "Headers are managed automatically when OAuth is enabled"
                    : "Add custom headers for authentication or other purposes"}
            </div>

            {/* Existing headers list */}
            {headers.length > 0 && (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                        marginBottom: "0.75rem",
                    }}>
                    {headers.map((header, index) => {
                        const isSensitive = isSensitiveKey(header.key)
                        const isShown = showValues[index]
                        const displayValue = isSensitive && !isShown ? maskValue(header.value) : header.value

                        return (
                            <div
                                key={index}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    padding: "0.5rem 0.75rem",
                                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                                    borderRadius: "6px",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                }}>
                                <span
                                    style={{
                                        fontWeight: 500,
                                        color: "var(--text-primary)",
                                        fontSize: "0.8125rem",
                                        minWidth: "80px",
                                    }}>
                                    {header.key}:
                                </span>
                                <span
                                    style={{
                                        flex: 1,
                                        color: "var(--text-secondary)",
                                        fontSize: "0.8125rem",
                                        fontFamily: isSensitive ? "monospace" : "inherit",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}>
                                    {displayValue}
                                </span>
                                {isSensitive && (
                                    <button
                                        type="button"
                                        onClick={() => toggleShowValue(index)}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            padding: "4px",
                                            color: "var(--text-secondary)",
                                            display: "flex",
                                            alignItems: "center",
                                        }}
                                        title={isShown ? "Hide value" : "Show value"}>
                                        {isShown ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => removeHeader(index)}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        padding: "4px",
                                        color: "var(--error-color, #ef4444)",
                                        display: "flex",
                                        alignItems: "center",
                                    }}
                                    title="Remove header">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Add new header inputs */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                    <input
                        type="text"
                        placeholder="Header name (e.g., X-API-Key)"
                        value={newHeader.key}
                        onChange={(e) => setNewHeader({ ...newHeader, key: e.target.value })}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                        style={{
                            width: "100%",
                            padding: "0.625rem 0.75rem",
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            borderRadius: "6px",
                            color: "var(--text-primary)",
                            fontSize: "0.875rem",
                            outline: "none",
                        }}
                    />
                </div>
                <div style={{ flex: 1 }}>
                    <input
                        type={isSensitiveKey(newHeader.key) ? "password" : "text"}
                        placeholder="Value"
                        value={newHeader.value}
                        onChange={(e) => setNewHeader({ ...newHeader, value: e.target.value })}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                        style={{
                            width: "100%",
                            padding: "0.625rem 0.75rem",
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            borderRadius: "6px",
                            color: "var(--text-primary)",
                            fontSize: "0.875rem",
                            outline: "none",
                        }}
                    />
                </div>
                <button
                    type="button"
                    onClick={addHeader}
                    disabled={disabled || !newHeader.key.trim()}
                    style={{
                        padding: "0.625rem",
                        backgroundColor: newHeader.key.trim() ? "var(--accent-color, #3b82f6)" : "rgba(255, 255, 255, 0.1)",
                        border: "none",
                        borderRadius: "6px",
                        color: "white",
                        cursor: newHeader.key.trim() ? "pointer" : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: newHeader.key.trim() ? 1 : 0.5,
                    }}
                    title="Add header">
                    <Plus size={18} />
                </button>
            </div>
        </div>
    )
}
