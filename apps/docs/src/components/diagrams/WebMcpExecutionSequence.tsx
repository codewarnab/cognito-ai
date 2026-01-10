export function WebMcpExecutionSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 620 380" className="w-full max-w-2xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="30" y="10" width="70" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="65" y="30" textAnchor="middle" className="text-[10px] font-medium">AI Model</text>

                    <rect x="145" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="185" y="30" textAnchor="middle" className="text-[10px] font-medium">Background</text>

                    <rect x="275" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="325" y="30" textAnchor="middle" className="text-[10px] font-medium">Content Script</text>

                    <rect x="420" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="460" y="30" textAnchor="middle" className="text-[10px] font-medium">Web Page</text>

                    <rect x="540" y="10" width="70" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="575" y="30" textAnchor="middle" className="text-[10px] font-medium">User</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="65" y1="40" x2="65" y2="370" />
                    <line x1="185" y1="40" x2="185" y2="370" />
                    <line x1="325" y1="40" x2="325" y2="370" />
                    <line x1="460" y1="40" x2="460" y2="370" />
                    <line x1="575" y1="40" x2="575" y2="370" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. AI selects tool */}
                    <line x1="65" y1="70" x2="180" y2="70" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-exec)" />
                    <text x="122" y="63" textAnchor="middle" className="text-[10px]">webmcp/tool/call</text>

                    {/* Validation box */}
                    <rect x="115" y="85" width="140" height="55" rx="3" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1" />
                    <text x="125" y="100" className="text-[10px] font-semibold fill-gray-600 dark:fill-gray-400">validate</text>
                    <text x="125" y="115" className="text-[9px] fill-gray-500 dark:fill-gray-400">✓ Origin match</text>
                    <text x="125" y="128" className="text-[9px] fill-gray-500 dark:fill-gray-400">✓ Tab ID match</text>
                    <text x="205" y="115" className="text-[9px] fill-gray-500 dark:fill-gray-400">✓ Schema</text>
                    <text x="205" y="128" className="text-[9px] fill-gray-500 dark:fill-gray-400">✓ Rate limit</text>

                    {/* HITL Approval Box */}
                    <rect x="95" y="150" width="485" height="80" rx="3" className="fill-amber-50/50 stroke-amber-400 dark:fill-amber-900/20 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="105" y="165" className="text-[10px] font-semibold fill-amber-700 dark:fill-amber-400">Human-in-the-Loop Approval</text>

                    {/* Show approval UI */}
                    <line x1="185" y1="180" x2="570" y2="180" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-exec)" />
                    <text x="377" y="173" textAnchor="middle" className="text-[10px]">Show approval dialog</text>

                    {/* User approves */}
                    <line x1="575" y1="205" x2="190" y2="205" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-exec)" />
                    <text x="382" y="198" textAnchor="middle" className="text-[10px]">Approve execution</text>

                    {/* 2. Forward to content script */}
                    <line x1="185" y1="250" x2="320" y2="250" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-exec)" />
                    <text x="252" y="243" textAnchor="middle" className="text-[10px]">webmcp/tool/execute</text>

                    {/* 3. Execute on page */}
                    <line x1="325" y1="280" x2="455" y2="280" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-exec)" />
                    <text x="390" y="273" textAnchor="middle" className="text-[10px]">callTool()</text>

                    {/* 4. Result from page */}
                    <line x1="460" y1="305" x2="330" y2="305" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-exec)" />
                    <text x="395" y="298" textAnchor="middle" className="text-[10px]">Result</text>

                    {/* 5. Result to background */}
                    <line x1="325" y1="330" x2="190" y2="330" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-exec)" />
                    <text x="257" y="323" textAnchor="middle" className="text-[10px]">webmcp/tool/result</text>

                    {/* 6. addToolOutput to AI */}
                    <line x1="185" y1="355" x2="70" y2="355" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-exec)" />
                    <text x="127" y="348" textAnchor="middle" className="text-[10px]">addToolOutput()</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-exec" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
