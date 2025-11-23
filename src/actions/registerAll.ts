import { registerTabActions } from "./tabs";
import { registerSelectionActions } from "./selection";
import { registerInteractionActions } from "./interactions";
import { registerHistoryActions } from "./history";
import { registerReminderActions } from "./reminder";
import { registerMemoryActions } from "./memory";
import { registerReportActions } from "./reports";
import { useScreenshotTool } from "./screenshot";
import { registerYouTubeToNotionActions } from "./youtubeToNotion";
import { registerBookmarkActions } from "./bookmarks";
import { registerDomActions } from "./dom";

export function useRegisterAllActions() {
  // These functions call hooks under the hood; ensure this is invoked within a component body.
  // Hooks must be called unconditionally on every render to satisfy React's Rules of Hooks.
  registerTabActions();
  registerSelectionActions();
  registerInteractionActions();
  registerHistoryActions();
  registerReminderActions();
  registerMemoryActions();
  registerReportActions(); // Always register, but will be filtered in aiLogic.ts
  useScreenshotTool(); // Screenshot capture tool
  registerYouTubeToNotionActions(); // YouTube to Notion agent tool
  registerBookmarkActions(); // Bookmark management tools
  registerDomActions(); // DOM analysis and script execution tools
}
