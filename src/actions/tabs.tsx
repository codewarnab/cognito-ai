import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../logger";
import { useActionHelpers } from "./useActionHelpers";
import { shouldProcess } from "./useActionDeduper";
import { ToolCard, ResultList } from "../components/ui/ToolCard";

export function registerTabActions() {
  const log = createLogger("Actions-Tabs");
  const { normalizeUrl, urlsEqual, isRecentlyOpened, markOpened, focusTab } = useActionHelpers();

  useFrontendTool({
    name: "getActiveTab",
    description: "Get information about the currently active browser tab",
    parameters: [],
    handler: async () => {
      if (!shouldProcess("getActiveTab", {})) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.debug("getActiveTab invoked");
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return { title: tab.title, url: tab.url, id: tab.id };
      } catch (error) {
        log.error('[FrontendTool] Error getting active tab:', error);
        return { error: "Failed to get active tab info" };
      }
    },
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Getting Active Tab" state="loading" icon="🔍" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Failed to Get Tab" subtitle={result.error} state="error" icon="🔍" />;
        }
        return (
          <ToolCard title="Active Tab" state="success" icon="🔍">
            <div style={{ fontSize: '13px' }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>{result.title || 'Untitled'}</div>
              <div style={{ opacity: 0.7, wordBreak: 'break-all', fontSize: '12px' }}>{result.url}</div>
            </div>
          </ToolCard>
        );
      }
      return null;
    },
  });

  useFrontendTool({
    name: "searchTabs",
    description: "Search through all open browser tabs by title or URL",
    parameters: [
      { name: "query", type: "string", description: "Search query to match against tab titles and URLs", required: true }
    ],
    handler: async ({ query }) => {
      if (!shouldProcess("searchTabs", { query })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.debug("searchTabs", { query });
        const tabs = await chrome.tabs.query({});
        const q = String(query || '').toLowerCase();
        const matchingTabs = tabs.filter(tab => tab.title?.toLowerCase().includes(q) || tab.url?.toLowerCase().includes(q));
        return { found: matchingTabs.length, tabs: matchingTabs.map(t => ({ id: t.id, title: t.title, url: t.url })) };
      } catch (error) {
        log.error('[FrontendTool] Error searching tabs:', error);
        return { error: "Failed to search tabs" };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Searching Tabs" subtitle={`Query: "${args.query}"`} state="loading" icon="🔎" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Search Failed" subtitle={result.error} state="error" icon="🔎" />;
        }
        return (
          <ToolCard title="Tab Search Results" subtitle={`Found ${result.found} tab(s)`} state="success" icon="🔎">
            {result.tabs && result.tabs.length > 0 && (
              <ResultList items={result.tabs} />
            )}
          </ToolCard>
        );
      }
      return null;
    },
  });

  useFrontendTool({
    name: "openTab",
    description: "Open a URL. If a tab with the same URL already exists anywhere, switch to that tab instead of opening a duplicate.",
    parameters: [
      { name: "url", type: "string", description: "The URL to open in a new tab", required: true }
    ],
    handler: async ({ url }) => {
      if (!shouldProcess("openTab", { url })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.info("openTab", { url });
        const key = normalizeUrl(url);
        if (isRecentlyOpened(key)) {
          const recentTabs = await chrome.tabs.query({});
          const recentExisting = recentTabs.find(t => urlsEqual(t.url || '', url));
          if (recentExisting) {
            await focusTab(recentExisting);
            return { success: true, reused: true, tabId: recentExisting.id, url: recentExisting.url };
          }
        }
        const allTabs = await chrome.tabs.query({});
        const existing = allTabs.find(t => urlsEqual(t.url || '', url));
        if (existing) {
          await focusTab(existing);
          return { success: true, reused: true, tabId: existing.id, url: existing.url };
        }
        const tab = await chrome.tabs.create({ url });
        markOpened(key);
        return { success: true, reused: false, tabId: tab.id, url: tab.url };
      } catch (error) {
        log.error('[FrontendTool] Error opening tab:', error);
        return { error: "Failed to open tab" };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Opening Tab" subtitle={args.url} state="loading" icon="🌐" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Failed to Open Tab" subtitle={result.error} state="error" icon="🌐" />;
        }
        const action = result.reused ? "Switched to existing tab" : "Opened new tab";
        return (
          <ToolCard title={action} subtitle={result.url} state="success" icon="🌐" />
        );
      }
      return null;
    },
  });

  // ===========================
  // Smart Navigation Actions
  // ===========================

  useFrontendTool({
    name: "ensureAtUrl",
    description: "Ensure the active tab is at a specific URL. Navigates or reuses existing tab if same origin.",
    parameters: [
      { name: "url", type: "string", description: "Target URL", required: true },
      { name: "reuse", type: "boolean", description: "Reuse existing tab with same origin", required: false },
      { name: "waitFor", type: "string", description: "Wait strategy: 'load' or 'networkidle'", required: false },
      { name: "retries", type: "number", description: "Number of retries on failure", required: false }
    ],
    handler: async ({ url, reuse = true, waitFor = 'load', retries = 2 }) => {
      if (!shouldProcess("ensureAtUrl", { url })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.info("ensureAtUrl", { url, reuse, waitFor, retries });

        const targetUrl = new URL(url);
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!activeTab?.id) {
          return { error: "No active tab" };
        }

        // Check if already at URL
        if (urlsEqual(activeTab.url || '', url)) {
          return {
            success: true,
            navigated: false,
            tabId: activeTab.id,
            finalUrl: activeTab.url
          };
        }

        // Check if we should reuse existing tab with same origin
        if (reuse && activeTab.url) {
          try {
            const currentUrl = new URL(activeTab.url);
            if (currentUrl.origin === targetUrl.origin) {
              // Same origin, update URL
              await chrome.tabs.update(activeTab.id, { url });

              // Wait for navigation
              await waitForNavigation(activeTab.id, waitFor as 'load' | 'networkidle');

              return {
                success: true,
                navigated: true,
                reused: true,
                tabId: activeTab.id,
                finalUrl: url
              };
            }
          } catch (e) {
            // Invalid URL, proceed with normal navigation
          }
        }

        // Check for existing tab with this URL
        const allTabs = await chrome.tabs.query({});
        const existing = allTabs.find(t => t.id !== activeTab.id && urlsEqual(t.url || '', url));

        if (existing) {
          await focusTab(existing);
          return {
            success: true,
            navigated: false,
            reused: true,
            tabId: existing.id,
            finalUrl: existing.url
          };
        }

        // Navigate active tab
        await chrome.tabs.update(activeTab.id, { url });
        await waitForNavigation(activeTab.id, waitFor as 'load' | 'networkidle');

        const updatedTab = await chrome.tabs.get(activeTab.id);

        return {
          success: true,
          navigated: true,
          tabId: activeTab.id,
          finalUrl: updatedTab.url
        };
      } catch (error) {
        log.error('[FrontendTool] Error ensuring at URL:', error);
        return { error: `Failed to ensure at URL: ${(error as Error).message}` };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Navigating to URL" subtitle={args.url} state="loading" icon="🧭" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Navigation Failed" subtitle={result.error} state="error" icon="🧭" />;
        }
        const action = result.navigated ? "Navigated" : result.reused ? "Reused existing tab" : "Already at URL";
        return <ToolCard title={action} subtitle={result.finalUrl} state="success" icon="🧭" />;
      }
      return null;
    },
  });

  useFrontendTool({
    name: "goAndWait",
    description: "Navigate to URL (or pattern) and wait for page load/network idle",
    parameters: [
      { name: "url", type: "string", description: "URL to navigate to", required: true },
      { name: "waitFor", type: "string", description: "Wait strategy: 'load' or 'networkidle'", required: false },
      { name: "timeoutMs", type: "number", description: "Timeout in milliseconds", required: false }
    ],
    handler: async ({ url, waitFor = 'load', timeoutMs = 30000 }) => {
      if (!shouldProcess("goAndWait", { url })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.info("goAndWait", { url, waitFor, timeoutMs });

        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!activeTab?.id) {
          return { error: "No active tab" };
        }

        // Navigate
        await chrome.tabs.update(activeTab.id, { url });

        // Wait with timeout
        const waitPromise = waitForNavigation(activeTab.id, waitFor as 'load' | 'networkidle');
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Navigation timeout')), timeoutMs)
        );

        await Promise.race([waitPromise, timeoutPromise]);

        // Get final URL
        const updatedTab = await chrome.tabs.get(activeTab.id);

        return {
          success: true,
          finalUrl: updatedTab.url,
          title: updatedTab.title
        };
      } catch (error) {
        log.error('[FrontendTool] Error in goAndWait:', error);
        return { error: `Navigation failed: ${(error as Error).message}` };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Navigating and Waiting" subtitle={args.url} state="loading" icon="⏳" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Navigation Failed" subtitle={result.error} state="error" icon="⏳" />;
        }
        return (
          <ToolCard title="Navigation Complete" subtitle={result.finalUrl} state="success" icon="⏳">
            {result.title && <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>{result.title}</div>}
          </ToolCard>
        );
      }
      return null;
    },
  });


  useFrontendTool({
    name: "organizeTabsByContext",
    description: "Intelligently organize tabs by analyzing their content and context. Groups related tabs together even if they're from different websites. For example, all tabs about 'React hooks' will be grouped together regardless of whether they're from GitHub, StackOverflow, or documentation sites.",
    parameters: [
      {
        name: "maxGroups",
        type: "number",
        description: "Maximum number of groups to create (default: 5)",
        required: false
      }
    ],
    handler: async ({ maxGroups = 5 }) => {
      if (!shouldProcess("organizeTabsByContext", { maxGroups })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.debug("organizeTabsByContext invoked", { maxGroups });

        // Check if Tab Groups API is available
        if (!chrome.tabs.group || !chrome.tabGroups) {
          log.error("Tab Groups API not available");
          return {
            error: "Tab Groups API not available. This feature requires Chrome 89 or later.",
            details: "chrome.tabGroups is undefined"
          };
        }

        // Get all tabs
        const tabs = await chrome.tabs.query({});

        // Filter out special URLs
        const validTabs = tabs.filter(tab => {
          if (!tab.url) return false;
          try {
            const url = new URL(tab.url);
            return url.protocol !== 'chrome:' && url.protocol !== 'chrome-extension:';
          } catch {
            return false;
          }
        });

        if (validTabs.length === 0) {
          return { error: "No valid tabs to organize" };
        }

        // Prepare tab information for AI analysis
        const tabsInfo = validTabs.map(tab => ({
          id: tab.id!,
          title: tab.title || '',
          url: tab.url || '',
          domain: new URL(tab.url!).hostname
        }));

        // Return a special marker that tells CopilotKit to use AI for grouping
        // The AI will analyze the tabs and suggest groups
        return {
          needsAIAnalysis: true,
          tabs: tabsInfo,
          maxGroups,
          message: "Please analyze these tabs and group them by topic/context. Consider the title, URL, and domain to identify related work or research. Return a JSON array of groups where each group has: {name: string, description: string, tabIds: number[]}. Group tabs that are related to the same topic, project, or research, even if they're from different websites."
        };

      } catch (error) {
        log.error('[FrontendTool] Error organizing tabs by context:', error);
        return { error: "Failed to organize tabs by context", details: String(error) };
      }
    },
    render: ({ status, result, args }) => {
      if (status === "inProgress") {
        return <ToolCard title="Analyzing Tabs" subtitle="AI is analyzing tab content and context..." state="loading" icon="🧠" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Organization Failed" subtitle={result.error} state="error" icon="🧠" />;
        }
        if (result.needsAIAnalysis) {
          return (
            <ToolCard title="Tabs Ready for Analysis" subtitle={`${result.tabs.length} tabs prepared`} state="success" icon="🧠">
              <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>
                AI will now analyze and group these tabs by context...
              </div>
            </ToolCard>
          );
        }
        if (result.groups) {
          return (
            <ToolCard
              title="Tabs Organized by Context"
              subtitle={`Created ${result.groups.length} contextual group(s)`}
              state="success"
              icon="🧠"
            >
              {result.groups.length > 0 && (
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                  {result.groups.map((group: any, idx: number) => (
                    <div key={idx} style={{
                      padding: '8px',
                      marginBottom: '6px',
                      background: 'rgba(0,0,0,0.05)',
                      borderRadius: '4px'
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: '2px' }}>{group.name}</div>
                      {group.description && (
                        <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>
                          {group.description}
                        </div>
                      )}
                      <div style={{ opacity: 0.6 }}>{group.tabCount} tab(s)</div>
                    </div>
                  ))}
                </div>
              )}
            </ToolCard>
          );
        }
      }
      return null;
    },
  });

  useFrontendTool({
    name: "applyTabGroups",
    description: "Apply AI-suggested tab groups. This is called after organizeTabsByContext with the AI's grouping suggestions.",
    parameters: [
      {
        name: "groups",
        type: "object",
        description: "Array of group objects with name, description, and tabIds",
        required: true
      }
    ],
    handler: async ({ groups }) => {
      if (!shouldProcess("applyTabGroups", { groups })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.debug("applyTabGroups invoked", { groupCount: Array.isArray(groups) ? groups.length : 0 });

        // Check if Tab Groups API is available
        if (!chrome.tabs.group || !chrome.tabGroups) {
          return { error: "Tab Groups API not available" };
        }

        const groupsArray = Array.isArray(groups) ? groups : [];
        const colors: chrome.tabGroups.ColorEnum[] = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];
        const createdGroups = [];

        for (let i = 0; i < groupsArray.length; i++) {
          const group = groupsArray[i];

          if (!group.tabIds || !Array.isArray(group.tabIds) || group.tabIds.length === 0) {
            log.debug("Skipping group with no tabs", { group });
            continue;
          }

          try {
            // Create the group
            const groupId = await chrome.tabs.group({ tabIds: group.tabIds });

            // Update with name and color
            await chrome.tabGroups.update(groupId, {
              title: group.name || `Group ${i + 1}`,
              color: colors[i % colors.length],
              collapsed: true
            });

            createdGroups.push({
              name: group.name,
              description: group.description,
              tabCount: group.tabIds.length,
              groupId
            });

            log.info("Created contextual tab group", {
              name: group.name,
              tabCount: group.tabIds.length
            });

          } catch (groupError) {
            log.error("Failed to create group", { group, error: String(groupError) });
          }
        }

        return {
          success: true,
          groupsCreated: createdGroups.length,
          groups: createdGroups
        };

      } catch (error) {
        log.error('[FrontendTool] Error applying tab groups:', error);
        return { error: "Failed to apply tab groups", details: String(error) };
      }
    },
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Applying Groups" subtitle="Creating tab groups..." state="loading" icon="✨" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Failed to Apply Groups" subtitle={result.error} state="error" icon="✨" />;
        }
        return (
          <ToolCard
            title="Groups Applied"
            subtitle={`Successfully created ${result.groupsCreated} group(s)`}
            state="success"
            icon="✨"
          >
            {result.groups && result.groups.length > 0 && (
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                {result.groups.map((group: any, idx: number) => (
                  <div key={idx} style={{
                    padding: '8px',
                    marginBottom: '6px',
                    background: 'rgba(0,0,0,0.05)',
                    borderRadius: '4px'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>{group.name}</div>
                    {group.description && (
                      <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>
                        {group.description}
                      </div>
                    )}
                    <div style={{ opacity: 0.6 }}>{group.tabCount} tab(s)</div>
                  </div>
                ))}
              </div>
            )}
          </ToolCard>
        );
      }
      return null;
    },
  });

  useFrontendTool({
    name: "ungroupTabs",
    description: "Ungroup tabs by removing them from their tab groups. Can ungroup all tabs, specific groups by name/ID, or tabs from multiple groups at once. Tabs remain open but are no longer grouped.",
    parameters: [
      {
        name: "groupIds",
        type: "object",
        description: "Optional array of group IDs to ungroup. If not provided, ungroups ALL tab groups. Can be group IDs (numbers) or group names (strings).",
        required: false
      },
      {
        name: "ungroupAll",
        type: "boolean",
        description: "If true, ungroups all tab groups at once. Default is true if no groupIds specified.",
        required: false
      }
    ],
    handler: async ({ groupIds, ungroupAll = true }) => {
      if (!shouldProcess("ungroupTabs", { groupIds, ungroupAll })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.debug("ungroupTabs invoked", { groupIds, ungroupAll });

        // Check if Tab Groups API is available
        if (!chrome.tabs.group || !chrome.tabGroups) {
          log.error("Tab Groups API not available");
          return {
            error: "Tab Groups API not available. This feature requires Chrome 89 or later.",
            details: "chrome.tabGroups is undefined"
          };
        }

        let targetGroupIds: number[] = [];
        let ungroupedGroups: { id: number; title: string; tabCount: number }[] = [];

        // Determine which groups to ungroup
        if (ungroupAll && !groupIds) {
          // Ungroup all groups
          const allGroups = await chrome.tabGroups.query({});
          targetGroupIds = allGroups.map(g => g.id);
          log.debug("Ungrouping all groups", { count: targetGroupIds.length });
        } else if (groupIds && Array.isArray(groupIds)) {
          // Ungroup specific groups
          const allGroups = await chrome.tabGroups.query({});

          for (const groupIdOrName of groupIds) {
            if (typeof groupIdOrName === 'number') {
              // It's a group ID
              targetGroupIds.push(groupIdOrName);
            } else if (typeof groupIdOrName === 'string') {
              // It's a group name - find the group by title
              const matchingGroup = allGroups.find(g =>
                g.title?.toLowerCase().includes(groupIdOrName.toLowerCase())
              );
              if (matchingGroup) {
                targetGroupIds.push(matchingGroup.id);
              } else {
                log.warn("Group not found by name", { name: groupIdOrName });
              }
            }
          }
          log.debug("Ungrouping specific groups", { targetGroupIds });
        } else {
          return { error: "Invalid parameters. Provide groupIds array or set ungroupAll to true." };
        }

        if (targetGroupIds.length === 0) {
          return {
            success: true,
            message: "No groups to ungroup",
            ungroupedCount: 0,
            groups: []
          };
        }

        // Get tabs for each group before ungrouping
        for (const groupId of targetGroupIds) {
          try {
            // Get group info
            const groupInfo = await chrome.tabGroups.get(groupId);

            // Get tabs in this group
            const tabsInGroup = await chrome.tabs.query({ groupId });

            // Ungroup the tabs
            const tabIds = tabsInGroup.map(t => t.id!).filter(id => id !== undefined);
            if (tabIds.length > 0) {
              await chrome.tabs.ungroup(tabIds);

              ungroupedGroups.push({
                id: groupId,
                title: groupInfo.title || `Group ${groupId}`,
                tabCount: tabIds.length
              });

              log.info("Ungrouped tabs", {
                groupId,
                groupTitle: groupInfo.title,
                tabCount: tabIds.length
              });
            }
          } catch (groupError) {
            log.error("Failed to ungroup", { groupId, error: String(groupError) });
            // Continue with other groups even if one fails
          }
        }

        return {
          success: true,
          ungroupedCount: ungroupedGroups.length,
          totalTabsUngrouped: ungroupedGroups.reduce((sum, g) => sum + g.tabCount, 0),
          groups: ungroupedGroups
        };

      } catch (error) {
        log.error('[FrontendTool] Error ungrouping tabs:', error);
        return { error: "Failed to ungroup tabs", details: String(error) };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        const subtitle = args.ungroupAll ? "Ungrouping all groups..." :
          args.groupIds ? `Ungrouping ${Array.isArray(args.groupIds) ? args.groupIds.length : 1} group(s)...` :
            "Ungrouping...";
        return <ToolCard title="Ungrouping Tabs" subtitle={subtitle} state="loading" icon="🔓" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Ungroup Failed" subtitle={result.error} state="error" icon="🔓" />;
        }

        if (result.ungroupedCount === 0) {
          return <ToolCard title="No Groups to Ungroup" subtitle={result.message} state="success" icon="🔓" />;
        }

        return (
          <ToolCard
            title="Tabs Ungrouped"
            subtitle={`Ungrouped ${result.ungroupedCount} group(s), ${result.totalTabsUngrouped} tab(s) freed`}
            state="success"
            icon="🔓"
          >
            {result.groups && result.groups.length > 0 && (
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                {result.groups.map((group: any, idx: number) => (
                  <div key={idx} style={{
                    padding: '6px 8px',
                    marginBottom: '4px',
                    background: 'rgba(0,0,0,0.05)',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: 500 }}>{group.title}</span>
                    <span style={{ opacity: 0.6 }}>{group.tabCount} tab(s)</span>
                  </div>
                ))}
              </div>
            )}
          </ToolCard>
        );
      }
      return null;
    },
  });
}



async function waitForNavigation(
  tabId: number,
  strategy: 'load' | 'networkidle'
): Promise<void> {
  // Both strategies now use the same 'load' approach
  return new Promise((resolve) => {
    const listener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}