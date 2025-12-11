// Generate a unique server ID from server name
export const generateServerId = (serverName: string, existingIds: string[]): string => {
  let baseId = serverName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (!baseId) {
    baseId = "custom-server"
  }

  let serverId = baseId
  let counter = 1

  while (existingIds.includes(serverId)) {
    serverId = `${baseId}-${counter}`
    counter++
  }

  return serverId
}
