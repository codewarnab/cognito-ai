import { useGetActiveTab } from "./getActiveTab";
import { useSearchTabs } from "./searchTabs";
import { useOpenTab } from "./openTab";
import { useEnsureAtUrl } from "./ensureAtUrl";
import { useGoAndWait } from "./goAndWait";
import { useOrganizeTabsByContext } from "./organizeTabsByContext";
import { useApplyTabGroups } from "./applyTabGroups";
import { useUngroupTabs } from "./ungroupTabs";

export function registerTabActions() {
    useGetActiveTab();
    useSearchTabs();
    useOpenTab();
    useEnsureAtUrl();
    useGoAndWait();
    useOrganizeTabsByContext();
    useApplyTabGroups();
    useUngroupTabs();
}

// Export individual hooks for flexibility
export {
    useGetActiveTab,
    useSearchTabs,
    useOpenTab,
    useEnsureAtUrl,
    useGoAndWait,
    useOrganizeTabsByContext,
    useApplyTabGroups,
    useUngroupTabs
};

// Export helper function
export { waitForNavigation } from "./navigationHelpers";
