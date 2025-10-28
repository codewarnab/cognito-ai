export interface TroubleshootingItem {
    id: string;
    issue: string;
    causes: string[];
    solutions: string[];
}

export const troubleshootingData: TroubleshootingItem[] = [
    {
        id: '1',
        issue: 'AI not calling MCP tools',
        causes: [
            'MCP server not properly connected',
            'Server verification incomplete',
            'Tools not loaded in current chat context',
        ],
        solutions: [
            'Wait on the MCP page after clicking "Enable" until it shows "Connected and Verified"',
            'Try creating a new chat if it still does not work',
            'Ensure you see the green checkmark indicating successful connection',
            'Refresh the extension if the connection seems stuck',
        ],
    },
    {
        id: '2',
        issue: 'Extension is lagging when using',
        causes: [
            'Local AI mode using summarization API consuming resources',
            'Prompt API using too much processing power',
            'Multiple heavy operations running simultaneously',
        ],
        solutions: [
            'This is probably because of local AI mode - when it uses summarization API or prompt API, it uses much resources which can cause lagging',
            'We are actively working on this to move this load to offscreen page to avoid lagging',
            'Try disabling local AI mode temporarily if performance is critical',
            'Close unnecessary browser tabs to free up resources',
        ],
    },
    {
        id: '3',
        issue: 'AI not working properly - passing wrong input to tools',
        causes: [
            'Too much context in the chat',
            'Too many MCPs enabled',
            'Context confusion with multiple tools',
        ],
        solutions: [
            'This happens when there is too much context or too many MCPs are enabled',
            'Try creating a new chat to reset context',
            'Disable specific tools in MCP settings that you\'re not using',
            'Consider disabling MCP entirely if not needed for your current task',
        ],
    },
    {
        id: '4',
        issue: 'Stops abruptly in research mode',
        causes: [
            'Rate limit has been reached',
            'AI sent malformed function call',
            'Too many concurrent requests',
        ],
        solutions: [
            'To avoid rate limit, use API from GCP instead of the free tier',
            'To avoid malformed function calling, try asking it smaller tasks',
            'Limit the number of tabs (2-3 tabs) when performing research',
            'We are actively working to mitigate this issue',
            'Wait a few minutes before retrying if you hit rate limits',
        ],
    },
    {
        id: '5',
        issue: 'Chat is not responding or messages are stuck',
        causes: [
            'API key not configured or invalid',
            'Network connectivity issues',
            'Browser extension permissions not granted',
        ],
        solutions: [
            'Verify your Gemini API key is correctly set in Settings (three dots menu → Gemini API Key Setup)',
            'Check your internet connection and try refreshing the page',
            'Ensure the extension has the required permissions in chrome://extensions',
            'Try clearing the current chat and starting a new thread',
        ],
    },
    {
        id: '6',
        issue: 'Voice input not working',
        causes: [
            'Microphone permissions not granted',
            'Wrong microphone selected',
            'Browser microphone access blocked',
        ],
        solutions: [
            'Click the microphone icon and grant permissions when prompted',
            'Check chrome://settings/content/microphone to ensure the extension has access',
            'Verify your system microphone is working in other applications',
            'Try refreshing the extension or restarting the browser',
        ],
    },
    {
        id: '7',
        issue: 'Memory features not saving or retrieving',
        causes: [
            'Storage quota exceeded',
            'IndexedDB access blocked',
            'Corrupted memory database',
        ],
        solutions: [
            'Open Memory Management (three dots menu) and check stored memories',
            'Clear old or unnecessary memories to free up space',
            'Check if the browser has storage permissions enabled for the extension',
            'Try exporting memories and clearing the database, then re-importing',
        ],
    },
    {
        id: '8',
        issue: 'Code execution or browser automation not working',
        causes: [
            'Content script injection failed',
            'Page security policies blocking execution',
            'Insufficient permissions for the target page',
        ],
        solutions: [
            'Refresh the target page to re-inject content scripts',
            'Check if the page URL is in the extension\'s allowed patterns',
            'Some pages (like chrome:// URLs) cannot be automated due to browser security',
            'Review the Chrome DevTools console for error messages',
        ],
    },
    {
        id: '9',
        issue: 'Chat history or threads missing',
        causes: [
            'Browser data was cleared',
            'Extension was reinstalled',
            'Database corruption',
        ],
        solutions: [
            'Check if you\'re logged in to the same browser profile',
            'Look for export/backup files if you previously exported data',
            'Threads are stored locally; clearing browser data will remove them',
            'Consider enabling browser sync if available to backup data',
        ],
    },
    {
        id: '10',
        issue: 'Reminders not triggering',
        causes: [
            'Background service worker not running',
            'Notification permissions not granted',
            'System time/timezone incorrect',
        ],
        solutions: [
            'Grant notification permissions when prompted',
            'Check chrome://settings/content/notifications for extension permissions',
            'Verify your system time and timezone are correct',
            'Open Reminders (three dots menu) to check scheduled reminders',
        ],
    },
];
