import React, { createContext, useContext, useEffect, useState } from 'react';

export interface WindowVisibilityContextType {
    isUserAway: boolean;
}

export const WindowVisibilityContext = createContext<WindowVisibilityContextType | undefined>(undefined);

export const WindowVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isUserAway, setIsUserAway] = useState(false);

    useEffect(() => {
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
            if (isHidden) {
                // Sidepanel is closed/hidden - notify content scripts
                chrome.windows.getCurrent((window) => {
                    if (window.id) {
                        chrome.tabs.query({ windowId: window.id }, (tabs) => {
                            tabs.forEach((tab) => {
                                if (tab.id) {
                                    chrome.tabs.sendMessage(tab.id, { action: 'SIDEBAR_CLOSED' })
                                        .catch(() => {
                                            // Ignore errors if content script not loaded
                                        });
                                }
                            });
                        });
                    }
                });
            }
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
            });
        } else {
            // Fallback to only document visibility if Chrome Windows API unavailable
            console.warn('Chrome Windows API not available, using only document visibility');
            document.addEventListener('visibilitychange', handleVisibilityChange);

            // Set initial state
            if (document.visibilityState === 'hidden') {
                setIsUserAway(true);
            }
        }

        // Cleanup listeners on unmount
        return () => {
            if (chrome?.windows?.onFocusChanged) {
                chrome.windows.onFocusChanged.removeListener(handleWindowFocusChanged);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
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
