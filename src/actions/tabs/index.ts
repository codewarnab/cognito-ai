import { useNavigateToTool } from './navigateTo';
import { useSwitchTabsTool } from './switchTabs';
import { useGetActiveTab } from './getActiveTab';
import { useGetAllTabs } from './getAllTabs';
import { useApplyTabGroups } from './applyTabGroups';
import { useUngroupTabs } from './ungroupTabs';
import { useOrganizeTabsByContextTool } from './organizeTabsByContext';


export function registerTabActions() {
  // Tab actions
  useNavigateToTool();
  useSwitchTabsTool();
  useGetActiveTab();
  useGetAllTabs();
  useApplyTabGroups();
  useUngroupTabs();
  useOrganizeTabsByContextTool();
}
