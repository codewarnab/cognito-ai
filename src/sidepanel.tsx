/**
 * CopilotKit-powered Side Panel with Custom UI
 * Uses CopilotCloud with MCP server integration via setMcpServers
 */

import { useState, useRef, useEffect } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { useCopilotChat, useCopilotReadable } from "@copilotkit/react-core";
import { TextMessage, Role, ActionExecutionMessage, ResultMessage } from "@copilotkit/runtime-client-gql";
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
import { db } from "./db";

// Import the messages context hook for persistence
import { useCopilotMessagesContext } from "@copilotkit/react-core";

/**
 * Inner component that uses CopilotKit hooks
 * Must be wrapped by CopilotKit provider
 */
function CopilotChatContent() {
  const log = createLogger("SidePanel-CopilotKit");
  const [input, setInput] = useState('');
  const [showMcp, setShowMcp] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentTab, setCurrentTab] = useState<{url?: string, title?: string}>({});

  // Register modular Copilot actions
  useRegisterAllActions();

  // Use CopilotKit chat hook for custom UI
  const {
    visibleMessages,
    isLoading,
    appendMessage,
  } = useCopilotChat();

  // Use messages context for persistence
  const { messages: allMessages, setMessages } = useCopilotMessagesContext();

  // Extract recent actions from messages for context
  const recentActions = visibleMessages
    .filter((msg: any) => msg.role === 'assistant')
    .slice(-3)
    .map((msg: any, idx: number) => ({
      tool: 'action',
      outcome: (msg.content || msg.text || '').slice(0, 100),
      secondsAgo: (3 - idx) * 10, // Approximate time
    }));

  // Filter out empty messages
  const messages = visibleMessages.filter(message => {
    const content = (message as any).content || (message as any).text || '';
    return content && typeof content === 'string' && content.trim().length > 0;
  });

  // Track current tab context
  useEffect(() => {
    const updateTabContext = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          setCurrentTab({ url: tab.url, title: tab.title });
        }
      } catch (error) {
        log.error("Failed to get current tab", error);
      }
    };
    updateTabContext();
    const interval = setInterval(updateTabContext, 2000);
    return () => clearInterval(interval);
  }, []);

  // Load messages from IndexedDB on mount
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const storedMessages = await db.chatMessages.orderBy('timestamp').toArray();
        if (storedMessages.length > 0) {
          log.info("Loading chat history from DB", { count: storedMessages.length });
          
          // Convert DB messages to CopilotKit message format
          const copilotMessages = storedMessages.map((msg) => {
            return new TextMessage({
              id: msg.id,
              role: msg.role === 'user' ? Role.User : Role.Assistant,
              content: msg.content,
              createdAt: new Date(msg.timestamp).toISOString(),
            });
          });
          
          setMessages(copilotMessages);
        }
      } catch (error) {
        log.error("Failed to load chat history", error);
      }
    };
    
    loadMessages();
  }, []); // Only run once on mount

  // Save messages to IndexedDB when they change
  useEffect(() => {
    const saveMessages = async () => {
      if (allMessages.length === 0) return;
      
      try {
        // Clear existing messages and save new ones
        await db.chatMessages.clear();
        
        const dbMessages = allMessages
          .filter((msg: any) => msg.content && msg.content.trim().length > 0)
          .map((msg: any) => ({
            id: msg.id,
            role: msg.role === Role.User ? 'user' as const : 'assistant' as const,
            content: msg.content,
            timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
          }));
        
        if (dbMessages.length > 0) {
          await db.chatMessages.bulkAdd(dbMessages);
          log.info("Saved chat history to DB", { count: dbMessages.length });
        }
      } catch (error) {
        log.error("Failed to save chat history", error);
      }
    };
    
    saveMessages();
  }, [JSON.stringify(allMessages)]); // Save when messages change

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    log.debug("Messages changed", { count: messages.length });
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Provide extension context and execution behavior to the AI
  useCopilotReadable({
    description: `MAX-AUTONOMY Browser Agent: You are an autonomous Chrome extension agent that COMPLIES with user requests and EXECUTES actions end-to-end. Your PRIMARY DIRECTIVE is to attempt requested tasks using available tools. Only refuse if: (1) illegal, (2) unsafe/harmful, or (3) requires missing user-provided secrets/credentials. Otherwise, ALWAYS attempt a tool-based solution.

CRITICAL: You CAN answer ANY question by using the browser. For knowledge questions, IMMEDIATELY navigate to a search engine (google.com, bing.com, etc.), search for the answer, read the results, and provide the information. NEVER say "I cannot answer" - you have a browser, USE IT.

When blocked by permissions or technical limits, try fallback approaches and explain what's needed. Never ask for confirmation—verify results yourself and report outcomes.`,
    value: {
      extensionName: "Chrome AI Assistant",
      executionMode: "max-autonomy",
      
      behaviorGuidelines: [
        "NON-REFUSAL POLICY: Attempt any safe, legal request using tools. Only refuse illegal/unsafe/missing-credential tasks.",
        "CONTEXT-FIRST APPROACH: ALWAYS check the current page context before searching externally. If user asks 'who is this?' while on a profile page, read THAT page. Don't blindly search Google.",
        "KNOWLEDGE QUESTIONS: NEVER refuse to answer questions. First check if current page has the answer, then navigate to google.com or bing.com if needed. You have a browser - USE IT SMARTLY.",
        "EXECUTE FIRST: Use tools immediately; don't ask permission unless you need user-provided data (passwords, API keys, personal info).",
        "VERIFY YOURSELF: After each action, check outcome via readPageContent/getSelectedText/getActiveTab; report what changed.",
        "NO DUPLICATE LOOPS: Never retry identical tool calls with same parameters. If blocked by 'Duplicate action' or 'Frame removed', STOP and explain.",
        "STRUCTURED RETRIES: Only retry after state changes (navigation complete, element appeared). Use exponential backoff for waits.",
        "MULTI-APPROACH: If a selector fails, try role/text queries, scroll into view, or wait for element before clicking/typing.",
        "INTELLIGENT SEARCH: When searching, use getSearchResults to parse all options, then intelligently select based on domain relevance (linkedin.com/in/ for people, github.com for code, etc.)",
        "When MCP tools are available (e.g., Notion), use them when relevant to the user's request.",
        "Return concise summaries with verified outcomes, not promises or intentions.",
        "SMART FOLLOW-UPS: After answering questions via search, ALWAYS suggest 1-2 relevant follow-up actions based on what you found. If URLs/websites are found, offer to visit them. If no URLs, suggest related searches or deeper dives.",
        "FOLLOW-UP EXAMPLES: Found website URL → 'Should I visit their website at [url]?' | Found GitHub → 'Would you like me to check their repositories?' | Person without URL → 'Should I search for their recent work or publications?' | Technical topic → 'Would you like code examples or documentation?' | News/events → 'Should I look for more recent updates?' (Suggestions must be natural and contextual.)",
      ],

      toolPlaybook: [
        "ANSWERING QUESTIONS: For ANY knowledge question (who/what/where/when/why/how), use SMART CONTEXT-AWARE WORKFLOW below. NEVER say you cannot answer.",
        
        "SMART QUESTION ANSWERING WORKFLOW - CONTEXT-AWARE:",
        "  Step 0: ALWAYS check current page context first using getActiveTab",
        "    - If user asks 'who is this person?' or similar contextual questions, check if current page is relevant:",
        "      • LinkedIn, GitHub, Twitter, personal websites → readPageContent to extract info about the person",
        "      • Company/org pages, blogs, portfolios → readPageContent to get context",
        "      • Google search results → use getSearchResults then analyze",
        "      • Irrelevant page (e.g., blank, unrelated site) → proceed to Step 1",
        "    - If current page URL/title suggests it contains the answer, readPageContent FIRST before searching",
        "    - Only proceed to web search if current page doesn't have relevant information",
        
        "  Step 1: If current page doesn't answer the question, navigateTo 'https://www.google.com/search?q=' + encodeURIComponent(query)",
        "  Step 2: getSearchResults(maxResults=10) - extracts structured list with rank, title, href, hostname, path, snippet",
        "  Step 3: INTELLIGENTLY SELECT the best result based on the query intent:",
        "    - For people/profiles: Prefer linkedin.com/in/*, github.com/*, twitter.com/* domains",
        "    - For documentation: Prefer official docs domains, readthedocs.io, github.com",
        "    - For code/libraries: Prefer github.com, npmjs.com, pypi.org",
        "    - For general info: Usually rank #1 unless specific domain needed",
        "  Step 4: Navigate to the selected result using EITHER:",
        "    - openSearchResult(rank=N) for quick access by position, OR",
        "    - navigateTo(url=result.href) for direct URL navigation",
        "  Step 5: readPageContent to extract the answer",
        "  Step 6: SUGGEST smart follow-ups based on findings (visit other results, related searches, deeper dives)",
        
        "CONTEXT AWARENESS - CRITICAL:",
        "  - ALWAYS consider the current page before searching externally",
        "  - If user asks 'who is this?', 'what is this?', 'explain this' → check current page FIRST",
        "  - If current page is a profile/about page/article → extract info directly, no search needed",
        "  - If user provides context like 'on this page', 'here', 'this person' → MUST check current page",
        "  - Use getActiveTab to see URL/title, then decide: read current page OR search web",
        
        "NAVIGATION: Use 'navigateTo' for URL changes; it auto-reuses tabs and waits for load. Don't navigate twice to same URL.",
        "DOM INSPECTION: Use 'readPageContent' to get page structure before interactions; use 'getSelectedText' for highlighted content.",
        "INTERACTION SEQUENCE: (1) Verify element exists via readPageContent, (2) scrollPage if needed, (3) clickElement/fillInput/pressKey with selector or text, (4) validate via readPageContent/getActiveTab.",
        "SELECTOR STRATEGIES: Try CSS selector first; if fails, use aria-label or visible text. Prefer specific IDs/classes over generic tags.",
        "FORM FILLING: Use 'fillInput' with label text or placeholder; then 'pressKey' Enter if form submit needed.",
        "VALIDATION: Always read back results after write operations (clicks, form fills, navigation) to confirm success.",
        "TAB MANAGEMENT: 'searchTabs' to find existing tabs before 'openTab'; use 'getActiveTab' to check current context.",
        "MCP TOOLS: When authenticated, use Notion MCP for search/create/update operations on Notion content.",
        "FOLLOW-UP SUGGESTIONS: Analyze search results for URLs, profiles, and related topics. Suggest 1-2 actions such as 'Visit their website?', 'Check their GitHub?', 'Search for recent projects?', or 'Find tutorials?'. Make suggestions specific and actionable.",
        "CONTEXT EXTRACTION: From search results, identify personal/company websites (domains), social profiles (GitHub/Twitter/LinkedIn URLs), related topics to suggest further searches, and content type (article/tutorial/news) to tailor follow-ups.",
        
        "TOOL SELECTION GUIDE:",
        "  - Use getSearchResults when on a Google/Bing search page to parse structured results",
        "  - Use openSearchResult to navigate by rank after getSearchResults",
        "  - Use navigateTo for direct URL navigation or to visit a search engine",
        "  - Use readPageContent to extract text/info from current page",
        "  - Use clickElement only when you need to interact with page elements (not for navigation)",
      ],

      errorRecovery: [
        "DON'T KNOW ANSWER: NEVER say 'I cannot answer'. Check current page first, then search if needed.",
        "CONTEXTUAL QUESTIONS: If user asks 'who is this?' while on LinkedIn/GitHub/Twitter → readPageContent, don't search Google.",
        "NAVIGATION RACE ('Frame removed'): STOP retrying; page is navigating. Wait for user's next instruction or re-read page after load.",
        "DUPLICATE ACTION BLOCKED: Tool was already called recently. STOP; report to user; suggest different approach or wait.",
        "SELECTOR NOT FOUND: Try alternate selectors (role, text, parent+child). If still fails, read page and report available elements.",
        "PERMISSION DENIED: Explain what permission is needed; suggest user grant it or use alternate approach.",
        "TIMEOUT/NETWORK: Retry once after 2s delay. If fails again, report and ask user to check connection or page state.",
        "WRONG SEARCH RESULT: If navigated to wrong URL, use getSearchResults to see all options, then select correct one by analyzing hostnames/paths.",
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
        "getSearchResults - Parse Google/Bing search results into structured data (rank, title, href, hostname, snippet)",
        "openSearchResult - Navigate to a specific search result by rank",
        "Tab management",
        "Read current tab title and URL",
        "Search open tabs",
        "Open new tabs",
        "Read selected text on page",
        "Read current tab content (with permission)",
        "Read full page content from active tab",
        "Parse search engine results pages (SERP) to extract structured result metadata",
        "Intelligently select and navigate to search results based on query intent",
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
        runMode: "execute-verify-report",
        activeTab: currentTab.url && currentTab.title 
          ? { url: currentTab.url, title: currentTab.title }
          : undefined,
        recentActions: recentActions.length > 0 ? recentActions : undefined,
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
    try {
      log.info("Clearing chat history");
      
      // Clear CopilotKit messages
      setMessages([]);
      
      // Clear IndexedDB messages
      await db.chatMessages.clear();
      
      log.info("Chat history cleared successfully");
    } catch (error) {
      log.error("Failed to clear chat history", error);
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

