import type { PlasmoCSConfig } from "plasmo";
import { useEffect, useState, useRef } from "react";
import cssText from "data-text:~/styles/ask-ai-button.css";

export const config: PlasmoCSConfig = {
    matches: ["<all_urls>"],
    all_frames: false,
};

export const getStyle = () => {
    const style = document.createElement("style");
    style.textContent = cssText;
    return style;
};

interface Position {
    x: number;
    y: number;
}

const AskAIButton = () => {
    console.log("[AskAI] Component mounted");
    const [isVisible, setIsVisible] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState<Position | null>(null);
    const buttonRef = useRef<HTMLDivElement>(null);
    const dragOffset = useRef({ x: 0, y: 0 });

    // Load saved position from storage
    useEffect(() => {
        chrome.storage.local.get(["askAiButtonPosition"], (result) => {
            if (result.askAiButtonPosition) {
                setPosition(result.askAiButtonPosition);
            }
        });
    }, []);

    // Listen for sidebar state changes
    useEffect(() => {
        const handleMessage = (message: any) => {
            if (message.action === "SIDEBAR_OPENED") {
                setIsVisible(false);
            } else if (message.action === "SIDEBAR_CLOSED") {
                setIsVisible(true);
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, []);

    // Handle button click - open sidebar
    const handleClick = () => {
        if (isDragging) return; // Don't open if dragging
        console.log("[AskAI] Button clicked, sending OPEN_SIDEBAR message");
        chrome.runtime.sendMessage({ action: "OPEN_SIDEBAR" });
    };

    // Drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click

        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect) {
            dragOffset.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }

        setIsDragging(true);
        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;

        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;

        // Constrain to viewport
        const maxX = window.innerWidth - (buttonRef.current?.offsetWidth || 120);
        const maxY = window.innerHeight - (buttonRef.current?.offsetHeight || 48);

        const constrainedPosition = {
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY)),
        };

        setPosition(constrainedPosition);
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);

            // Save position to storage
            if (position) {
                chrome.storage.local.set({ askAiButtonPosition: position });
            }

            // Small delay to prevent click event after drag
            setTimeout(() => {
                setIsDragging(false);
            }, 100);
        }
    };

    // Global mouse event listeners for dragging
    useEffect(() => {
        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);

            return () => {
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
            };
        }

        return undefined;
    }, [isDragging, position]);

    const buttonStyle: React.CSSProperties = position
        ? {
            left: `${position.x}px`,
            top: `${position.y}px`,
            right: "auto",
            bottom: "auto",
        }
        : {}; // Use CSS default (bottom-right)

    return (
        <div
            ref={buttonRef}
            className={`ask-ai-button ${isVisible ? "visible" : "hidden"} ${isDragging ? "dragging" : ""}`}
            style={buttonStyle}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            role="button"
            tabIndex={0}
            aria-label="Ask AI Assistant"
            title="Ask AI (Ctrl+Shift+H)"
        >
            <span className="ask-ai-icon" aria-hidden="true">
                ✨
            </span>
            <span className="ask-ai-text">Ask AI</span>
        </div>
    );
};

export default AskAIButton;
