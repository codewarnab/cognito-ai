/**
 * MCP Server Manager Component
 * 
 * NOTE: MCP SSE connections are DISABLED.
 * This component is kept for future use but currently does not configure any servers.
 * 
 * Notion tokens are stored and can be used for direct REST API calls to:
 * https://api.notion.com/v1/*
 */

import { useCopilotChat } from "@copilotkit/react-core";
import { useEffect } from "react";
import { createLogger } from "../logger";

const log = createLogger("McpServerManager");

interface McpServerConfig {
  endpoint: string;
  apiKey?: string;
}

function McpServerManager() {
  const { setMcpServers } = useCopilotChat();

  useEffect(() => {
    // MCP SSE connections are disabled
    // Setting empty array to ensure no servers are configured
    log.info("MCP SSE connections disabled - using Notion REST API directly");
    setMcpServers([]);

    // NOTE: If you want to add MCP servers in the future, 
    // uncomment and modify the code below:
    
    // async function configureMcpServers() {
    //   try {
    //     log.info("Configuring MCP servers");
    //     const servers: McpServerConfig[] = [];
    //     
    //     // Example: Add a public MCP server
    //     // servers.push({
    //     //   endpoint: "https://mcp.example.com/sse",
    //     //   apiKey: "your_api_key"
    //     // });
    //     
    //     setMcpServers(servers);
    //   } catch (error) {
    //     log.error("Failed to configure MCP servers", error);
    //   }
    // }
    // 
    // configureMcpServers();

  }, [setMcpServers]);

  // This component doesn't render anything
  return null;
}

export default McpServerManager;

