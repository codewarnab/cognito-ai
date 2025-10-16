import { registerTabActions } from "./tabs";
import { registerSelectionActions } from "./selection";
import { registerInteractionActions } from "./interactions";
import { registerPrimitiveActions } from "./primitives";
import { registerHistoryActions } from "./history";

export function useRegisterAllActions() {
  // These functions call hooks under the hood; ensure this is invoked within a component body.
  // Hooks must be called unconditionally on every render to satisfy React's Rules of Hooks.
  registerTabActions();
  registerSelectionActions();
  registerInteractionActions();
  registerPrimitiveActions();
  registerHistoryActions();
}
