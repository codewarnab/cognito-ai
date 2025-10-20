
// Import new enhanced tools
import { useTypeInFieldTool } from "./typeInField";
import { useClickByTextTool } from "./clickByText";
import { usePressKeyTool } from "./usePressKeyTool";

// Import existing tools we want to keep
import { registerTextExtractionInteractions } from "./text-extraction";
import { useChromeSearchTool } from "./search";
import { useFocusElementTool } from "./focus";
import { useScrollPageTool } from "./scroll";

// Import search result parsing tools
import { useGetSearchResultsTool } from "./getSearchResults";
import { useOpenSearchResultTool } from "./openSearchResult";

export function registerInteractionActions() {
    // NEW: Enhanced interaction tools
    useTypeInFieldTool();       // Type in any input field by description
    useClickByTextTool();       // Click any element by text search
    usePressKeyTool();          // Press special keys (Enter, Tab, etc.)

    // EXISTING: Keep useful tools
    useChromeSearchTool();      // Search functionality
    useFocusElementTool();      // Focus elements
    useScrollPageTool();        // Scroll page
    registerTextExtractionInteractions(); // Text extraction

    // NEW: Search result parsing and navigation
    useGetSearchResultsTool();  // Parse Google/Bing search results
    useOpenSearchResultTool();  // Open specific search result by rank
}