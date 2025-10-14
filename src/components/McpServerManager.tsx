/**
 * MCP Server Manager Component
 * 
 * Automatically configures MCP servers based on user authentication.
 * Currently supports:
 * - Notion MCP (when authenticated via OAuth)
 */

import { useCopilotChat } from "@copilotkit/react-core";
import { useEffect, useState } from "react";
import { createLogger } from "../logger";
import type { NotionMcpStatus } from "../mcp/types";
import { ServerCapabilitiesSchema } from "@modelcontextprotocol/sdk/types";

const log = createLogger("McpServerManager");

interface McpServerConfig {
  endpoint: string;
  apiKey?: string;
}

function McpServerManager() {
  const { setMcpServers } = useCopilotChat();
  const [notionStatus, setNotionStatus] = useState<NotionMcpStatus>({ state: 'disconnected' });
  const [notionAccessToken, setNotionAccessToken] = useState<string | null>(null);

  // Debug: Component mounted
  console.log('[McpServerManager] Component mounted/rendered');

  // Listen for Notion MCP status updates
  useEffect(() => {
    console.log('[McpServerManager] Setting up message listener');
    
    const handleStatusUpdate = (message: any) => {
      console.log('[McpServerManager] Received message:', message.type);
      if (message.type === 'mcp/notion/status/update') {
        console.log('[McpServerManager] Notion MCP status update', message.payload);
        log.info("Notion MCP status update", message.payload);
        setNotionStatus(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(handleStatusUpdate);

    // Get initial status
    console.log('[McpServerManager] Requesting initial status');
    chrome.runtime.sendMessage({ type: 'mcp/notion/status/get' })
      .then((response: any) => {
        console.log('[McpServerManager] Initial status response:', response);
        if (response.success) {
          setNotionStatus(response.data);
        }
      })
      .catch(err => {
        console.error('[McpServerManager] Failed to get initial status:', err);
        log.error("Failed to get initial Notion MCP status", err);
      });

    return () => {
      console.log('[McpServerManager] Cleaning up message listener');
      chrome.runtime.onMessage.removeListener(handleStatusUpdate);
    };
  }, []);

  // Fetch Notion access token when authenticated
  useEffect(() => {
    console.log('[McpServerManager] Status changed to:', notionStatus.state);
    
    async function fetchNotionToken() {
      if (notionStatus.state === 'connected' || notionStatus.state === 'authenticated') {
        console.log('[McpServerManager] Fetching access token...');
        try {
          const result = await chrome.storage.local.get('oauth.notion.mcp.tokens');
          const tokens = result['oauth.notion.mcp.tokens'];
          console.log('[McpServerManager] Tokens retrieved:', !!tokens);
          if (tokens?.access_token) {
            console.log('[McpServerManager] Access token found, length:', tokens.access_token.length);
            log.info("Notion access token retrieved");
            setNotionAccessToken(tokens.access_token);
          }
        } catch (error) {
          console.error('[McpServerManager] Error fetching token:', error);
          log.error("Failed to retrieve Notion access token", error);
        }
      } else {
        console.log('[McpServerManager] Clearing access token');
        setNotionAccessToken(null);
      }
    }

    fetchNotionToken();
  }, [notionStatus.state]);

  // Configure MCP servers based on authentication status
  useEffect(() => {
    console.log('[McpServerManager] Configuring MCP servers. Status:', notionStatus.state, 'Has token:', !!notionAccessToken);
    
    const servers: McpServerConfig[] = [];

    // Add Notion MCP if authenticated and connected
    if ((notionStatus.state === 'connected' || notionStatus.state === 'authenticated') && notionAccessToken) {
      console.log('[McpServerManager] Adding Notion MCP server to CopilotKit');
      log.info("Adding Notion MCP server to CopilotKit");
      servers.push({
        endpoint: "https://mcp.notion.com/sse",
        apiKey: notionAccessToken
      });
    }

    // servers.push({
    //   endpoint:"https://backend.composio.dev/v3/mcp/19801b97-232a-461c-a723-cd276e1a41af/mcp?include_composio_helper_actions=true",
    // });

    // Update CopilotKit with configured servers
    console.log('[McpServerManager] Setting MCP servers:', servers.length, 'servers');
    log.info("Configuring MCP servers", { count: servers.length, servers: servers.map(s => s.endpoint) });
    setMcpServers(servers);

  }, [notionStatus.state, notionAccessToken, setMcpServers]);

  // This component doesn't render anything
  return null;
}

export default McpServerManager;
