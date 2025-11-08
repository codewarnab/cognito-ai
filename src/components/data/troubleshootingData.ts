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
        issue: 'Voice mode not working or microphone access denied',
        causes: [
            'Microphone permissions not granted to the extension',
            'Browser microphone access blocked in settings',
            'Wrong microphone device selected in system settings',
            'Extension lacks audioCapture permission (requires reinstall)',
        ],
        solutions: [
            'When prompted, click "Allow" to grant microphone access to the extension',
            'Manually enable microphone: Go to chrome://extensions → find "Cognito" → Click "Details" → Scroll to "Permissions" → Ensure microphone access is allowed',
            'Check site permissions: Click the lock/info icon in the address bar → Site settings → Microphone → Set to "Allow"',
            'Verify global microphone access: chrome://settings/content/microphone → Ensure microphone is not blocked',
            'Test your microphone in other applications to confirm it\'s working',
            'If microphone permission is missing from extension permissions, you may need to reinstall the extension',
            'After granting permissions, refresh the page or restart the extension',
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
    {
        id: '11',
        issue: 'Local mode not responding',
        causes: [
            'Local AI mode (Gemini Nano) is not supported or properly configured',
            'Chrome built-in AI features not enabled',
            'Optimization Guide model not downloaded',
            'Insufficient storage space for AI model',
        ],
        solutions: [
            'Download and install Chrome with built-in AI Latest Version',
            'Go to chrome://flags/#prompt-api-for-gemini-nano and enable the Prompt API for Gemini Nano option',
            'Go to chrome://flags/#optimization-guide-on-device-model and turn on the Enables optimization guide on device option',
            'Go to chrome://components/ and check or download the latest version of Optimization Guide On Device Model',
            'Ensure the drive where Chrome is installed has at least 20 GB of free storage space',
            'Restart Chrome after enabling the flags and downloading the model',
        ],
    },
    {
        id: '12',
        issue: 'Local AI download progress not showing in chat',
        causes: [
            'Download progress monitoring not implemented in chat interface',
            'Local AI model download happens in background without UI feedback',
            'Progress events not properly connected to chat display',
        ],
        solutions: [
            'Currently if the local AI is downloadable it downloads it but we are unable to add the progress in chat so left it open for sometime then come back',
            'You can try running this code in console of any tab to monitor download progress:',
            'const session = await LanguageModel.create({',
            '  monitor(m) {',
            '    m.addEventListener(\'downloadprogress\', (e) => {',
            '      console.log(`Downloaded ${e.loaded * 100}%`);',
            '    });',
            '  },',
            '});',
            'This will show download progress in the browser console',
        ],
    },
    {
        id: '13',
        issue: 'Follow-up questions not working with YouTube or PDF agent',
        causes: [
            'Agent context not properly maintained between queries',
            'Memory state corrupted after initial query',
            'Tool state not reset between consecutive questions',
        ],
        solutions: [
            'If asking a follow-up question to YouTube video or PDF agent does not work, the only fix is to create a new chat',
            'Start a new chat thread to ask additional questions about the same content',
            'We are actively working on fixing this issue to support follow-up questions within the same chat',
        ],
    },
];
