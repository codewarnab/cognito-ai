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
        'Read current tab title and URL',
        'Search open tabs',
        "Open new tabs",
        "Read selected text on page",
        'read current tab content (with permission)',
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

  // Action: Read page content from active tab
  useCopilotAction({
    name: "readPageContent",
    description: "Read the text content from the currently active browser tab. Extracts the main text content from the page.",
    parameters: [],
    handler: async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) {
          return { error: "No active tab" };
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Extract text content from the page
            const body = document.body;
            const title = document.title;

            // Get main text content, excluding scripts and styles
            const clonedBody = body.cloneNode(true) as HTMLElement;
            const scripts = clonedBody.querySelectorAll('script, style, noscript');
            scripts.forEach(el => el.remove());

            const textContent = clonedBody.innerText || clonedBody.textContent || "";

            return {
              title,
              content: textContent.trim(),
              url: window.location.href
            };
          }
        });

        const pageData = results[0]?.result;
        if (!pageData) {
          return { error: "Failed to extract page content" };
        }

        return {
          success: true,
          title: pageData.title,
          url: pageData.url,
          content: pageData.content,
          contentLength: pageData.content.length
        };
      } catch (error) {
        console.error('[CopilotAction] Error reading page content:', error);
        return { error: "Failed to read page content. Make sure you have permission to access this page." };
      }
    }
  });

  // Action: Click element on page
  useCopilotAction({
    name: "clickElement",
    description: "Click an element on the active page. Can click buttons, links, or any clickable element by selector (CSS selector, text content, or aria-label).",
    parameters: [
      {
        name: "selector",
        type: "string",
        description: "CSS selector, button text, link text, or aria-label to identify the element to click. Examples: 'button.submit', 'Login', 'a[href=\"/about\"]', '[aria-label=\"Close\"]'",
        required: true
      }
    ],
    handler: async ({ selector }) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) {
          return { error: "No active tab" };
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [selector],
          func: (sel: string) => {
            // Try to find element by CSS selector first
            let element = document.querySelector(sel);

            // If not found, try to find by text content (buttons, links)
            if (!element) {
              const allElements = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
              element = allElements.find(el =>
                el.textContent?.trim().toLowerCase().includes(sel.toLowerCase()) ||
                el.getAttribute('aria-label')?.toLowerCase().includes(sel.toLowerCase())
              ) as Element;
            }

            if (!element) {
              return {
                success: false,
                error: `Element not found: ${sel}`,
                suggestion: "Try a different selector, button text, or aria-label"
              };
            }

            // Get element info before clicking
            const elementInfo = {
              tagName: element.tagName,
              text: element.textContent?.trim().slice(0, 100),
              id: element.id,
              className: element.className,
              href: (element as HTMLAnchorElement).href
            };

            // Click the element
            (element as HTMLElement).click();

            return {
              success: true,
              clicked: elementInfo,
              message: `Successfully clicked ${element.tagName}${element.id ? '#' + element.id : ''}`
            };
          }
        });

        const result = results[0]?.result;
        return result || { error: "Failed to execute click" };
      } catch (error) {
        console.error('[CopilotAction] Error clicking element:', error);
        return { error: "Failed to click element. Make sure you have permission to access this page." };
      }
    }
  });

  // Action: Scroll page
  useCopilotAction({
    name: "scrollPage",
    description: "Scroll the active page up, down, to top, to bottom, or to a specific element. Useful for navigating long pages.",
    parameters: [
      {
        name: "direction",
        type: "string",
        description: "Scroll direction: 'up', 'down', 'top', 'bottom', or 'to-element'",
        required: true
      },
      {
        name: "amount",
        type: "number",
        description: "Pixels to scroll (for 'up' or 'down'). Default is 500px.",
        required: false
      },
      {
        name: "selector",
        type: "string",
        description: "CSS selector of element to scroll to (only for 'to-element' direction)",
        required: false
      }
    ],
    handler: async ({ direction, amount, selector }) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) {
          return { error: "No active tab" };
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [direction, amount || 500, selector],
          func: (dir: string, amt: number, sel?: string) => {
            const beforeScroll = window.scrollY;

            switch (dir.toLowerCase()) {
              case 'up':
                window.scrollBy({ top: -amt, behavior: 'smooth' });
                break;
              case 'down':
                window.scrollBy({ top: amt, behavior: 'smooth' });
                break;
              case 'top':
                window.scrollTo({ top: 0, behavior: 'smooth' });
                break;
              case 'bottom':
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                break;
              case 'to-element':
                if (!sel) {
                  return { success: false, error: "Selector required for 'to-element' direction" };
                }
                const element = document.querySelector(sel);
                if (!element) {
                  return { success: false, error: `Element not found: ${sel}` };
                }
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                break;
              default:
                return { success: false, error: `Invalid direction: ${dir}. Use 'up', 'down', 'top', 'bottom', or 'to-element'` };
            }

            // Give a moment for smooth scroll to complete
            setTimeout(() => {
              const afterScroll = window.scrollY;
              return {
                success: true,
                direction: dir,
                scrolledFrom: beforeScroll,
                scrolledTo: afterScroll,
                scrollDistance: Math.abs(afterScroll - beforeScroll)
              };
            }, 100);

            return {
              success: true,
              direction: dir,
              message: `Scrolling ${dir}${amt ? ' by ' + amt + 'px' : ''}${sel ? ' to ' + sel : ''}`
            };
          }
        });

        const result = results[0]?.result;
        return result || { success: true, message: `Scrolling ${direction}` };
      } catch (error) {
        console.error('[CopilotAction] Error scrolling page:', error);
        return { error: "Failed to scroll page. Make sure you have permission to access this page." };
      }
    }
  });

  // Action: Fill form input
  useCopilotAction({
    name: "fillInput",
    description: "Fill a text input, textarea, or form field on the active page with specified text.",
    parameters: [
      {
        name: "selector",
        type: "string",
        description: "CSS selector or placeholder text to identify the input field. Examples: '#email', 'input[name=\"username\"]', or 'Enter your email'",
        required: true
      },
      {
        name: "value",
        type: "string",
        description: "The text value to fill into the input field",
        required: true
      }
    ],
    handler: async ({ selector, value }) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) {
          return { error: "No active tab" };
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [selector, value],
          func: (sel: string, val: string) => {
            // Try to find by CSS selector first
            let input = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement;

            // If not found, try to find by placeholder or label
            if (!input) {
              const allInputs = Array.from(document.querySelectorAll('input, textarea')) as (HTMLInputElement | HTMLTextAreaElement)[];
              input = allInputs.find(inp =>
                inp.placeholder?.toLowerCase().includes(sel.toLowerCase()) ||
                inp.getAttribute('aria-label')?.toLowerCase().includes(sel.toLowerCase()) ||
                inp.name?.toLowerCase().includes(sel.toLowerCase())
              ) as HTMLInputElement | HTMLTextAreaElement;
            }

            if (!input) {
              return {
                success: false,
                error: `Input field not found: ${sel}`,
                suggestion: "Try a different selector, placeholder text, or field name"
              };
            }

            // Set the value
            input.value = val;

            // Trigger input events to ensure the page reacts to the change
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            return {
              success: true,
              field: {
                tagName: input.tagName,
                name: input.name,
                id: input.id,
                placeholder: input.placeholder
              },
              filledWith: val.slice(0, 50) + (val.length > 50 ? '...' : ''),
              message: `Successfully filled ${input.tagName}${input.id ? '#' + input.id : input.name ? '[name="' + input.name + '"]' : ''}`
            };
          }
        });

        const result = results[0]?.result;
        return result || { error: "Failed to fill input" };
      } catch (error) {
        console.error('[CopilotAction] Error filling input:', error);
        return { error: "Failed to fill input field. Make sure you have permission to access this page." };
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

