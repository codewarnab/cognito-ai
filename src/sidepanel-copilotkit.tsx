/**
 * CopilotKit-powered Side Panel with Custom UI
 * Uses external Gemini runtime via CopilotKit
 */

import { useState, useRef, useEffect } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { useCopilotChat, useCopilotReadable, useCopilotAction } from "@copilotkit/react-core";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import { CopilotChatWindow } from "./components/CopilotChatWindow";
import { COPILOT_RUNTIME_URL, COPILOT_RUNTIME_URL_DEFAULT } from "./constants";
import "./styles/copilot.css";
import "./sidepanel.css";

/**
 * Inner component that uses CopilotKit hooks
 * Must be wrapped by CopilotKit provider
 */
function CopilotChatContent() {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Provide extension context to the AI
    useCopilotReadable({
        description: "Chrome extension context and capabilities",
        value: {
            extensionName: "Chrome AI Assistant",
            capabilities: [
                "Tab management",
                "Browsing history access",
                "Chat history persistence",
                "Side panel interface"
            ],
            currentContext: {
                platform: "Chrome Extension",
                location: "Side Panel"
            }
        }
    });

    // Action: Get active tab info
    useCopilotAction({
        name: "getActiveTab",
        description: "Get information about the currently active browser tab",
        parameters: [],
        handler: async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                return {
                    title: tab.title,
                    url: tab.url,
                    id: tab.id
                };
            } catch (error) {
                console.error('[CopilotAction] Error getting active tab:', error);
                return { error: "Failed to get active tab info" };
            }
        }
    });

    // Action: Search tabs
    useCopilotAction({
        name: "searchTabs",
        description: "Search through all open browser tabs by title or URL",
        parameters: [
            {
                name: "query",
                type: "string",
                description: "Search query to match against tab titles and URLs",
                required: true
            }
        ],
        handler: async ({ query }) => {
            try {
                const tabs = await chrome.tabs.query({});
                const matchingTabs = tabs.filter(tab =>
                    tab.title?.toLowerCase().includes(query.toLowerCase()) ||
                    tab.url?.toLowerCase().includes(query.toLowerCase())
                );
                return {
                    found: matchingTabs.length,
                    tabs: matchingTabs.map(t => ({
                        id: t.id,
                        title: t.title,
                        url: t.url
                    }))
                };
            } catch (error) {
                console.error('[CopilotAction] Error searching tabs:', error);
                return { error: "Failed to search tabs" };
            }
        }
    });

    // Action: Open new tab
    useCopilotAction({
        name: "openTab",
        description: "Open a new browser tab with the specified URL",
        parameters: [
            {
                name: "url",
                type: "string",
                description: "The URL to open in a new tab",
                required: true
            }
        ],
        handler: async ({ url }) => {
            try {
                const tab = await chrome.tabs.create({ url });
                return {
                    success: true,
                    tabId: tab.id,
                    url: tab.url
                };
            } catch (error) {
                console.error('[CopilotAction] Error opening tab:', error);
                return { error: "Failed to open tab" };
            }
        }
    });

    // Action: Get selected text from active tab
    useCopilotAction({
        name: "getSelectedText",
        description: "Get the currently selected text from the active browser tab",
        parameters: [],
        handler: async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab.id) {
                    return { error: "No active tab" };
                }

                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => window.getSelection()?.toString() || ""
                });

                const selectedText = results[0]?.result || "";
                return {
                    success: true,
                    selectedText,
                    length: selectedText.length
                };
            } catch (error) {
                console.error('[CopilotAction] Error getting selected text:', error);
                return { error: "Failed to get selected text. Make sure you have permission." };
            }
        }
    });

    // Handle sending messages
    const handleSendMessage = async () => {
        const trimmedInput = input.trim();

        if (!trimmedInput || isLoading) {
            return;
        }

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

    return (
        <CopilotChatWindow
            messages={messages}
            input={input}
            setInput={setInput}
            onSendMessage={handleSendMessage}
            onKeyPress={handleKeyPress}
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
            // Optional: Add agent name
            agent="chrome-ai-assistant"
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
