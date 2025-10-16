import { registerTabActions } from "./tabs/index";
import { registerSelectionActions } from "./selection";
import { registerInteractionActions } from "./interactions";
import { registerPrimitiveActions } from "./primitives/index";
import { registerHistoryActions } from "./history/index";
import { registerReminderActions } from "./reminder/index";
import { registerMemoryActions } from "./memory/index";

export function useRegisterAllActions() {
  // These functions call hooks under the hood; ensure this is invoked within a component body.
  // Hooks must be called unconditionally on every render to satisfy React's Rules of Hooks.
  registerTabActions();
  registerSelectionActions();
  registerInteractionActions();
  registerPrimitiveActions();
  registerHistoryActions();
  registerReminderActions();
  registerMemoryActions();
}
