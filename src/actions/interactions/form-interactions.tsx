import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard } from "../../components/ui/ToolCard";

const log = createLogger("Actions-Interactions-Form");

export function registerFormInteractions() {
    useFrontendTool({
        name: "fillByLabel",
        description: "Fill an input field by its label text",
        parameters: [
            { name: "label", type: "string", description: "Label text (case-insensitive)", required: true },
            { name: "value", type: "string", description: "Value to fill", required: true }
        ],
        handler: async ({ label, value }) => {
            if (!shouldProcess("fillByLabel", { label, value })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.info("fillByLabel", { label });
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab.id == null) return { error: "No active tab" };

                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    args: [label, value],
                    func: (lbl: string, val: string) => {
                        const normalizedLabel = lbl.toLowerCase().trim();

                        // Find label element
                        const labels = Array.from(document.querySelectorAll('label'));
                        const labelEl = labels.find(l =>
                            l.textContent?.toLowerCase().trim().includes(normalizedLabel)
                        );

                        if (!labelEl) {
                            return { success: false, error: `Label not found: ${lbl}` };
                        }

                        // Find associated input
                        let input: HTMLInputElement | HTMLTextAreaElement | null = null;
                        if (labelEl.htmlFor) {
                            input = document.getElementById(labelEl.htmlFor) as HTMLInputElement;
                        } else {
                            input = labelEl.querySelector('input, textarea');
                        }

                        if (!input) {
                            return { success: false, error: `Input not found for label: ${lbl}` };
                        }

						// Use the native value setter to ensure React-controlled inputs update correctly
						const proto = Object.getPrototypeOf(input);
						const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
						if (descriptor && typeof descriptor.set === 'function') {
							descriptor.set.call(input, val);
						} else {
							// Fallback in case the descriptor/setter is unavailable
							(input as any).value = val;
						}
						input.dispatchEvent(new Event('input', { bubbles: true }));
						input.dispatchEvent(new Event('change', { bubbles: true }));

                        return { success: true, fieldId: input.id || input.name };
                    }
                });

                return results[0]?.result || { error: "Failed to fill field" };
            } catch (error) {
                log.error('[FrontendTool] Error filling by label:', error);
                return {
                    error: "Failed to fill field by label",
                    details: error instanceof Error
                        ? { message: error.message, stack: error.stack }
                        : String(error)
                };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Filling Field" subtitle={`Label: ${args.label}`} state="loading" icon="📝" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Fill Failed" subtitle={result.error} state="error" icon="📝" />;
                }
                return <ToolCard title="Field Filled" subtitle={`Label: ${args.label}`} state="success" icon="📝" />;
            }
            return null;
        },
    });

    useFrontendTool({
        name: "fillByPlaceholder",
        description: "Fill an input field by its placeholder text",
        parameters: [
            { name: "placeholder", type: "string", description: "Placeholder text (case-insensitive)", required: true },
            { name: "value", type: "string", description: "Value to fill", required: true }
        ],
        handler: async ({ placeholder, value }) => {
            if (!shouldProcess("fillByPlaceholder", { placeholder, value })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.info("fillByPlaceholder", { placeholder });
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab.id == null) return { error: "No active tab" };

                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    args: [placeholder, value],
                    func: (ph: string, val: string) => {
                        const normalizedPh = ph.toLowerCase().trim();

                        const inputs = Array.from(document.querySelectorAll('input, textarea')) as Array<HTMLInputElement | HTMLTextAreaElement>;
                        const input = inputs.find(i =>
                            i.placeholder?.toLowerCase().includes(normalizedPh)
                        );

                        if (!input) {
                            return { success: false, error: `Input with placeholder not found: ${ph}` };
                        }

						// Use the native value setter to ensure React-controlled inputs update correctly
						const proto = Object.getPrototypeOf(input);
						const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
						if (descriptor && typeof descriptor.set === 'function') {
							descriptor.set.call(input, val);
						} else {
							// Fallback in case the descriptor/setter is unavailable
							(input as any).value = val;
						}
						input.dispatchEvent(new Event('input', { bubbles: true }));
						input.dispatchEvent(new Event('change', { bubbles: true }));

                        return { success: true, fieldId: input.id || input.name };
                    }
                });

                return results[0]?.result || { error: "Failed to fill field" };
            } catch (error) {
                log.error('[FrontendTool] Error filling by placeholder:', error);
                return {
                    error: "Failed to fill field by placeholder",
                    details: error instanceof Error
                        ? { message: error.message, stack: error.stack }
                        : String(error)
                };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Filling Field" subtitle={`Placeholder: ${args.placeholder}`} state="loading" icon="📝" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Fill Failed" subtitle={result.error} state="error" icon="📝" />;
                }
                return <ToolCard title="Field Filled" subtitle={`Placeholder: ${args.placeholder}`} state="success" icon="📝" />;
            }
            return null;
        },
    });
}
