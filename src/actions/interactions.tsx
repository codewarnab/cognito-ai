import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../logger";
import { shouldProcess } from "./useActionDeduper";
import { ToolCard, CodeBlock, Keycap, Badge } from "../components/ui/ToolCard";

export function registerInteractionActions() {
  const log = createLogger("Actions-Interactions");

  useFrontendTool({
    name: "clickElement",
    description: "Click an element on the active page by selector, text, or aria-label.",
    parameters: [
      { name: "selector", type: "string", description: "CSS selector or text/aria-label", required: true }
    ],
    handler: async ({ selector }) => {
      if (!shouldProcess("clickElement", { selector })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.info("clickElement", { selector });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) return { error: "No active tab" };
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [selector],
          func: (sel: string) => {
            let element = document.querySelector(sel);
            if (!element) {
              const allElements = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
              element = allElements.find(el =>
                el.textContent?.trim().toLowerCase().includes(sel.toLowerCase()) ||
                el.getAttribute('aria-label')?.toLowerCase().includes(sel.toLowerCase())
              ) as Element;
            }
            if (!element) {
              return { success: false, error: `Element not found: ${sel}`, suggestion: "Try a different selector, button text, or aria-label" };
            }
            const elementInfo = { tagName: element.tagName, text: element.textContent?.trim().slice(0, 100), id: (element as HTMLElement).id, className: (element as HTMLElement).className, href: (element as HTMLAnchorElement).href };
            (element as HTMLElement).click();
            return { success: true, clicked: elementInfo, message: `Successfully clicked ${element.tagName}${(element as HTMLElement).id ? '#' + (element as HTMLElement).id : ''}` };
          }
        });
        const result = results[0]?.result;
        if (result?.success) log.info("clickElement success", result.clicked);
        else log.warn("clickElement failed", result);
        return result || { error: "Failed to execute click" };
      } catch (error) {
        const errorMsg = (error as Error)?.message || String(error);

        // Don't retry if frame was removed (page is navigating)
        if (errorMsg.includes('Frame with ID') || errorMsg.includes('was removed')) {
          log.warn('[FrontendTool] Frame removed during click - page may be navigating', { selector });
          return { error: "Page is navigating - action cancelled to prevent loops", frameRemoved: true };
        }

        log.error('[FrontendTool] Error clicking element:', error);
        return { error: "Failed to click element. Make sure you have permission to access this page." };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Clicking Element" subtitle={args.selector} state="loading" icon="👆" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return (
            <ToolCard title="Click Failed" subtitle={result.error} state="error" icon="👆">
              {result.suggestion && <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>{result.suggestion}</div>}
            </ToolCard>
          );
        }
        return (
          <ToolCard title="Element Clicked" subtitle={result.message || 'Click successful'} state="success" icon="👆">
            {result.clicked && (
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                <Badge label={result.clicked.tagName} variant="default" />
                {result.clicked.text && <div style={{ marginTop: '4px', opacity: 0.7 }}>{result.clicked.text}</div>}
              </div>
            )}
          </ToolCard>
        );
      }
      return null;
    },
  });

  useFrontendTool({
    name: "scrollPage",
    description: "Scroll page up/down/top/bottom or to a specific element.",
    parameters: [
      { name: "direction", type: "string", description: "Scroll direction: 'up'|'down'|'top'|'bottom'|'to-element'", required: true },
      { name: "amount", type: "number", description: "Pixels to scroll (for up/down). Default 500", required: false },
      { name: "selector", type: "string", description: "CSS selector for 'to-element'", required: false }
    ],
    handler: async ({ direction, amount, selector }) => {
      if (!shouldProcess("scrollPage", { direction, amount, selector })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.debug("scrollPage", { direction, amount, selector });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) return { error: "No active tab" };
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [direction, amount || 500, selector || null],
          func: (dir: string, amt: number, sel: string | null) => {
            const beforeScroll = window.scrollY;
            switch (dir.toLowerCase()) {
              case 'up': window.scrollBy({ top: -amt, behavior: 'smooth' }); break;
              case 'down': window.scrollBy({ top: amt, behavior: 'smooth' }); break;
              case 'top': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
              case 'bottom': window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); break;
              case 'to-element':
                if (!sel) return { success: false, error: "Selector required for 'to-element' direction" };
                const element = document.querySelector(sel);
                if (!element) return { success: false, error: `Element not found: ${sel}` };
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                break;
              default:
                return { success: false, error: `Invalid direction: ${dir}. Use 'up','down','top','bottom','to-element'` };
            }
            setTimeout(() => {
              const afterScroll = window.scrollY;
              return { success: true, direction: dir, scrolledFrom: beforeScroll, scrolledTo: afterScroll, scrollDistance: Math.abs(afterScroll - beforeScroll) };
            }, 100);
            return { success: true, direction: dir, message: `Scrolling ${dir}${amt ? ' by ' + amt + 'px' : ''}${sel ? ' to ' + sel : ''}` };
          }
        });
        const result = results[0]?.result;
        log.info("scrollPage result", result);
        return result || { success: true, message: `Scrolling ${direction}` };
      } catch (error) {
        log.error('[FrontendTool] Error scrolling page:', error);
        return { error: "Failed to scroll page. Make sure you have permission to access this page." };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        const scrollInfo = args.direction === "to-element" && args.selector
          ? `to ${args.selector}`
          : args.amount ? `${args.direction} ${args.amount}px` : args.direction;
        return <ToolCard title="Scrolling Page" subtitle={scrollInfo} state="loading" icon="📜" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Scroll Failed" subtitle={result.error} state="error" icon="📜" />;
        }
        return (
          <ToolCard title="Page Scrolled" subtitle={result.message || `Scrolled ${result.direction}`} state="success" icon="📜">
            {result.scrollDistance !== undefined && (
              <Badge label={`${result.scrollDistance}px`} variant="success" />
            )}
          </ToolCard>
        );
      }
      return null;
    },
  });

  useFrontendTool({
    name: "fillInput",
    description: "Fill a text input, textarea, or form field on the page.",
    parameters: [
      { name: "selector", type: "string", description: "CSS selector or placeholder/name", required: true },
      { name: "value", type: "string", description: "Text value to fill", required: true }
    ],
    handler: async ({ selector, value }) => {
      if (!shouldProcess("fillInput", { selector, value })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.info("fillInput", { selector, length: value?.length });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) return { error: "No active tab" };
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [selector, value],
          func: (sel: string, val: string) => {
            let input = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement;
            if (!input) {
              const allInputs = Array.from(document.querySelectorAll('input, textarea')) as (HTMLInputElement | HTMLTextAreaElement)[];
              input = allInputs.find(inp => inp.placeholder?.toLowerCase().includes(sel.toLowerCase()) || inp.getAttribute('aria-label')?.toLowerCase().includes(sel.toLowerCase()) || inp.name?.toLowerCase().includes(sel.toLowerCase())) as HTMLInputElement | HTMLTextAreaElement;
            }
            if (!input) return { success: false, error: `Input field not found: ${sel}`, suggestion: "Try a different selector, placeholder text, or field name" };
            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, field: { tagName: input.tagName, name: input.name, id: input.id, placeholder: input.placeholder }, filledWith: val.slice(0, 50) + (val.length > 50 ? '...' : '') };
          }
        });
        const result = results[0]?.result;
        if (result?.success) log.info("fillInput success", result.field);
        return result || { error: "Failed to fill input" };
      } catch (error) {
        const errorMsg = (error as Error)?.message || String(error);

        // Don't retry if frame was removed (page is navigating)
        if (errorMsg.includes('Frame with ID') || errorMsg.includes('was removed')) {
          log.warn('[FrontendTool] Frame removed during fillInput - page may be navigating', { selector });
          return { error: "Page is navigating - action cancelled to prevent loops", frameRemoved: true };
        }

        log.error('[FrontendTool] Error filling input:', error);
        return { error: "Failed to fill input field. Make sure you have permission to access this page." };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Filling Input" subtitle={args.selector} state="loading" icon="✍️" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return (
            <ToolCard title="Fill Failed" subtitle={result.error} state="error" icon="✍️">
              {result.suggestion && <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>{result.suggestion}</div>}
            </ToolCard>
          );
        }
        const maskedValue = result.filledWith?.includes('password') || args.selector?.includes('password')
          ? '••••••'
          : result.filledWith;
        return (
          <ToolCard title="Input Filled" subtitle={`Field: ${result.field?.placeholder || result.field?.name || args.selector}`} state="success" icon="✍️">
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              <Badge label={result.field?.tagName || 'INPUT'} variant="default" />
              {maskedValue && <div style={{ marginTop: '4px', opacity: 0.7 }}>Value: {maskedValue}</div>}
            </div>
          </ToolCard>
        );
      }
      return null;
    },
  });

  useFrontendTool({
    name: "focusElement",
    description: "Focus an element by selector.",
    parameters: [
      { name: "selector", type: "string", description: "Element selector", required: true }
    ],
    handler: async ({ selector }) => {
      if (!shouldProcess("focusElement", { selector })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.debug("focusElement", { selector });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) return { error: "No active tab" };
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [selector],
          func: (sel: string) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (!el) return { success: false, error: `Element not found: ${sel}` };
            el.focus();
            return { success: true };
          }
        });
        return results[0]?.result || { error: "No result" };
      } catch (error) {
        log.error('[FrontendTool] Error focusing element:', error);
        return { error: "Failed to focus element" };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Focusing Element" subtitle={args.selector} state="loading" icon="🎯" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Focus Failed" subtitle={result.error} state="error" icon="🎯" />;
        }
        return <ToolCard title="Element Focused" subtitle={args.selector} state="success" icon="🎯" />;
      }
      return null;
    },
  });

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

  // ===========================
  // Advanced Interaction Actions
  // ===========================

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
        if (!tab.id) return { error: "No active tab" };

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

            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            return { success: true, fieldId: input.id || input.name };
          }
        });

        return results[0]?.result || { error: "Failed to fill field" };
      } catch (error) {
        log.error('[FrontendTool] Error filling by label:', error);
        return { error: "Failed to fill field by label" };
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
        if (!tab.id) return { error: "No active tab" };

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

            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            return { success: true, fieldId: input.id || input.name };
          }
        });

        return results[0]?.result || { error: "Failed to fill field" };
      } catch (error) {
        log.error('[FrontendTool] Error filling by placeholder:', error);
        return { error: "Failed to fill field by placeholder" };
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

  // ===========================
  // Search Results Extraction
  // ===========================

  useFrontendTool({
    name: "getSearchResults",
    description: "Parse current Google/Bing search results page and return a structured ranked list with metadata (title, href, hostname, snippet). Use this after navigating to a search engine to intelligently select which result to open.",
    parameters: [
      { name: "maxResults", type: "number", description: "Maximum number of results to return (default 10)", required: false }
    ],
    handler: async ({ maxResults = 10 }) => {
      if (!shouldProcess("getSearchResults", { maxResults })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.info("getSearchResults", { maxResults });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return { error: "No active tab" };

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [maxResults],
          func: (limit: number) => {
            const url = location.href;

            const normalize = (href: string) => {
              try {
                const u = new URL(href);
                return {
                  href: u.href,
                  hostname: u.hostname.replace(/^www\./i, ""),
                  path: u.pathname,
                };
              } catch {
                return { href, hostname: "", path: "" };
              }
            };

            const items: Array<{
              rank: number;
              title: string;
              href: string;
              hostname: string;
              path: string;
              snippet?: string;
            }> = [];

            // Google SERP
            if (url.includes("google.")) {
              // Primary web results typically have an h3 with a containing anchor
              const blocks = Array.from(document.querySelectorAll("#search h3"));
              for (const [i, h3] of blocks.entries()) {
                if (items.length >= limit) break;
                const a = h3.closest("a") as HTMLAnchorElement | null;
                if (!a || !a.href) continue;
                const { href, hostname, path } = normalize(a.href);

                // Skip Google internal links
                if (hostname.includes("google.")) continue;

                const snippetEl =
                  h3.closest("div.g")?.querySelector(".VwiC3b, .Uroaid, .g7W9Dc") ||
                  h3.parentElement?.parentElement?.querySelector(".VwiC3b");
                const snippet = snippetEl?.textContent?.trim();
                items.push({
                  rank: items.length + 1,
                  title: h3.textContent?.trim() || a.textContent?.trim() || "",
                  href,
                  hostname,
                  path,
                  snippet,
                });
              }

              // Fallback if structure changes: collect visible anchors with h3 children
              if (items.length === 0) {
                const anchors = Array.from(document.querySelectorAll("#search a[href] h3"))
                  .map((h3) => h3.parentElement as HTMLAnchorElement)
                  .filter(Boolean) as HTMLAnchorElement[];
                anchors.slice(0, limit).forEach((a) => {
                  const { href, hostname, path } = normalize(a.href);
                  if (hostname.includes("google.")) return;
                  items.push({
                    rank: items.length + 1,
                    title: a.textContent?.trim() || "",
                    href,
                    hostname,
                    path,
                  });
                });
              }
            }

            // Bing SERP
            if (url.includes("bing.")) {
              const blocks = Array.from(document.querySelectorAll("li.b_algo h2 a"));
              for (const [i, a] of blocks.entries()) {
                if (items.length >= limit) break;
                const { href, hostname, path } = normalize((a as HTMLAnchorElement).href);
                if (hostname.includes("bing.")) continue;

                const snippetEl = (a as HTMLElement).closest("li.b_algo")?.querySelector(".b_caption p");
                items.push({
                  rank: items.length + 1,
                  title: a.textContent?.trim() || "",
                  href,
                  hostname,
                  path,
                  snippet: snippetEl?.textContent?.trim(),
                });
              }
            }

            return {
              success: true,
              engine: url.includes("bing.") ? "bing" : url.includes("google.") ? "google" : "unknown",
              count: items.length,
              results: items
            };
          }
        });

        const result = results[0]?.result;
        if (result?.success) {
          log.info("getSearchResults success", { engine: result.engine, count: result.count });
        } else {
          log.warn("getSearchResults failed", result);
        }
        return result || { error: "No result" };
      } catch (error) {
        log.error('[FrontendTool] Error parsing search results:', error);
        return { error: `Failed to parse search results: ${(error as Error).message}` };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Parsing Search Results" subtitle={`Extracting up to ${args.maxResults || 10} results`} state="loading" icon="🔍" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Parse Failed" subtitle={result.error} state="error" icon="🔍" />;
        }
        return (
          <ToolCard
            title="Search Results Parsed"
            subtitle={`${result.count} results from ${result.engine}`}
            state="success"
            icon="🔍"
          >
            <div style={{ fontSize: '12px', marginTop: '8px' }}>
              <Badge label={`${result.count} results`} variant="success" />
              {result.results && result.results.length > 0 && (
                <details className="tool-details" style={{ marginTop: '8px' }}>
                  <summary>View top {Math.min(5, result.results.length)} results</summary>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>
                    {result.results.slice(0, 5).map((r: any, idx: number) => (
                      <div key={idx} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ fontWeight: 'bold' }}>#{r.rank}: {r.title}</div>
                        <div style={{ opacity: 0.7, fontSize: '10px' }}>{r.hostname}{r.path}</div>
                        {r.snippet && <div style={{ opacity: 0.6, marginTop: '2px' }}>{r.snippet.substring(0, 100)}...</div>}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </ToolCard>
        );
      }
      return null;
    },
  });

  useFrontendTool({
    name: "openSearchResult",
    description: "Open a specific search result by rank (1-based index) from the current Google/Bing search results page. Must be called after getSearchResults to ensure results are available.",
    parameters: [
      { name: "rank", type: "number", description: "1-based rank of the result to open", required: true }
    ],
    handler: async ({ rank }) => {
      if (!shouldProcess("openSearchResult", { rank })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.info("openSearchResult", { rank });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return { error: "No active tab" };

        const res = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [rank],
          func: (r: number) => {
            const url = location.href;
            const normalize = (href: string) => {
              try {
                const u = new URL(href);
                return u.href;
              } catch {
                return href;
              }
            };

            // Google SERP
            if (url.includes("google.")) {
              const h3s = Array.from(document.querySelectorAll("#search h3"));
              let validIndex = 0;
              for (const h3 of h3s) {
                const a = h3.closest("a") as HTMLAnchorElement | null;
                if (!a || !a.href) continue;
                const href = normalize(a.href);
                if (href.includes("google.")) continue;
                validIndex++;
                if (validIndex === r) {
                  return { href, title: h3.textContent?.trim() };
                }
              }
            }

            // Bing SERP
            if (url.includes("bing.")) {
              const anchors = Array.from(document.querySelectorAll("li.b_algo h2 a")) as HTMLAnchorElement[];
              let validIndex = 0;
              for (const a of anchors) {
                const href = normalize(a.href);
                if (href.includes("bing.")) continue;
                validIndex++;
                if (validIndex === r) {
                  return { href, title: a.textContent?.trim() };
                }
              }
            }

            return null;
          }
        });

        const data = res[0]?.result as { href: string; title: string } | null;
        if (!data?.href) {
          log.warn("openSearchResult: No result at rank", { rank });
          return { error: `No result found at rank ${rank}` };
        }

        log.info("openSearchResult: Navigating to", { rank, href: data.href, title: data.title });
        await chrome.tabs.update(tab.id, { url: data.href });
        return { success: true, rank, url: data.href, title: data.title };
      } catch (error) {
        log.error('[FrontendTool] Error opening search result:', error);
        return { error: `Failed to open search result: ${(error as Error).message}` };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Opening Search Result" subtitle={`Rank #${args.rank}`} state="loading" icon="🔗" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Open Failed" subtitle={result.error} state="error" icon="🔗" />;
        }
        return (
          <ToolCard
            title="Search Result Opened"
            subtitle={result.title || result.url}
            state="success"
            icon="🔗"
          >
            <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>
              Rank #{result.rank}: {result.url}
            </div>
          </ToolCard>
        );
      }
      return null;
    },
  });
}
