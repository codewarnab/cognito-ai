import { useRef } from "react";

export function useActionHelpers() {
  const recentlyOpenedRef = useRef<Record<string, number>>({});

  const normalizeUrl = (inputUrl: string) => {
    try {
      const u = new URL(inputUrl);
      const hostname = u.hostname.replace(/^www\./i, '');
      const pathname = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
      const hashless = `${u.protocol}//${hostname}${u.port ? ':' + u.port : ''}${pathname}${u.search}`;
      return hashless.toLowerCase();
    } catch {
      return inputUrl.toLowerCase();
    }
  };

  const urlsEqual = (a?: string, b?: string) => {
    if (!a || !b) return false;
    return normalizeUrl(a) === normalizeUrl(b);
  };

  const isRecentlyOpened = (key: string, windowMs = 5000) => {
    const ts = recentlyOpenedRef.current[key];
    const now = Date.now();
    return Boolean(ts && now - ts < windowMs);
  };

  const markOpened = (key: string) => {
    recentlyOpenedRef.current[key] = Date.now();
  };

  const focusTab = async (tab: chrome.tabs.Tab) => {
    if (tab.id) {
      await chrome.tabs.update(tab.id, { active: true });
    }
    if (tab.windowId !== undefined) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
  };

  return { normalizeUrl, urlsEqual, isRecentlyOpened, markOpened, focusTab };
}

