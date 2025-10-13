/**
 * CopilotKit-powered Side Panel with Custom UI
 * Uses external Gemini runtime via CopilotKit
 */

import { useState, useRef, useEffect } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { useCopilotChat, useCopilotReadable } from "@copilotkit/react-core";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import { CopilotChatWindow } from "./components/CopilotChatWindow";
import { COPILOT_RUNTIME_URL, COPILOT_RUNTIME_URL_DEFAULT } from "./constants";
import "./styles/copilot.css";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Register modular Copilot actions
  useRegisterAllActions();

  // Helper: normalize URL for comparison (ignore hash, www, trailing slash)
  const normalizeUrl = (inputUrl: string) => {
    try {
      const u = new URL(inputUrl);
      const hostname = u.hostname.replace(/^www\./i, '');
      const pathname = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
      const hashless = `${u.protocol}//${hostname}${u.port ? ':' + u.port : ''}${pathname}${u.search}`;
      return hashless.toLowerCase();
    } catch {
      return inputUrl.toLowerCase();
    }
  };

  const urlsEqual = (a?: string, b?: string) => {
    if (!a || !b) return false;
    return normalizeUrl(a) === normalizeUrl(b);
  };

  // Helper: focus a tab (and its window)
  const focusTab = async (tab: chrome.tabs.Tab) => {
    if (tab.id) {
      await chrome.tabs.update(tab.id, { active: true });
    }
    if (tab.windowId !== undefined) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
  };

  // Guard: track recently-opened URLs to avoid racing duplicate opens
  const recentlyOpenedRef = useRef<Record<string, number>>({});
  const isRecentlyOpened = (key: string, windowMs = 5000) => {
    const ts = recentlyOpenedRef.current[key];
    const now = Date.now();
    return Boolean(ts && now - ts < windowMs);
  };
  const markOpened = (key: string) => {
    recentlyOpenedRef.current[key] = Date.now();
  };

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
    description: "Autonomous Chrome extension agent. When the user asks for something, perform the necessary actions end-to-end and report the outcome. Do not ask the user to verify — you must verify results yourself (by reading page state, selected text, or re-checking the tab) and then summarize what changed, including any follow-up you executed.",
    value: {
      extensionName: "Chrome AI Assistant",
      executionMode: "autonomous",
      behaviorGuidelines: [
        "Directly execute required steps with available tools; avoid requesting user confirmation.",
        "After each action, validate success by inspecting the DOM, URL, titles, or selected text.",
        "If a step fails, attempt an alternative method automatically and report what you tried.",
        "Only ask for input when information is missing and cannot be inferred.",
        "Return a concise final summary of what was done and the verified result.",
        "Do not try to open new tab with same url twice",
        
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
        "Side panel interface"
      ],
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

  return (
    <CopilotChatWindow
      messages={messages}
      input={input}
      setInput={setInput}
      onSendMessage={handleSendMessage}
      onKeyPress={handleKeyPress}
      onClearChat={handleClearChat}
      isLoading={isLoading}
      messagesEndRef={messagesEndRef}
    />
  );
}

/**
 * Main Side Panel component with CopilotKit provider
 */
function SidePanel() {
  // Check if runtime URL is configured
  const isConfigured = COPILOT_RUNTIME_URL !== COPILOT_RUNTIME_URL_DEFAULT;

  if (!isConfigured) {
    return (
      <div className="sidepanel-container">
        <div className="configuration-prompt">
          <div className="config-icon">⚙️</div>
          <h2>CopilotKit Configuration Required</h2>
          <p>
            To use the AI assistant, please configure your CopilotKit runtime URL.
          </p>
          <div className="config-instructions">
            <h3>Setup Instructions:</h3>
            <ol>
              <li>Deploy your CopilotKit runtime with Gemini</li>
              <li>Open <code>src/constants.ts</code></li>
              <li>Update <code>COPILOT_RUNTIME_URL</code> with your runtime endpoint</li>
              <li>Reload the extension</li>
            </ol>
          </div>
          <p className="config-note">
            📝 Example: <code>https://your-runtime.example.com/api/copilotkit</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <CopilotKit
      runtimeUrl={COPILOT_RUNTIME_URL}
    >
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

