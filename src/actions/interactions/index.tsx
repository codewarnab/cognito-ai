import { registerBasicInteractions } from "./basic-interactions";
import { registerKeyboardInteractions } from "./keyboard-interactions";
import { registerFormInteractions } from "./form-interactions";
import { registerTextExtractionInteractions } from "./text-extraction";
import { registerSearchResultsInteractions } from "./search-results";

export function registerInteractionActions() {
    registerBasicInteractions();
    registerKeyboardInteractions();
    registerFormInteractions();
    registerTextExtractionInteractions();
    registerSearchResultsInteractions();
}