import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard, CodeBlock, Badge } from "../../components/ui/ToolCard";

const log = createLogger("Actions-Interactions-Text");

export function registerTextExtractionInteractions() {
    useFrontendTool({
        name: "extractText",
        description: "Extract text from page or selected elements.",
        parameters: [
            { name: "selector", type: "string", description: "Optional CSS selector; if omitted returns main body text", required: false },
            { name: "all", type: "boolean", description: "If true and selector is provided, return all matches", required: false },
            { name: "limit", type: "number", description: "Max characters (default 5000)", required: false }
        ],
        handler: async ({ selector, all, limit }) => {
            if (!shouldProcess("extractText", { selector, all, limit })) {
                return { skipped: true, reason: "duplicate" };
            }

            const max = typeof limit === 'number' && limit > 0 ? limit : 5000;
            try {
                log.debug("extractText", { selector, all, max });
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab.id) return { error: "No active tab" };
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    args: [selector || null, Boolean(all), max],
                    func: (sel: string | null, returnAll: boolean, maxLen: number) => {
                        if (!sel) {
                            const cloned = document.body.cloneNode(true) as HTMLElement;
                            cloned.querySelectorAll('script, style, noscript').forEach((e) => e.remove());
                            const text = (cloned.innerText || cloned.textContent || '').trim();
                            return { success: true, text: text.slice(0, maxLen), truncated: text.length > maxLen };
                        }
                        const nodes = Array.from(document.querySelectorAll(sel));
                        if (!nodes.length) return { success: false, error: `No elements match selector: ${sel}` };
                        if (returnAll) {
                            const texts = nodes.map((n) => (n.textContent || '').trim());
                            const joined = texts.join('\n').slice(0, maxLen);
                            return { success: true, text: joined, count: texts.length, truncated: texts.join('\n').length > maxLen };
                        }
                        const first = nodes[0];
                        const t = (first.textContent || '').trim();
                        return { success: true, text: t.slice(0, maxLen), truncated: t.length > maxLen };
                    }
                });
                return results[0]?.result || { error: "No result" };
            } catch (error) {
                log.error('[FrontendTool] Error extracting text:', error);
                return { error: "Failed to extract text" };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Extracting Text" subtitle={args.selector || 'entire page'} state="loading" icon="📋" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Extraction Failed" subtitle={result.error} state="error" icon="📋" />;
                }
                const charCount = result.text?.length || 0;
                return (
                    <ToolCard
                        title="Text Extracted"
                        subtitle={`${charCount} characters${result.count ? ` from ${result.count} elements` : ''}`}
                        state="success"
                        icon="📋"
                    >
                        {result.truncated && <Badge label="truncated" variant="warning" />}
                        {result.text && (
                            <details className="tool-details">
                                <summary>View text</summary>
                                <CodeBlock code={result.text.substring(0, 500) + (result.text.length > 500 ? '...' : '')} />
                            </details>
                        )}
                    </ToolCard>
                );
            }
            return null;
        },
    });

    useFrontendTool({
        name: "scrollIntoView",
        description: "Scroll an element into view",
        parameters: [
            { name: "selector", type: "string", description: "CSS selector", required: true },
            { name: "block", type: "string", description: "Vertical alignment: 'start'|'center'|'end'|'nearest'", required: false }
        ],
        handler: async ({ selector, block }) => {
            if (!shouldProcess("scrollIntoView", { selector })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.info("scrollIntoView", { selector });
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab.id) return { error: "No active tab" };

                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    args: [selector, block || 'nearest'],
                    func: (sel: string, blk: ScrollLogicalPosition) => {
                        const element = document.querySelector(sel);
                        if (!element) {
                            return { success: false, error: `Element not found: ${sel}` };
                        }

                        element.scrollIntoView({ behavior: 'smooth', block: blk });
                        return { success: true };
                    }
                });

                return results[0]?.result || { error: "Failed to scroll" };
            } catch (error) {
                log.error('[FrontendTool] Error scrolling:', error);
                return { error: "Failed to scroll element into view" };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Scrolling to Element" subtitle={args.selector} state="loading" icon="🔍" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Scroll Failed" subtitle={result.error} state="error" icon="🔍" />;
                }
                return <ToolCard title="Scrolled to Element" subtitle={args.selector} state="success" icon="🔍" />;
            }
            return null;
        },
    });
}
