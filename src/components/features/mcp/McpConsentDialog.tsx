import React from "react"
import { ShieldCheckIcon } from "../../../../assets/shield"

interface ConsentRequest {
    serverId: string
    serverName: string
    clientId: string
    redirectUri: string
    scopes: string[]
}

interface McpConsentDialogProps {
    request: ConsentRequest
    onApprove: () => void
    onDeny: () => void
}

export const McpConsentDialog: React.FC<McpConsentDialogProps> = ({
    request,
    onApprove,
    onDeny
}) => {
    return (
        <div className="mcp-consent-overlay">
            <div className="mcp-consent-dialog">
                <div className="mcp-consent-header" style={{ gap: '12px', marginBottom: '16px' }}>
                    <ShieldCheckIcon size={22} className="text-blue-500" />
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Authorization Required</h2>
                </div>

                <div className="mcp-consent-message" style={{ marginBottom: '24px', lineHeight: '1.5' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
                        <strong>{request.serverName}</strong> will be able to take actions on your behalf.
                    </p>
                    <p className="text-gray-500" style={{ margin: 0, fontSize: '14px' }}>Do you want to continue?</p>
                </div>

                <div className="mcp-consent-actions" style={{ gap: '12px' }}>
                    <button
                        onClick={onDeny}
                        className="mcp-consent-btn mcp-consent-btn-deny"
                        style={{
                            padding: '8px 16px',
                            fontSize: '14px',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        Deny
                    </button>
                    <button
                        onClick={onApprove}
                        className="mcp-consent-btn mcp-consent-btn-approve"
                        style={{
                            padding: '8px 16px',
                            fontSize: '14px',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        Approve & Continue
                    </button>
                </div>
            </div>
        </div>
    )
}
