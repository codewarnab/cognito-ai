import { useEffect, useState, useRef } from "react";
import { browser } from 'wxt/browser';
import { SparklesIcon } from "@assets/icons/ui/star";
import { TrashZone } from "@/components/ui/trash-zone";
import { EyeOff, Clock, XCircle } from "lucide-react";
import { trySendMessage } from "@/lib/messaging";
import {
    shouldShowButton,
    hideForCurrentPage,
    hideForSession,
    hideForever,
} from "@/utils/settings";
import { createLogger } from '~logger';

const log = createLogger('AskAIButton', 'CONTENT_SCRIPTS');

/** Shared style constants for menu buttons */
const MENU_BUTTON_STYLE: React.CSSProperties = {
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
};

/** Hover state handlers for menu buttons */
const menuButtonHoverHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.background = 'rgba(50, 50, 50, 0.95)';
        e.currentTarget.style.transform = 'translateY(-2px)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.background = 'rgba(30, 30, 30, 0.95)';
        e.currentTarget.style.transform = 'translateY(0)';
    },
};

/** Style for the floating menu container */
const FLOATING_MENU_CONTAINER_STYLE: React.CSSProperties = {
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
};

/** Style for the cancel button */
const CANCEL_BUTTON_STYLE: React.CSSProperties = {
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
};

/** Hover state handlers for cancel button */
const cancelButtonHoverHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.background = 'rgba(80, 80, 80, 0.95)';
        e.currentTarget.style.color = 'white';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.background = 'rgba(60, 60, 60, 0.95)';
        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
    },
};

/** Position coordinates for the floating button */
interface Position {
    x: number;
    y: number;
}

/** Message structure received from the sidebar */
interface SidebarMessage {
    action?: 'SIDEBAR_OPENED' | 'SIDEBAR_CLOSED';
    type?: string;
    tools?: unknown[];
}

/**
 * Floating AI assistant button that appears on web pages.
 * Supports drag-to-reposition and trash zone for hiding.
 *
 * @remarks
 * - Button visibility is controlled by user preferences
 * - Position persists in chrome.storage.local
 * - Supports compact mode for fullscreen scenarios
 */
const AskAIButton: React.FC = () => {
    log.debug('Component mounted');
    const [isVisible, setIsVisible] = useState(false); // Start hidden to prevent flash
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState<Position | null>(null);
    const [showTrashZone, setShowTrashZone] = useState(false);
    const [isOverTrash, setIsOverTrash] = useState(false);
    const [isButtonNear, setIsButtonNear] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isCompactMode, setIsCompactMode] = useState(false);
    const [savedPosition, setSavedPosition] = useState<Position | null>(null);
    const [isReady, setIsReady] = useState(false); // Track if position is loaded
    const buttonRef = useRef<HTMLDivElement>(null);
    const dragOffset = useRef({ x: 0, y: 0 });
    const hasDragged = useRef(false);
    const dragStartPosition = useRef<Position | null>(null);
    const isDraggingRef = useRef(false);
    const currentPositionRef = useRef<Position | null>(null);
    const rafIdRef = useRef<number | null>(null);
    const isOverTrashRef = useRef(false);

    // Load saved position and check visibility settings on mount
    useEffect(() => {
        (async () => {
            // Load saved position from storage FIRST (before showing)
            const storageResult = await new Promise<{ askAiButtonPosition?: Position }>((resolve) => {
                chrome.storage.local.get(["askAiButtonPosition"], (result) => {
                    resolve(result);
                });
            });

            if (storageResult.askAiButtonPosition) {
                setPosition(storageResult.askAiButtonPosition);
                currentPositionRef.current = storageResult.askAiButtonPosition;
            }

            // Now check if button should be visible based on visibility settings
            const shouldShow = await shouldShowButton();

            if (!shouldShow) {
                log.debug('Button hidden based on visibility settings');
                setIsVisible(false);
                setIsReady(true);
                return; // Don't continue if button should be hidden
            }

            // Check if sidebar is already open
            trySendMessage('CHECK_SIDEBAR_STATUS').then((response) => {
                if (response && response.isOpen) {
                    setIsVisible(false);
                } else {
                    setIsVisible(true);
                }
                setIsReady(true);
            }).catch(() => {
                // If we get here, button should be shown
                setIsVisible(true);
                setIsReady(true);
            });
        })();
    }, []);

    // Listen for sidebar state changes and MCP tool detection
    useEffect(() => {
        const handleMessage = (message: SidebarMessage) => {
            if (message.action === "SIDEBAR_OPENED") {
                setIsVisible(false);
            } else if (message.action === "SIDEBAR_CLOSED") {
                setIsVisible(true);
            } else if (message.type === "webmcp/tools/register" && message.tools?.length) {
                // MCP tools detected - potential logic here
            }
        };

        const runtime = (typeof browser !== 'undefined' ? browser : chrome).runtime;
        runtime.onMessage.addListener(handleMessage);

        return () => {
            runtime.onMessage.removeListener(handleMessage);
        };
    }, []);

    // Handle fullscreen changes - document listeners use standard add/removeEventListener
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFullscreen = !!(document.fullscreenElement ||
                (document as any).webkitFullscreenElement);
            /* ... same logic ... */
            if (isFullscreen) {
                setSavedPosition(position);
                setIsCompactMode(true);
                const newPos = { x: window.innerWidth - 80, y: 20 };
                setPosition(newPos);
                currentPositionRef.current = newPos;
            } else {
                setIsCompactMode(false);
                if (savedPosition === null) {
                    setPosition(null);
                    currentPositionRef.current = null;
                } else {
                    setPosition(savedPosition);
                    currentPositionRef.current = savedPosition;
                }
                setSavedPosition(null);
            }
        };

        const doc = document as any;
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        if (doc.webkitFullscreenElement !== undefined) {
            document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        }

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            if (doc.webkitFullscreenElement !== undefined) {
                document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            }
        };
    }, [position, savedPosition]);

    // Handle button click - open sidebar
    const handleClick = () => {
        if (hasDragged.current) {
            hasDragged.current = false;
            return; // Don't open if just finished dragging
        }
        log.debug('Button clicked, sending OPEN_SIDEBAR message');
        void trySendMessage('OPEN_SIDEBAR');
    };

    // Handle menu option selection
    const handleMenuSelect = async (action: 'page' | 'session' | 'forever') => {
        log.debug('Menu action selected:', action);

        // Hide the button immediately
        setIsVisible(false);

        // Execute the appropriate action
        switch (action) {
            case 'page':
                await hideForCurrentPage();
                log.debug('Hidden for current page');
                break;
            case 'session':
                await hideForSession();
                log.debug('Hidden for session');
                break;
            case 'forever':
                await hideForever();
                log.debug('Hidden permanently');
                break;
        }

        // Clean up
        setShowMenu(false);
        setIsOverTrash(false);
        setIsButtonNear(false);
    };

    // Handle cancel - return button to bottom-right
    const handleCancel = () => {
        log.debug('Cancel - returning to original position');
        setShowMenu(false);
        setIsOverTrash(false);
        setIsButtonNear(false);

        // Reset to default bottom-right position
        setPosition(null);
        currentPositionRef.current = null;
        chrome.storage.local.remove('askAiButtonPosition');
    };

    // Trash zone callbacks
    const handleButtonEnterTrash = () => {
        log.debug('Button entered trash zone');
    };

    const handleButtonLeaveTrash = () => {
        log.debug('Button left trash zone');
    };

    // Drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click

        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect && buttonRef.current) {
            // Explicitly set the current position to prevent jumping
            // and clear right/bottom to prevent stretching when left/top are set
            buttonRef.current.style.left = `${rect.left}px`;
            buttonRef.current.style.top = `${rect.top}px`;
            buttonRef.current.style.right = 'auto';
            buttonRef.current.style.bottom = 'auto';

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
        isDraggingRef.current = true;
        setIsDragging(true);
        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current) return;

        // Cancel any pending animation frame
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
        }

        // Use requestAnimationFrame for smooth 60fps updates
        rafIdRef.current = requestAnimationFrame(() => {
            hasDragged.current = true;

            const newX = e.clientX - dragOffset.current.x;
            const newY = e.clientY - dragOffset.current.y;

            // Constrain to viewport
            const maxX = window.innerWidth - (buttonRef.current?.offsetWidth || 120);
            const maxY = window.innerHeight - (buttonRef.current?.offsetHeight || 48);

            const constrainedPosition = {
                x: Math.max(0, Math.min(newX, maxX)),
                y: Math.max(0, Math.min(newY, maxY)),
            };

            // Update ref immediately for smooth visual updates
            currentPositionRef.current = constrainedPosition;

            // Apply position directly to DOM (bypass React)
            if (buttonRef.current) {
                buttonRef.current.style.left = `${constrainedPosition.x}px`;
                buttonRef.current.style.top = `${constrainedPosition.y}px`;
            }

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

            // Calculate button center position
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

            // Update proximity states (batched)
            const near = distance < 150;
            const over = distance < 80;

            // Update ref immediately for accurate drop detection
            isOverTrashRef.current = over;

            setIsButtonNear(near);
            setIsOverTrash(over);
        });
    };

    const handleMouseUp = () => {
        if (isDraggingRef.current) {
            // Cancel any pending animation frame
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }

            isDraggingRef.current = false;
            setIsDragging(false);

            // Sync React state with final position from ref
            if (currentPositionRef.current) {
                setPosition(currentPositionRef.current);
            } else if (!hasDragged.current && position === null && buttonRef.current) {
                // If we didn't drag and were in default position,
                // clear manual styles to revert to CSS class positioning
                buttonRef.current.style.removeProperty('left');
                buttonRef.current.style.removeProperty('top');
                buttonRef.current.style.removeProperty('right');
                buttonRef.current.style.removeProperty('bottom');
            }

            // Check if button was over trash when released (use ref for latest value)
            if (isOverTrashRef.current) {
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
                if (hasDragged.current && currentPositionRef.current) {
                    chrome.storage.local.set({ askAiButtonPosition: currentPositionRef.current });
                }
            }

            // Reset drag start position and refs
            dragStartPosition.current = null;
            isOverTrashRef.current = false;
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

                // Clean up any pending animation frame
                if (rafIdRef.current !== null) {
                    cancelAnimationFrame(rafIdRef.current);
                    rafIdRef.current = null;
                }
            };
        }

        return undefined;
    }, [isDragging]);

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
        if (isCompactMode) classes.push('compact-mode');
        if (isDragging) {
            classes.push('dragging');
            if (isButtonNear) classes.push('near-trash');
            if (isOverTrash) classes.push('over-trash');
        }
        return classes.join(' ');
    };

    return (
        <>
            {/* Ask AI Button - hidden when menu is showing or not ready */}
            {!showMenu && isReady && (
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
                    <SparklesIcon className="ask-ai-icon" size={isCompactMode ? 16 : 16} />
                    {!isCompactMode && <span className="ask-ai-text">Ask AI</span>}
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
                    style={FLOATING_MENU_CONTAINER_STYLE}
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
                            style={MENU_BUTTON_STYLE}
                            {...menuButtonHoverHandlers}
                        >
                            <EyeOff size={20} />
                            <span>Hide for this page</span>
                        </button>

                        <button
                            onClick={() => handleMenuSelect('session')}
                            className="menu-option-button"
                            style={MENU_BUTTON_STYLE}
                            {...menuButtonHoverHandlers}
                        >
                            <Clock size={20} />
                            <span>Hide for session</span>
                        </button>

                        <button
                            onClick={() => handleMenuSelect('forever')}
                            className="menu-option-button"
                            style={MENU_BUTTON_STYLE}
                            {...menuButtonHoverHandlers}
                        >
                            <XCircle size={20} />
                            <span>Never show again</span>
                        </button>
                    </div>

                    {/* Cancel button below */}
                    <button
                        onClick={handleCancel}
                        className="menu-cancel-button"
                        style={CANCEL_BUTTON_STYLE}
                        {...cancelButtonHoverHandlers}
                    >
                        Cancel
                    </button>
                </div>
            )}
        </>
    );
};

export default AskAIButton;
