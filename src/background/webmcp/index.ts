/**
 * WebMCP Module
 *
 * Exports WebMCP manager functionality for use in background service
 */

export {
  initializeWebMCPManager,
  getWebMCPState,
  getActiveTabWebMCPTools,
  registerWebMCPTools,
  clearWebMCPTools,
  setActiveTab,
  executeWebMCPTool,
  onToolsUpdate,
} from './manager';
