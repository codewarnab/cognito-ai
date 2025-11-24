import { useEffect } from "react";
import { z } from "zod";
import { createLogger } from '~logger';
import { registerTool } from "@ai/tools";
import { useToolUI } from "@ai/tools/components";

const log = createLogger("Actions-Interactions-Click");

export function useClickElementTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering clickElement tool...');

        registerTool({
            name: "clickElement",
            description: "Click an element on the active page by selector, text, or aria-label.",
            parameters: z.object({
                selector: z.string().describe("CSS selector or text/aria-label"),
            }),
            execute: async ({ selector }) => {
                try {
                    log.info("TOOL CALL: clickElement", { selector });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab || !tab.id) return { error: "No active tab" };
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [selector],
                        func: (sel: string) => {
                            // Track animations and cleanup
                            (window as any).__aiClickAnimations = (window as any).__aiClickAnimations || 0;
                            (window as any).__aiClickResizeHandler = (window as any).__aiClickResizeHandler || null;

                            function scheduleCanvasCleanup() {
                                if ((window as any).__aiClickCleanupTimer) {
                                    clearTimeout((window as any).__aiClickCleanupTimer);
                                }
                                (window as any).__aiClickCleanupTimer = setTimeout(() => {
                                    if ((window as any).__aiClickAnimations === 0) {
                                        const canvas = document.getElementById('ai-click-spark-canvas');
                                        if (canvas) canvas.remove();
                                        const style = document.getElementById('ai-ripple-click-style');
                                        if (style) style.remove();
                                        if ((window as any).__aiClickResizeHandler) {
                                            window.removeEventListener('resize', (window as any).__aiClickResizeHandler);
                                            (window as any).__aiClickResizeHandler = null;
                                        }
                                    }
                                }, 3000);
                            }

                            // Click Animation with ClickSpark + Ripple Fallback
                            async function showClickAnimation(x: number, y: number): Promise<void> {
                                try {
                                    (window as any).__aiClickAnimations++;

                                    // Try ClickSpark animation
                                    let canvas = document.getElementById('ai-click-spark-canvas') as HTMLCanvasElement | null;

                                    if (!canvas) {
                                        canvas = document.createElement('canvas');
                                        canvas.id = 'ai-click-spark-canvas';
                                        canvas.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647;';
                                        canvas.width = window.innerWidth;
                                        canvas.height = window.innerHeight;
                                        document.body.appendChild(canvas);

                                        if (!(window as any).__aiClickResizeHandler) {
                                            (window as any).__aiClickResizeHandler = () => {
                                                const c = document.getElementById('ai-click-spark-canvas') as HTMLCanvasElement;
                                                if (c) {
                                                    c.width = window.innerWidth;
                                                    c.height = window.innerHeight;
                                                }
                                            };
                                            window.addEventListener('resize', (window as any).__aiClickResizeHandler);
                                        }
                                    }

                                    const ctx = canvas.getContext('2d');
                                    if (!ctx) throw new Error('No canvas context');

                                    const config = {
                                        sparkColor: '#FFD700',
                                        sparkSize: 10,
                                        sparkRadius: 15,
                                        sparkCount: 8,
                                        duration: 400
                                    };

                                    const ease = (t: number) => t * (2 - t); // ease-out

                                    const now = performance.now();
                                    const sparks = Array.from({ length: config.sparkCount }, (_, i) => ({
                                        x: x,
                                        y: y,
                                        angle: (2 * Math.PI * i) / config.sparkCount,
                                        startTime: now
                                    }));

                                    function animate(timestamp: number): void {
                                        if (!ctx || !canvas) return;

                                        ctx.clearRect(0, 0, canvas.width, canvas.height);

                                        let activeSparks = 0;

                                        for (const spark of sparks) {
                                            const elapsed = timestamp - spark.startTime;
                                            if (elapsed >= config.duration) continue;

                                            activeSparks++;

                                            const progress = elapsed / config.duration;
                                            const eased = ease(progress);

                                            const distance = eased * config.sparkRadius;
                                            const lineLength = config.sparkSize * (1 - eased);

                                            const x1 = spark.x + distance * Math.cos(spark.angle);
                                            const y1 = spark.y + distance * Math.sin(spark.angle);
                                            const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
                                            const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

                                            const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                                            gradient.addColorStop(0, config.sparkColor);
                                            gradient.addColorStop(1, config.sparkColor + '00');

                                            ctx.strokeStyle = gradient;
                                            ctx.lineWidth = 2;
                                            ctx.lineCap = 'round';
                                            ctx.beginPath();
                                            ctx.moveTo(x1, y1);
                                            ctx.lineTo(x2, y2);
                                            ctx.stroke();
                                        }

                                        if (activeSparks > 0) {
                                            requestAnimationFrame(animate);
                                        } else {
                                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                                            (window as any).__aiClickAnimations--;
                                            if ((window as any).__aiClickAnimations === 0) {
                                                scheduleCanvasCleanup();
                                            }
                                        }
                                    }

                                    requestAnimationFrame(animate);
                                } catch (error) {
                                    console.warn('[ClickAnimation] ClickSpark failed, using ripple fallback:', error);

                                    // Fallback: Ripple animation
                                    try {
                                        const css = `
                                            @keyframes ai-ripple-click {
                                                0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
                                                100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
                                            }
                                            .ai-ripple-click {
                                                position: fixed; width: 50px; height: 50px; border-radius: 50%;
                                                background: rgba(255, 215, 0, 0.6); border: 2px solid #FFD700;
                                                pointer-events: none; z-index: 999999;
                                                animation: ai-ripple-click 300ms ease-out forwards;
                                            }
                                        `;

                                        let style = document.getElementById('ai-ripple-click-style') as HTMLStyleElement | null;
                                        if (!style) {
                                            style = document.createElement('style');
                                            style.id = 'ai-ripple-click-style';
                                            style.textContent = css;
                                            document.head.appendChild(style);
                                        }

                                        const ripple = document.createElement('div');
                                        ripple.className = 'ai-ripple-click';
                                        ripple.style.left = x + 'px';
                                        ripple.style.top = y + 'px';
                                        document.body.appendChild(ripple);

                                        setTimeout(() => {
                                            try { ripple.remove(); } catch (e) { }
                                        }, 300);
                                    } catch (e) {
                                        console.error('[ClickAnimation] Ripple fallback also failed:', e);
                                    }
                                }
                            }

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

                            // Show animation at element center
                            const rect = element.getBoundingClientRect();
                            const x = rect.left + rect.width / 2;
                            const y = rect.top + rect.height / 2;
                            showClickAnimation(x, y);

                            (element as HTMLElement).click();
                            return { success: true, clicked: elementInfo, message: `Successfully clicked ${element.tagName}${(element as HTMLElement).id ? '#' + (element as HTMLElement).id : ''}` };
                        }
                    });
                    const result = results[0]?.result;
                    if (result?.success) log.info("✅ clickElement success", result.clicked);
                    else log.warn("❌ clickElement failed", result);
                    return result || { error: "Failed to execute click" };
                } catch (error) {
                    const errorMsg = (error as Error)?.message || String(error);

                    // Don't retry if frame was removed (page is navigating)
                    if (errorMsg.includes('Frame with ID') || errorMsg.includes('was removed')) {
                        log.warn('[Tool] Frame removed during click - page may be navigating', { selector });
                        return { error: "Page is navigating - action cancelled to prevent loops", frameRemoved: true };
                    }

                    log.error('[Tool] Error clicking element:', error);
                    return { error: "Failed to click element. Make sure you have permission to access this page." };
                }
            },
        });

        // Using default CompactToolRenderer - no custom UI needed

        log.info('✅ clickElement tool registration complete');

        return () => {
            log.info('🧹 Cleaning up clickElement tool');
            unregisterToolUI('clickElement');
        };
    }, [registerToolUI, unregisterToolUI]);
}


