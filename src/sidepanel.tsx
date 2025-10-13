/**
 * CopilotKit-powered Side Panel with Custom UI
 * Uses CopilotCloud with MCP server integration via setMcpServers
 */

import { useState, useRef, useEffect } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { useCopilotChat, useCopilotReadable } from "@copilotkit/react-core";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import { CopilotChatWindow } from "./components/CopilotChatWindow";
import { McpManager } from "./components/McpManager";
import McpServerManager from "./components/McpServerManager";
import { ToolRenderer } from "./components/ToolRenderer";
import "./styles/copilot.css";
import "./styles/mcp.css";
import "./styles/mcp-tools.css";
import "./sidepanel.css";
import { createLogger } from "./logger";
import { useRegisterAllActions } from "./actions/registerAll";

/**
 * Inner component that uses CopilotKit hooks
 * Must be wrapped by CopilotKit provider
 */
function CopilotChatContent() {
  const log = createLogger("SidePanel-CopilotKit");
  const [input, setInput] = useState('');
  const [showMcp, setShowMcp] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Register modular Copilot actions
  useRegisterAllActions();

  // Use CopilotKit chat hook for custom UI
  const {
    visibleMessages,
    isLoading,
    appendMessage,
  } = useCopilotChat();

  // Filter out empty messages
  const messages = visibleMessages.filter(message => {
    const content = (message as any).content || (message as any).text || '';
    return content && typeof content === 'string' && content.trim().length > 0;
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    log.debug("Messages changed", { count: messages.length });
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Provide extension context and execution behavior to the AI
  useCopilotReadable({
    description: "Autonomous Chrome extension agent with MCP server integration. When the user asks for something, perform the necessary actions end-to-end and report the outcome. Do not ask the user to verify — you must verify results yourself (by reading page state, selected text, or re-checking the tab) and then summarize what changed, including any follow-up you executed. You have access to MCP tools for extended functionality.",
    value: {
      extensionName: "Chrome AI Assistant",
      executionMode: "autonomous",
      behaviorGuidelines: [
        "Directly execute required steps with available tools; avoid requesting user confirmation.",
        "After each action, validate success by inspecting the DOM, URL, titles, or selected text.",
        "If a step fails, DO NOT retry it immediately. Wait for user confirmation or try a different approach.",
        "NEVER retry the same action with the same parameters repeatedly - this creates infinite loops.",
        "If you get a 'Duplicate action blocked' or 'Frame removed' error, STOP and report to the user.",
        "Only ask for input when information is missing and cannot be inferred.",
        "Return a concise final summary of what was done and the verified result.",
        "Do not try to open new tab with same url twice",
        "If navigation causes errors, STOP - don't retry navigation repeatedly.",
        "When MCP tools are available (e.g., Notion), use them when relevant to the user's request.",
        "You can search, create, and update Notion pages when the user asks about Notion-related tasks.",
      ],
      capabilities: [
        "getActiveTab",
        "searchTabs",
        "openTab",
        "navigateTo (reuses existing tabs; reloads if already on same page)",
        "getSelectedText",
        "readPageContent",
        "clickElement",
        "scrollPage",
        "fillInput",
        "Tab management",
        "Read current tab title and URL",
        "Search open tabs",
        "Open new tabs",
        "Read selected text on page",
        "Read current tab content (with permission)",
        "Read full page content from active tab",
        "Click elements on page (buttons, links, any clickable element)",
        "Scroll page (up, down, top, bottom, or to specific element)",
        "Fill form inputs and text fields",
        "Interact with page elements using CSS selectors or text",
        "Automate page interactions through natural language",
        "Autonomously verify effects of actions before responding",
        "Chat history persistence",
        "Side panel interface",
        "MCP Server Integration",
        "Notion MCP tools - search, create, and update Notion pages and databases when authenticated",
        "Access to external tools via Model Context Protocol (MCP) servers",
      ],
      mcpIntegration: {
        enabled: true,
        availableServers: ["Notion MCP (when authenticated)"],
        instructions: "Use MCP tools when the user requests operations related to connected services like Notion. MCP tools will be automatically available through the CopilotKit integration.",
      },
      currentContext: {
        platform: "Chrome Extension",
        location: "Side Panel",
        runMode: "do-then-report"
      }
    }
  });

  // Inline Copilot actions have been refactored into modular registrations via useRegisterAllActions()

  // Handle sending messages
  const handleSendMessage = async () => {
    const trimmedInput = input.trim();

    if (!trimmedInput || isLoading) {
      return;
    }

    log.info("SendMessage", { length: trimmedInput.length });
    setInput('');

    await appendMessage(new TextMessage({
      content: trimmedInput,
      role: Role.User
    }));
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim().length > 0) {
        handleSendMessage();
      }
    }
  };

  // Handle clearing all messages
  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      // Delete all visible messages
      for (const message of visibleMessages) {
        try {
          await deleteMessage(message.id);
        } catch (error) {
          console.error('[ClearChat] Error deleting message:', error);
        }
      }
    }
  };

  // Render MCP Manager or Chat Window
  if (showMcp) {
    return <McpManager onBack={() => setShowMcp(false)} />;
  }

  return (
    <>
      {/* Setup MCP server connections using setMcpServers */}
      <McpServerManager />

      {/* Render MCP tool calls */}
      <ToolRenderer />

      <CopilotChatWindow
        messages={messages}
        input={input}
        setInput={setInput}
        onSendMessage={handleSendMessage}
        onKeyPress={handleKeyPress}
        onClearChat={handleClearChat}
        onSettingsClick={() => setShowMcp(true)}
        isLoading={isLoading}
        messagesEndRef={messagesEndRef}
      />
    </>
  );
}

/**
 * Main Side Panel component with CopilotKit provider
 * Now using CopilotCloud with MCP server support via setMcpServers
 */
function SidePanel() {
  return (
    <CopilotKit publicApiKey="ck_pub_0f2b859676875143d926df3e2a9a3a7a">
      {/* CopilotCloud integration with MCP server support */}
      <CopilotChatContent />
    </CopilotKit>
  );
}

export default SidePanel;

// TypeScript declarations
declare global {
  interface Window {
    chrome: typeof chrome;
  }
}
function deleteMessage(id: string) {
  throw new Error("Function not implemented.");
}

