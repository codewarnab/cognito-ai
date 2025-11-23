import React, { useState } from "react"
import { Info } from "lucide-react"
import { Toggle } from "../../../shared/inputs/Toggle"

interface AuthToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

export const AuthToggle: React.FC<AuthToggleProps> = ({ checked, onChange }) => {
  const [showAuthInfo, setShowAuthInfo] = useState(false)

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.75rem 0"
        }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--text-primary)",
              marginBottom: "0.25rem"
            }}>
            Authentication Required
            <div
              style={{ position: "relative", display: "inline-flex" }}
              onMouseEnter={() => setShowAuthInfo(true)}
              onMouseLeave={() => setShowAuthInfo(false)}>
              <Info size={14} style={{ cursor: "help", color: "var(--text-secondary)" }} />
              {showAuthInfo && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                    bottom: "100%",
                    marginBottom: "8px",
                    backgroundColor: "rgba(0, 0, 0, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "6px",
                    padding: "0.75rem",
                    fontSize: "0.75rem",
                    color: "var(--text-primary)",
                    width: "360px",
                    maxWidth: "90vw",
                    zIndex: 1000,
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                    lineHeight: "1.5",
                    whiteSpace: "normal"
                  }}>
                  <div style={{ marginBottom: "0.5rem", fontWeight: 600 }}>
                    OAuth 2.1 Authorization
                  </div>
                  <div style={{ marginBottom: "0.5rem" }}>
                    Enable if your MCP server requires OAuth 2.1 authentication. The server must implement:
                  </div>
                  <ul style={{ margin: "0.5rem 0", paddingLeft: "1.25rem" }}>
                    <li>OAuth 2.0 Protected Resource Metadata (RFC9728)</li>
                    <li>Authorization code flow with PKCE</li>
                    <li>Resource Indicators (RFC8707)</li>
                    <li>Token validation via Bearer header</li>
                  </ul>
                  <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", opacity: 0.8 }}>
                    Follows the official{" "}
                    <a
                      href="https://modelcontextprotocol.io/specification/draft/basic/authorization"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#60a5fa", textDecoration: "underline" }}>
                      MCP Authorization Spec
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-secondary, rgba(255, 255, 255, 0.7))"
            }}>
            Enable if this server requires authentication
          </div>
        </div>
        <Toggle checked={checked} onChange={onChange} />
      </div>
    </div>
  )
}
