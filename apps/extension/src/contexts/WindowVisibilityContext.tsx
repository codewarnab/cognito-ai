import React, { createContext, useContext, useEffect, useState } from 'react';

export interface WindowVisibilityContextType {
    isUserAway: boolean;
}

export const WindowVisibilityContext = createContext<WindowVisibilityContextType | undefined>(undefined);

export const WindowVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isUserAway, setIsUserAway] = useState(false);

    useEffect(() => {
        // Helper to notify content scripts about sidebar state
        const notifyContentScripts = (action: 'SIDEBAR_OPENED' | 'SIDEBAR_CLOSED') => {
            chrome.windows.getCurrent((window) => {
                if (window.id) {
                    chrome.tabs.query({ windowId: window.id }, (tabs) => {
                        tabs.forEach((tab) => {
                            if (tab.id) {
                                chrome.tabs.sendMessage(tab.id, { action })
                                    .catch(() => {
                                        // Ignore errors if content script not loaded
                                    });
                            }
                        });
                    });
                }
            });
        };

        // Combine Chrome Windows API with Document Visibility API for comprehensive tracking

        // Handler for Chrome Windows API focus changes
        const handleWindowFocusChanged = (windowId: number) => {
            // WINDOW_ID_NONE (-1) means all Chrome windows lost focus
            if (windowId === chrome.windows.WINDOW_ID_NONE) {
                setIsUserAway(true);
            } else {
                setIsUserAway(false);
            }
        };

        // Handler for Document Visibility API (backup detection)
        const handleVisibilityChange = () => {
            const isHidden = document.visibilityState === 'hidden';
            setIsUserAway(isHidden);

            // Notify content scripts about sidepanel visibility state
            notifyContentScripts(isHidden ? 'SIDEBAR_CLOSED' : 'SIDEBAR_OPENED');
        };

        // Check if Chrome Windows API is available (it should be in extensions)
        if (chrome?.windows?.onFocusChanged) {
            // Listen to Chrome window focus changes
            chrome.windows.onFocusChanged.addListener(handleWindowFocusChanged);

            // Also listen to document visibility as a fallback
            document.addEventListener('visibilitychange', handleVisibilityChange);

            // Initial state check
            chrome.windows.getCurrent((window) => {
                if (window.focused === false) {
                    setIsUserAway(true);
                }
                
                // Always notify opened on mount if visible
                if (document.visibilityState === 'visible') {
                    notifyContentScripts('SIDEBAR_OPENED');
                }
            });
        } else {
            // Fallback to only document visibility if Chrome Windows API unavailable
            console.warn('Chrome Windows API not available, using only document visibility');
            document.addEventListener('visibilitychange', handleVisibilityChange);

            // Set initial state
            if (document.visibilityState === 'hidden') {
                setIsUserAway(true);
            } else {
                notifyContentScripts('SIDEBAR_OPENED');
            }
        }

        // Listen for status checks from content scripts
        const handleStatusCheck = (message: any, sender: any, sendResponse: any) => {
            if (message.action === 'CHECK_SIDEBAR_STATUS') {
                // If we are receiving this message, the sidepanel is open and running
                sendResponse({ isOpen: true });
                
                // Also explicitly notify the sender tab if it's in the same window
                if (sender.tab?.id && sender.tab.windowId) {
                    chrome.windows.getCurrent((window) => {
                        if (window.id === sender.tab.windowId) {
                            chrome.tabs.sendMessage(sender.tab.id, { action: 'SIDEBAR_OPENED' });
                        }
                    });
                }
            }
        };
        chrome.runtime.onMessage.addListener(handleStatusCheck);

        // Cleanup listeners on unmount
        return () => {
            if (chrome?.windows?.onFocusChanged) {
                chrome.windows.onFocusChanged.removeListener(handleWindowFocusChanged);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            chrome.runtime.onMessage.removeListener(handleStatusCheck);
            
            // Notify closed on unmount
            notifyContentScripts('SIDEBAR_CLOSED');
        };
    }, []);

    return (
        <WindowVisibilityContext.Provider value={{ isUserAway }}>
            {children}
        </WindowVisibilityContext.Provider>
    );
};

export const useWindowVisibility = (): WindowVisibilityContextType => {
    const context = useContext(WindowVisibilityContext);
    if (context === undefined) {
        throw new Error('useWindowVisibility must be used within a WindowVisibilityProvider');
    }
    return context;
};
