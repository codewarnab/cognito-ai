export {}

console.log("Chrome AI Extension - Background Script Loaded")

// Open sidepanel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    try {
      // Open the side panel for the current tab
      await chrome.sidePanel.open({ tabId: tab.id })
      console.log("Side panel opened for tab:", tab.id)
    } catch (error) {
      console.error("Failed to open side panel:", error)
    }
  }
})

// Optional: Set side panel behavior to open per-tab
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated")
  // Set the side panel to be available
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Error setting panel behavior:", error))
})
