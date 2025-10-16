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
                        const target = (sel ? document.querySelector(sel) : document.activeElement) as Element | null;
                        if (!target) return { success: false, error: 'Target element not found or no active element' };

                        const focusable = target as HTMLElement;
                        if (typeof focusable.focus === 'function') focusable.focus();

                        const base: KeyboardEventInit = {
                            key: k,
                            code: k,
                            bubbles: true,
                            cancelable: true
                        };

                        const keydown = new KeyboardEvent('keydown', base);
                        const keypress = new KeyboardEvent('keypress', base);
                        const keyup = new KeyboardEvent('keyup', base);

                        target.dispatchEvent(keydown);
                        target.dispatchEvent(keypress);
                        target.dispatchEvent(keyup);
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
                        const el = document.querySelector(sel) as HTMLElement | null;
                        if (!el) return { success: false, error: 'Element not found' };

                        const focusable = el as HTMLElement;
                        if (typeof focusable.focus === 'function') focusable.focus();

                        const dispatchInputLike = (target: Element) => {
                            target.dispatchEvent(new Event('input', { bubbles: true }));
                            target.dispatchEvent(new Event('change', { bubbles: true }));
                        };

                        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                            if (clear) el.value = '';
                            el.value = (clear ? '' : el.value) + txt;
                            dispatchInputLike(el);
                            return { success: true, typed: txt.length };
                        }

                        if ((el as HTMLElement).isContentEditable) {
                            const ce = el as HTMLElement;
                            if (clear) ce.innerText = '';
                            ce.innerText = (clear ? '' : ce.innerText) + txt;
                            dispatchInputLike(ce);
                            return { success: true, typed: txt.length };
                        }

                        return { success: false, error: 'Unsupported element type' };
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
