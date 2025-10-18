
import { registerKeyboardInteractions } from "./keyboard-interactions";
import { registerTextExtractionInteractions } from "./text-extraction";
import { useChromeSearchTool } from "./search";
import { useClickElementTool } from "./click";
import { useFocusElementTool } from "./focus";
import { useScrollPageTool } from "./scroll";

export function registerInteractionActions() {
    useChromeSearchTool();
    useClickElementTool();
    useFocusElementTool();
    useScrollPageTool();
    registerKeyboardInteractions();
    registerTextExtractionInteractions();
}