/**
 * Click Animation Utilities
 * Provides visual feedback for click actions with fallback support
 */

// Track active animations and cleanup resources
let activeAnimations = 0;
let cleanupTimer: number | null = null;
let resizeHandler: (() => void) | null = null;
const IDLE_CLEANUP_DELAY = 3000; // 3 seconds

/**
 * Clean up canvas and event listeners when idle
 */
function scheduleCleanup(): void {
    if (cleanupTimer !== null) {
        clearTimeout(cleanupTimer);
    }

    cleanupTimer = window.setTimeout(() => {
        if (activeAnimations === 0) {
            const canvas = document.getElementById('ai-click-spark-canvas');
            if (canvas) {
                canvas.remove();
            }
            if (resizeHandler) {
                window.removeEventListener('resize', resizeHandler);
                resizeHandler = null;
            }
        }
    }, IDLE_CLEANUP_DELAY);
}

export interface ClickAnimationOptions {
    sparkColor?: string;
    sparkSize?: number;
    sparkRadius?: number;
    sparkCount?: number;
    duration?: number;
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

/**
 * Inject and show ClickSpark animation at coordinates
 * Falls back to ripple animation if ClickSpark fails
 */
export function getClickAnimationScript(options?: ClickAnimationOptions) {
    return (x: number, y: number): Promise<void> => {
        const opts = {
            sparkColor: options?.sparkColor || '#FFD700',
            sparkSize: options?.sparkSize || 10,
            sparkRadius: options?.sparkRadius || 15,
            sparkCount: options?.sparkCount || 8,
            duration: options?.duration || 400,
            easing: options?.easing || 'ease-out'
        };

        return new Promise<void>((resolve) => {
            try {
                // Try ClickSpark animation first
                showClickSpark(x, y, opts);
                resolve();
            } catch (error) {
                console.warn('[ClickAnimation] ClickSpark failed, using fallback ripple:', error);
                // Fallback to ripple animation
                showRippleFallback(x, y);
                resolve();
            }
        });

        function showClickSpark(
            clickX: number,
            clickY: number,
            config: {
                sparkColor: string;
                sparkSize: number;
                sparkRadius: number;
                sparkCount: number;
                duration: number;
                easing: string;
            }
        ): void {
            // Track active animation
            activeAnimations++;

            // Check if canvas already exists
            let canvas = document.getElementById('ai-click-spark-canvas') as HTMLCanvasElement;

            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.id = 'ai-click-spark-canvas';
                canvas.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    pointer-events: none;
                    z-index: 2147483647;
                `;
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                document.body.appendChild(canvas);

                // Handle window resize (register once)
                if (!resizeHandler) {
                    resizeHandler = () => {
                        const c = document.getElementById('ai-click-spark-canvas') as HTMLCanvasElement;
                        if (c) {
                            c.width = window.innerWidth;
                            c.height = window.innerHeight;
                        }
                    };
                    window.addEventListener('resize', resizeHandler);
                }
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Failed to get canvas context');
            }

            interface Spark {
                x: number;
                y: number;
                angle: number;
                startTime: number;
            }

            // Easing function
            function ease(t: number, type: string): number {
                switch (type) {
                    case 'linear':
                        return t;
                    case 'ease-in':
                        return t * t;
                    case 'ease-in-out':
                        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                    case 'ease-out':
                    default:
                        return t * (2 - t);
                }
            }

            // Create sparks
            const now = performance.now();
            const sparks: Spark[] = Array.from({ length: config.sparkCount }, (_, i) => ({
                x: clickX,
                y: clickY,
                angle: (2 * Math.PI * i) / config.sparkCount,
                startTime: now
            }));

            function animate(timestamp: number): void {
                if (!ctx) return;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                let activeSparks = 0;

                for (const spark of sparks) {
                    const elapsed = timestamp - spark.startTime;
                    if (elapsed >= config.duration) {
                        continue;
                    }

                    activeSparks++;

                    const progress = elapsed / config.duration;
                    const eased = ease(progress, config.easing);

                    const distance = eased * config.sparkRadius;
                    const lineLength = config.sparkSize * (1 - eased);

                    const x1 = spark.x + distance * Math.cos(spark.angle);
                    const y1 = spark.y + distance * Math.sin(spark.angle);
                    const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
                    const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

                    // Draw spark with gradient
                    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                    gradient.addColorStop(0, config.sparkColor);
                    gradient.addColorStop(1, config.sparkColor + '00'); // Transparent

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
                    // Clean up when animation is done
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    activeAnimations--;
                    if (activeAnimations === 0) {
                        scheduleCleanup();
                    }
                }
            }

            requestAnimationFrame(animate);
        }

        function showRippleFallback(clickX: number, clickY: number): void {
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

                let style = document.getElementById('ai-ripple-click-style') as HTMLStyleElement;
                if (!style) {
                    style = document.createElement('style');
                    style.id = 'ai-ripple-click-style';
                    style.textContent = css;
                    document.head.appendChild(style);
                }

                const ripple = document.createElement('div');
                ripple.className = 'ai-ripple-click';
                ripple.style.left = `${clickX}px`;
                ripple.style.top = `${clickY}px`;
                document.body.appendChild(ripple);

                setTimeout(() => {
                    try {
                        ripple.remove();
                    } catch (e) {
                        console.warn('[ClickAnimation] Failed to remove ripple:', e);
                    }
                }, 300);
            } catch (e) {
                console.error('[ClickAnimation] Ripple fallback also failed:', e);
            }
        }
    };
}

/**
 * Simplified version for direct injection into page scripts
 * Returns the function as a string to be injected
 */
export function getClickAnimationInjectScript(): string {
    return `
async function showClickAnimation(x, y) {
    try {
        // Try ClickSpark animation
        let canvas = document.getElementById('ai-click-spark-canvas');
        
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'ai-click-spark-canvas';
            canvas.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647;';
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            document.body.appendChild(canvas);

            window.addEventListener('resize', () => {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            });
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

        const ease = (t) => t * (2 - t); // ease-out

        const now = performance.now();
        const sparks = Array.from({ length: config.sparkCount }, (_, i) => ({
            x: x,
            y: y,
            angle: (2 * Math.PI * i) / config.sparkCount,
            startTime: now
        }));

        function animate(timestamp) {
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
            }
        }

        requestAnimationFrame(animate);
    } catch (error) {
        console.warn('[ClickAnimation] ClickSpark failed, using ripple fallback:', error);
        
        // Fallback: Ripple animation
        try {
            const css = \`
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
            \`;
            
            let style = document.getElementById('ai-ripple-click-style');
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
`;
}
