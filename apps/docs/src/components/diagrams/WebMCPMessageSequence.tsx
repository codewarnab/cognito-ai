export function WebMCPMessageSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 620 340" className="w-full max-w-2xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="30" y="10" width="70" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="65" y="30" textAnchor="middle" className="text-[10px] font-medium">AI Caller</text>

                    <rect x="145" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="185" y="30" textAnchor="middle" className="text-[10px] font-medium">Background</text>

                    <rect x="280" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="330" y="30" textAnchor="middle" className="text-[10px] font-medium">Content Script</text>

                    <rect x="440" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="480" y="30" textAnchor="middle" className="text-[10px] font-medium">Web Page</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="65" y1="40" x2="65" y2="330" />
                    <line x1="185" y1="40" x2="185" y2="330" />
                    <line x1="330" y1="40" x2="330" y2="330" />
                    <line x1="480" y1="40" x2="480" y2="330" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* Note: requestId generation */}
                    <rect x="20" y="55" width="90" height="22" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="65" y="70" textAnchor="middle" className="text-[9px] fill-amber-700 dark:fill-amber-400">Generate requestId</text>

                    {/* 1. Tool call with requestId */}
                    <line x1="65" y1="95" x2="180" y2="95" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-webmcp)" />
                    <text x="122" y="88" textAnchor="middle" className="text-[10px]">webmcp/tool/call</text>

                    {/* requestId annotation */}
                    <rect x="95" y="105" width="85" height="18" rx="2" className="fill-green-50 stroke-green-400 dark:fill-green-900/30 dark:stroke-green-500" strokeWidth="1" />
                    <text x="137" y="117" textAnchor="middle" className="text-[8px] fill-green-700 dark:fill-green-400">requestId: "abc-123"</text>

                    {/* 2. Forward to content script */}
                    <line x1="185" y1="145" x2="325" y2="145" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-webmcp)" />
                    <text x="255" y="138" textAnchor="middle" className="text-[10px]">webmcp/tool/execute</text>

                    {/* requestId preserved */}
                    <rect x="213" y="155" width="85" height="18" rx="2" className="fill-green-50 stroke-green-400 dark:fill-green-900/30 dark:stroke-green-500" strokeWidth="1" />
                    <text x="255" y="167" textAnchor="middle" className="text-[8px] fill-green-700 dark:fill-green-400">requestId: "abc-123"</text>

                    {/* 3. Post to page */}
                    <line x1="330" y1="195" x2="475" y2="195" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-webmcp)" />
                    <text x="402" y="188" textAnchor="middle" className="text-[10px]">postMessage</text>

                    {/* 4. Page result */}
                    <line x1="480" y1="230" x2="335" y2="230" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-webmcp)" />
                    <text x="407" y="223" textAnchor="middle" className="text-[10px]">Result</text>

                    {/* 5. Tool result */}
                    <line x1="330" y1="265" x2="190" y2="265" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-webmcp)" />
                    <text x="260" y="258" textAnchor="middle" className="text-[10px]">webmcp/tool/result</text>

                    {/* requestId in result */}
                    <rect x="218" y="275" width="85" height="18" rx="2" className="fill-green-50 stroke-green-400 dark:fill-green-900/30 dark:stroke-green-500" strokeWidth="1" />
                    <text x="260" y="287" textAnchor="middle" className="text-[8px] fill-green-700 dark:fill-green-400">requestId: "abc-123"</text>

                    {/* 6. Response to caller */}
                    <line x1="185" y1="310" x2="70" y2="310" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-webmcp)" />
                    <text x="127" y="303" textAnchor="middle" className="text-[10px]">Response</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-webmcp" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
