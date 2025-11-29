import { registerTabActions } from "./tabs";
import { useSelectionActions } from "./selection";
import { registerInteractionActions } from "./interactions";
import { useRegisterHistoryActions } from "./history";
import { registerReminderActions } from "./reminder";
import { registerReportActions } from "./reports";
import { useScreenshotTool } from "./screenshot";
import { registerYouTubeToNotionActions } from "./youtubeToNotion";
import { registerBookmarkActions } from "./bookmarks";
import { registerDomActions } from "./dom";
import { useWebSearch, useRetrieve, useDeepWebSearch } from "./search";

export function useRegisterAllActions() {
  // These functions call hooks under the hood; ensure this is invoked within a component body.
  // Hooks must be called unconditionally on every render to satisfy React's Rules of Hooks.
  registerTabActions();
  useSelectionActions();
  registerInteractionActions();
  useRegisterHistoryActions();
  registerReminderActions();
  registerReportActions(); // Always register, but will be filtered in aiLogic.ts
  useScreenshotTool(); // Screenshot capture tool
  registerYouTubeToNotionActions(); // YouTube to Notion agent tool
  registerBookmarkActions(); // Bookmark management tools
  registerDomActions(); // DOM analysis and script execution tools
  useWebSearch(); // Web search tool
  useRetrieve(); // URL content retrieval tool
  useDeepWebSearch(); // Deep web search with parallel queries
}
