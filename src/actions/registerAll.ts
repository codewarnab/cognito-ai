import { registerTabActions } from "./tabs";
import { registerSelectionActions } from "./selection";
import { registerInteractionActions } from "./interactions";
import { registerHistoryActions } from "./history";
import { registerReminderActions } from "./reminder";
import { registerMemoryActions } from "./memory";
import { registerYoutubeActions } from "./youtube";

export function useRegisterAllActions() {
  // These functions call hooks under the hood; ensure this is invoked within a component body.
  // Hooks must be called unconditionally on every render to satisfy React's Rules of Hooks.
  registerTabActions();
  registerSelectionActions();
  registerInteractionActions();
  registerHistoryActions();
  registerReminderActions();
  registerMemoryActions();
  registerYoutubeActions();
}