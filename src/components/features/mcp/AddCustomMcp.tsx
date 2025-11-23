import React, { useState } from "react"
import { McpHeader } from "./McpHeader"
import { InfoBanner } from "./add-custom/InfoBanner"
import { ServerNameInput } from "./add-custom/ServerNameInput"
import { ServerUrlInput } from "./add-custom/ServerUrlInput"
import { DescriptionInput } from "./add-custom/DescriptionInput"
import { ImageUpload } from "./add-custom/ImageUpload"
import { AuthToggle } from "./add-custom/AuthToggle"
import { FormActions } from "./add-custom/FormActions"
import { generateServerId } from "./add-custom/utils"

interface AddCustomMcpProps {
  onBack: () => void
}

const MAX_DESCRIPTION_LENGTH = 200

export const AddCustomMcp: React.FC<AddCustomMcpProps> = ({ onBack }) => {
  const [serverName, setServerName] = useState("")
  const [serverUrl, setServerUrl] = useState("")
  const [description, setDescription] = useState("")
  const [imageData, setImageData] = useState("")
  const [requiresAuth, setRequiresAuth] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      alert(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`)
      return
    }

    const existingServers = JSON.parse(localStorage.getItem("customMcpServers") || "[]")
    const existingIds = existingServers.map((s: any) => s.id)

    const serverId = generateServerId(serverName, existingIds)

    const newServer = {
      id: serverId,
      name: serverName,
      url: serverUrl,
      description: description,
      image: imageData || undefined,
      requiresAuthentication: requiresAuth,
      initialEnabled: false,
      initialAuthenticated: false,
      isCustom: true
    }

    const updatedServers = [...existingServers, newServer]
    localStorage.setItem("customMcpServers", JSON.stringify(updatedServers))

    onBack()
  }

  return (
    <div className="mcp-panel">
      <McpHeader title="Add Custom MCP Server" onBack={onBack} />

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "1.5rem" }}>
        <InfoBanner />

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <ServerNameInput value={serverName} onChange={setServerName} />
            <ServerUrlInput value={serverUrl} onChange={setServerUrl} />
            <DescriptionInput
              value={description}
              onChange={setDescription}
              maxLength={MAX_DESCRIPTION_LENGTH}
            />
            <ImageUpload
              imageData={imageData}
              onImageChange={setImageData}
              onError={() => { }}
            />
            <AuthToggle checked={requiresAuth} onChange={setRequiresAuth} />
            <FormActions
              onCancel={onBack}
              isSubmitDisabled={description.length > MAX_DESCRIPTION_LENGTH}
            />
          </div>
        </form>
      </div>
    </div>
  )
}
