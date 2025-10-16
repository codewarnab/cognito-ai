import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard, Keycap } from "../../components/ui/ToolCard";

const log = createLogger("Actions-Interactions-Keyboard");

export function registerKeyboardInteractions() {
    useFrontendTool({
        name: "pressKey",
        description: "Dispatch keyboard events to active element or a target selector.",
        parameters: [
            { name: "key", type: "string", description: "Key to press (e.g., Enter)", required: true },
            { name: "selector", type: "string", description: "Optional target selector", required: false }
        ],
        handler: async ({ key, selector }) => {
            if (!shouldProcess("pressKey", { key, selector })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.debug("pressKey", { key, selector });
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab.id) return { error: "No active tab" };
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    args: [key, selector || null],
                    func: (k: string, sel: string | null) => {
                        const target = sel ? (document.querySelector(sel) as HTMLElement | null) : (document.activeElement as HTMLElement | null);
                        if (!target) return { success: false, error: 'Target element not found or no active element' };
                        target.focus();
                        const opts = { key: k, bubbles: true, cancelable: true } as KeyboardEventInit;
                        const kd = new KeyboardEvent('keydown', opts);
                        const kp = new KeyboardEvent('keypress', opts);
                        const ku = new KeyboardEvent('keyup', opts);
                        target.dispatchEvent(kd); target.dispatchEvent(kp); target.dispatchEvent(ku);
                        return { success: true };
                    }
                });
                return results[0]?.result || { error: "No result" };
            } catch (error) {
                log.error('[FrontendTool] Error pressing key:', error);
                return { error: "Failed to press key" };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return (
                    <ToolCard title="Pressing Key" subtitle={args.selector || 'active element'} state="loading" icon="⌨️">
                        <Keycap keyName={args.key} />
                    </ToolCard>
                );
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Key Press Failed" subtitle={result.error} state="error" icon="⌨️" />;
                }
                return (
                    <ToolCard title="Key Pressed" state="success" icon="⌨️">
                        <Keycap keyName={args.key} />
                        {args.selector && <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Target: {args.selector}</div>}
                    </ToolCard>
                );
            }
            return null;
        },
    });

    useFrontendTool({
        name: "typeText",
        description: "Type text into an input field by selector",
        parameters: [
            { name: "selector", type: "string", description: "CSS selector for input element", required: true },
            { name: "text", type: "string", description: "Text to type", required: true },
            { name: "clearFirst", type: "boolean", description: "Clear field before typing", required: false }
        ],
        handler: async ({ selector, text, clearFirst }) => {
            if (!shouldProcess("typeText", { selector, text })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.info("typeText", { selector, textLength: text.length });
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab.id) return { error: "No active tab" };

                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    args: [selector, text, clearFirst ?? false],
                    func: (sel: string, txt: string, clear: boolean) => {
                        const element = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement;
                        if (!element) {
                            return { success: false, error: `Element not found: ${sel}` };
                        }

                        if (clear) {
                            element.value = '';
                        }

                        element.value = txt;
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        element.dispatchEvent(new Event('change', { bubbles: true }));

                        return { success: true, typed: txt.length };
                    }
                });

                return results[0]?.result || { error: "Failed to type text" };
            } catch (error) {
                log.error('[FrontendTool] Error typing text:', error);
                return { error: "Failed to type text" };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Typing Text" subtitle={args.selector} state="loading" icon="⌨️" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Type Failed" subtitle={result.error} state="error" icon="⌨️" />;
                }
                return <ToolCard title="Text Typed" subtitle={`${result.typed} characters`} state="success" icon="⌨️" />;
            }
            return null;
        },
    });
}
