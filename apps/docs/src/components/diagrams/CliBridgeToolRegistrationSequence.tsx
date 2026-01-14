export function CliBridgeToolRegistrationSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 750 340" className="w-full max-w-3xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="30" y="10" width="110" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="85" y="30" textAnchor="middle" className="text-[11px] font-medium">cliModeStore</text>

                    <rect x="180" y="10" width="120" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="240" y="30" textAnchor="middle" className="text-[11px] font-medium">toolBridgeClient</text>

                    <rect x="350" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="400" y="30" textAnchor="middle" className="text-[11px] font-medium">CLI Bridge</text>

                    <rect x="500" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="550" y="30" textAnchor="middle" className="text-[11px] font-medium">toolStore</text>

                    <rect x="640" y="10" width="90" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="685" y="30" textAnchor="middle" className="text-[11px] font-medium">MCP Server</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="85" y1="40" x2="85" y2="330" />
                    <line x1="240" y1="40" x2="240" y2="330" />
                    <line x1="400" y1="40" x2="400" y2="330" />
                    <line x1="550" y1="40" x2="550" y2="330" />
                    <line x1="685" y1="40" x2="685" y2="330" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. After connection established */}
                    <line x1="85" y1="65" x2="235" y2="65" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-tool-reg)" />
                    <text x="160" y="58" textAnchor="middle" className="text-[10px]">registerToolsWithBridge()</text>

                    {/* 2. Get tool schemas */}
                    <path d="M 240 85 Q 280 85 280 100 Q 280 115 240 115" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-tool-reg)" />
                    <text x="295" y="103" className="text-[10px]">getToolSchemas()</text>

                    {/* 3. POST to bridge */}
                    <line x1="240" y1="140" x2="395" y2="140" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-tool-reg)" />
                    <text x="317" y="133" textAnchor="middle" className="text-[10px]">POST /bridge/tools/register</text>

                    {/* Note: tools array */}
                    <rect x="255" y="150" width="130" height="22" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="320" y="165" textAnchor="middle" className="text-[9px] fill-amber-700 dark:fill-amber-400">{`{tools: [{name, desc, params}]}`}</text>

                    {/* 4. Store tools */}
                    <line x1="400" y1="185" x2="545" y2="185" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-tool-reg)" />
                    <text x="472" y="178" textAnchor="middle" className="text-[10px]">registerTools(tools)</text>

                    {/* 5. Emit event */}
                    <line x1="550" y1="210" x2="680" y2="210" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-tool-reg)" />
                    <text x="615" y="203" textAnchor="middle" className="text-[10px]">tools:registered event</text>

                    {/* Note: MCP can now expose tools */}
                    <rect x="575" y="220" width="130" height="22" rx="2" className="fill-green-50 stroke-green-400 dark:fill-green-900/30 dark:stroke-green-500" strokeWidth="1" />
                    <text x="640" y="235" textAnchor="middle" className="text-[9px] fill-green-700 dark:fill-green-400">Tools exposed via MCP</text>

                    {/* 6. Return success */}
                    <line x1="400" y1="260" x2="245" y2="260" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-tool-reg)" />
                    <text x="322" y="253" textAnchor="middle" className="text-[10px]">{`{success: true, count: N}`}</text>

                    {/* 7. Connect to SSE */}
                    <line x1="85" y1="290" x2="235" y2="290" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-tool-reg)" />
                    <text x="160" y="283" textAnchor="middle" className="text-[10px]">connectToToolEvents()</text>

                    {/* 8. SSE connection */}
                    <line x1="240" y1="315" x2="395" y2="315" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-tool-reg)" />
                    <text x="317" y="308" textAnchor="middle" className="text-[10px]">GET /bridge/tools/events (SSE)</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-tool-reg" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
