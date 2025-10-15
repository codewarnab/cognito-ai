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
}
