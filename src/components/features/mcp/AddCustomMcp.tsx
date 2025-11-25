import React, { useState, useMemo, useCallback } from "react"
import { McpHeader } from "./McpHeader"
import { InfoBanner } from "./add-custom/InfoBanner"
import { ServerNameInput } from "./add-custom/ServerNameInput"
import { ServerUrlInput } from "./add-custom/ServerUrlInput"
import { DescriptionInput } from "./add-custom/DescriptionInput"
import { ImageUpload } from "./add-custom/ImageUpload"
import { AuthToggle } from "./add-custom/AuthToggle"
import { FormActions } from "./add-custom/FormActions"
import { generateServerId } from "./add-custom/utils"
import { MCP_SERVERS } from "@/constants/mcpServers"
import { createLogger } from "~logger"

const log = createLogger('AddCustomMcp', 'MCP_CLIENT')

interface AddCustomMcpProps {
  onBack: () => void
}

const MAX_DESCRIPTION_LENGTH = 200

// Normalize URL for comparison (remove trailing slashes, lowercase)
const normalizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url.trim())
    return parsed.origin.toLowerCase() + parsed.pathname.replace(/\/+$/, "").toLowerCase()
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "")
  }
}

export const AddCustomMcp: React.FC<AddCustomMcpProps> = ({ onBack }) => {
  const [serverName, setServerName] = useState("")
  const [serverUrl, setServerUrl] = useState("")
  const [description, setDescription] = useState("")
  const [imageData, setImageData] = useState("")
  const [requiresAuth, setRequiresAuth] = useState(false)

  // Create a set of normalized official MCP URLs for quick lookup
  const officialMcpUrls = useMemo(() => {
    return new Map(
      MCP_SERVERS
        .filter(server => server.url)
        .map(server => [normalizeUrl(server.url!), server.name])
    )
  }, [])

  // Check if URL exists in official list and return the server name if found
  const checkUrlInOfficialList = useCallback((url: string): string | null => {
    if (!url.trim()) return null
    const normalizedInput = normalizeUrl(url)
    return officialMcpUrls.get(normalizedInput) || null
  }, [officialMcpUrls])

  // URL error state derived from validation
  const urlError = useMemo(() => {
    const matchingServerName = checkUrlInOfficialList(serverUrl)
    if (matchingServerName) {
      return `This URL is already available as "${matchingServerName}" in the official MCP servers list. Please enable it from the main list instead.`
    }
    return ""
  }, [serverUrl, checkUrlInOfficialList])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (urlError) {
      return
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      alert(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`)
      return
    }

    try {
      // Get existing servers from chrome.storage.local
      const result = await chrome.storage.local.get("customMcpServers")
      const existingServers = result.customMcpServers || []
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
      await chrome.storage.local.set({ customMcpServers: updatedServers })

      // Notify background to reload custom servers cache
      await chrome.runtime.sendMessage({ type: 'mcp/custom-servers/reload' })

      log.info(`Added custom MCP server: ${serverName} (${serverId})`)
      onBack()
    } catch (error) {
      log.error('Failed to add custom MCP server:', error)
      alert('Failed to add custom MCP server. Please try again.')
    }
  }

  return (
    <div className="mcp-panel">
      <McpHeader title="Add Custom MCP Server" onBack={onBack} />

      <div className="mcp-form-content">
        <InfoBanner />

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <ServerNameInput value={serverName} onChange={setServerName} />
            <ServerUrlInput value={serverUrl} onChange={setServerUrl} error={urlError} />
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
              isSubmitDisabled={description.length > MAX_DESCRIPTION_LENGTH || !!urlError}
            />
          </div>
        </form>
      </div>
    </div>
  )
}
