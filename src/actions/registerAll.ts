import { registerTabActions } from "./tabs";
import { registerSelectionActions } from "./selection";
import { registerInteractionActions } from "./interactions";
import { registerPrimitiveActions } from "./primitives";

export function useRegisterAllActions() {
  // These functions call hooks under the hood; ensure this is invoked within a component body.
  registerTabActions();
  registerSelectionActions();
  registerInteractionActions();
  registerPrimitiveActions();
}
