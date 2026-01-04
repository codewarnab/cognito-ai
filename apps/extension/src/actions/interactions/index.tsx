
// Import new enhanced tools
import { useTypeInFieldTool } from "./typeInField";
import { useSelectOptionTool } from "./selectOption";
import { useClickByTextTool } from "./clickByText";
import { usePressKeyTool } from "./usePressKeyTool";

// Import existing tools we want to keep
// NOTE: registerTextExtractionInteractions removed - now part of unified readPageContent
import { useChromeSearchTool } from "./search";
import { useFocusElementTool } from "./focus";
import { useScrollPageTool } from "./scroll";

// Import search result parsing tools
import { useGetSearchResultsTool } from "./getSearchResults";
import { useOpenSearchResultTool } from "./openSearchResult";

export function registerInteractionActions() {
    // NEW: Enhanced interaction tools
    useTypeInFieldTool();       // Type in any input field by description
    useSelectOptionTool();      // Select from dropdowns
    useClickByTextTool();       // Click any element by text search
    usePressKeyTool();          // Press special keys (Enter, Tab, etc.)

    // EXISTING: Keep useful tools
    useChromeSearchTool();      // Search functionality
    useFocusElementTool();      // Focus elements
    useScrollPageTool();        // Scroll page
    // NOTE: registerTextExtractionInteractions removed - unified into readPageContent

    // NEW: Search result parsing and navigation
    useGetSearchResultsTool();  // Parse Google/Bing search results
    useOpenSearchResultTool();  // Open specific search result by rank
}
