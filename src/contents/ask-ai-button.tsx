import type { PlasmoCSConfig } from "plasmo";
import { useEffect, useState, useRef } from "react";
import cssText from "data-text:~/styles/ask-ai-button.css";
import { SparklesIcon } from "@assets/icons/ui/star";
import { TrashZone, getStyle as getTrashZoneStyle } from "~components/ui/trash-zone";
import { EyeOff, Clock, XCircle } from "lucide-react";
import {
    shouldShowButton,
    hideForCurrentPage,
    hideForSession,
    hideForever,
} from "~utils/ask-ai-button-visibility";

export const config: PlasmoCSConfig = {
    matches: ["<all_urls>"],
    all_frames: false,
};

export const getStyle = () => {
    const style = document.createElement("style");
    const trashZoneStyle = getTrashZoneStyle();
    style.textContent = cssText + "\n" + trashZoneStyle.textContent;
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
    const [showTrashZone, setShowTrashZone] = useState(false);
    const [isOverTrash, setIsOverTrash] = useState(false);
    const [isButtonNear, setIsButtonNear] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const buttonRef = useRef<HTMLDivElement>(null);
    const dragOffset = useRef({ x: 0, y: 0 });
    const hasDragged = useRef(false);
    const dragStartPosition = useRef<Position | null>(null);

    // Load saved position and check visibility settings on mount
    useEffect(() => {
        (async () => {
            // Check if button should be visible based on visibility settings
            const shouldShow = await shouldShowButton();

            if (!shouldShow) {
                console.log("[AskAI] Button hidden based on visibility settings");
                setIsVisible(false);
                return; // Don't continue if button should be hidden
            }

            // Load saved position from storage
            chrome.storage.local.get(["askAiButtonPosition"], (result) => {
                if (result.askAiButtonPosition) {
                    setPosition(result.askAiButtonPosition);
                }
            });

            // Check if sidebar is already open
            chrome.runtime.sendMessage({ action: "CHECK_SIDEBAR_STATUS" }, (response) => {
                // Ignore errors (e.g. if no listener responds)
                if (chrome.runtime.lastError) return;

                if (response && response.isOpen) {
                    setIsVisible(false);
                }
            });
        })();
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
        if (hasDragged.current) {
            hasDragged.current = false;
            return; // Don't open if just finished dragging
        }
        console.log("[AskAI] Button clicked, sending OPEN_SIDEBAR message");
        chrome.runtime.sendMessage({ action: "OPEN_SIDEBAR" });
    };



    // Handle menu option selection
    const handleMenuSelect = async (action: 'page' | 'session' | 'forever') => {
        console.log(`[AskAI] Menu action selected: ${action}`);

        // Hide the button immediately
        setIsVisible(false);

        // Execute the appropriate action
        switch (action) {
            case 'page':
                await hideForCurrentPage();
                console.log('[AskAI] Hidden for current page');
                break;
            case 'session':
                await hideForSession();
                console.log('[AskAI] Hidden for session');
                break;
            case 'forever':
                await hideForever();
                console.log('[AskAI] Hidden permanently');
                break;
        }

        // Clean up
        setShowMenu(false);
        setIsOverTrash(false);
        setIsButtonNear(false);
    };

    // Handle cancel - return button to bottom-right
    const handleCancel = () => {
        console.log('[AskAI] Cancel - returning to original position');
        setShowMenu(false);
        setIsOverTrash(false);
        setIsButtonNear(false);

        // Reset to default bottom-right position
        setPosition(null);
        chrome.storage.local.remove('askAiButtonPosition');
    };

    // Trash zone callbacks
    const handleButtonEnterTrash = () => {
        console.log('[AskAI] Button entered trash zone');
    };

    const handleButtonLeaveTrash = () => {
        console.log('[AskAI] Button left trash zone');
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

            // Store the starting position for drag threshold
            dragStartPosition.current = {
                x: rect.left,
                y: rect.top,
            };
        }

        hasDragged.current = false;
        setIsDragging(true);
        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;

        hasDragged.current = true; // Mark that dragging occurred

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

        // Show trash zone after moving a bit (threshold: 10px)
        if (dragStartPosition.current) {
            const distanceMoved = Math.sqrt(
                Math.pow(newX - dragStartPosition.current.x, 2) +
                Math.pow(newY - dragStartPosition.current.y, 2)
            );

            if (distanceMoved > 10 && !showTrashZone) {
                setShowTrashZone(true);
            }
        }

        // Calculate trash zone position (bottom-center)
        const trashPosition: Position = {
            x: window.innerWidth / 2,
            y: window.innerHeight - 40,
        };

        // Calculate button center position (button position is top-left corner)
        const buttonWidth = buttonRef.current?.offsetWidth || 120;
        const buttonHeight = buttonRef.current?.offsetHeight || 48;
        const buttonCenter: Position = {
            x: constrainedPosition.x + buttonWidth / 2,
            y: constrainedPosition.y + buttonHeight / 2,
        };

        // Calculate distance from button center to trash zone center
        const distance = Math.sqrt(
            Math.pow(buttonCenter.x - trashPosition.x, 2) +
            Math.pow(buttonCenter.y - trashPosition.y, 2)
        );

        // Update proximity states
        const near = distance < 150; // Near threshold
        const over = distance < 80;  // Over threshold

        setIsButtonNear(near);

        if (over && !isOverTrash) {
            setIsOverTrash(true);
        } else if (!over && isOverTrash) {
            setIsOverTrash(false);
        }
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);

            // Check if button was over trash when released
            if (isOverTrash) {
                // Show menu, hide trash zone
                setShowMenu(true);
                setShowTrashZone(false);
                setIsButtonNear(false);
            } else {
                // Just hide trash zone
                setShowTrashZone(false);
                setIsOverTrash(false);
                setIsButtonNear(false);

                // Save position to storage if dragged
                if (hasDragged.current && position) {
                    chrome.storage.local.set({ askAiButtonPosition: position });
                }
            }

            // Reset drag start position
            dragStartPosition.current = null;
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

    // Get button center position for trash zone calculations
    const getButtonCenterPosition = (): Position => {
        if (!position || !buttonRef.current) {
            return { x: 0, y: 0 };
        }
        const buttonWidth = buttonRef.current.offsetWidth || 120;
        const buttonHeight = buttonRef.current.offsetHeight || 48;
        return {
            x: position.x + buttonWidth / 2,
            y: position.y + buttonHeight / 2,
        };
    };

    // Build button classes based on state
    const getButtonClasses = () => {
        const classes = ['ask-ai-button'];
        classes.push(isVisible ? 'visible' : 'hidden');
        if (isDragging) {
            classes.push('dragging');
            if (isButtonNear) classes.push('near-trash');
            if (isOverTrash) classes.push('over-trash');
        }
        return classes.join(' ');
    };

    return (
        <>
            {/* Ask AI Button - hidden when menu is showing */}
            {!showMenu && (
                <div
                    ref={buttonRef}
                    className={getButtonClasses()}
                    style={buttonStyle}
                    onClick={handleClick}
                    onMouseDown={handleMouseDown}
                    role="button"
                    tabIndex={0}
                    aria-label="Ask AI Assistant"
                    title="Ask AI (Ctrl+Shift+H)"
                >
                    <SparklesIcon className="ask-ai-icon" size={16} />
                    <span className="ask-ai-text">Ask AI</span>
                </div>
            )}



            {/* Trash Zone - only show when dragging and menu is not shown */}
            {showTrashZone && !showMenu && (
                <TrashZone
                    isVisible={showTrashZone}
                    isButtonNear={isButtonNear}
                    isButtonOver={isOverTrash}
                    buttonPosition={getButtonCenterPosition()}
                    onButtonEnter={handleButtonEnterTrash}
                    onButtonLeave={handleButtonLeaveTrash}
                />
            )}

            {/* Floating Menu Options - appears when button is dropped in trash */}
            {showMenu && (
                <div
                    className="floating-menu-container"
                    style={{
                        position: 'fixed',
                        left: '50%',
                        bottom: '80px',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        zIndex: 2147483645,
                        pointerEvents: 'auto',
                        alignItems: 'center',
                    }}
                >
                    {/* Three buttons side by side */}
                    <div
                        style={{
                            display: 'flex',
                            gap: '12px',
                        }}
                    >
                        <button
                            onClick={() => handleMenuSelect('page')}
                            className="menu-option-button"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '16px 20px',
                                background: 'rgba(30, 30, 30, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '13px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                backdropFilter: 'blur(12px)',
                                whiteSpace: 'nowrap',
                                minWidth: '120px',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(50, 50, 50, 0.95)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(30, 30, 30, 0.95)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <EyeOff size={20} />
                            <span>Hide for this page</span>
                        </button>

                        <button
                            onClick={() => handleMenuSelect('session')}
                            className="menu-option-button"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '16px 20px',
                                background: 'rgba(30, 30, 30, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '13px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                backdropFilter: 'blur(12px)',
                                whiteSpace: 'nowrap',
                                minWidth: '120px',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(50, 50, 50, 0.95)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(30, 30, 30, 0.95)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <Clock size={20} />
                            <span>Hide for session</span>
                        </button>

                        <button
                            onClick={() => handleMenuSelect('forever')}
                            className="menu-option-button"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '16px 20px',
                                background: 'rgba(30, 30, 30, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '13px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                backdropFilter: 'blur(12px)',
                                whiteSpace: 'nowrap',
                                minWidth: '120px',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(50, 50, 50, 0.95)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(30, 30, 30, 0.95)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <XCircle size={20} />
                            <span>Never show again</span>
                        </button>
                    </div>

                    {/* Cancel button below */}
                    <button
                        onClick={handleCancel}
                        className="menu-cancel-button"
                        style={{
                            padding: '10px 32px',
                            background: 'rgba(60, 60, 60, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '8px',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            backdropFilter: 'blur(12px)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(80, 80, 80, 0.95)';
                            e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(60, 60, 60, 0.95)';
                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                        }}
                    >
                        Cancel
                    </button>
                </div>
            )}
        </>
    );
};

export default AskAIButton;
