export function MessageFlowSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 580 280" className="w-full max-w-2xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="40" y="10" width="90" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="85" y="30" textAnchor="middle" className="text-[10px] font-medium">Side Panel</text>

                    <rect x="200" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="250" y="30" textAnchor="middle" className="text-[10px] font-medium">Background SW</text>

                    <rect x="370" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="420" y="30" textAnchor="middle" className="text-[10px] font-medium">Content Script</text>

                    <rect x="510" y="10" width="60" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="540" y="30" textAnchor="middle" className="text-[10px] font-medium">Page</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="85" y1="40" x2="85" y2="270" />
                    <line x1="250" y1="40" x2="250" y2="270" />
                    <line x1="420" y1="40" x2="420" y2="270" />
                    <line x1="540" y1="40" x2="540" y2="270" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. SP to BG */}
                    <line x1="85" y1="70" x2="245" y2="70" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-msg)" />
                    <text x="165" y="63" textAnchor="middle" className="text-[10px]">chrome.runtime.sendMessage</text>

                    {/* Note: Type routing */}
                    <rect x="175" y="85" width="150" height="35" rx="2" className="fill-blue-50 stroke-blue-400 dark:fill-blue-900/30 dark:stroke-blue-500" strokeWidth="1" />
                    <text x="250" y="100" textAnchor="middle" className="text-[9px] fill-blue-700 dark:fill-blue-400">Router checks type prefix:</text>
                    <text x="250" y="112" textAnchor="middle" className="text-[9px] fill-blue-700 dark:fill-blue-400">mcp/, webmcp/, dom/, settings/</text>

                    {/* 2. BG to CS */}
                    <line x1="250" y1="140" x2="415" y2="140" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-msg)" />
                    <text x="332" y="133" textAnchor="middle" className="text-[10px]">chrome.tabs.sendMessage</text>

                    {/* 3. CS to Page */}
                    <line x1="420" y1="175" x2="535" y2="175" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-msg)" />
                    <text x="477" y="168" textAnchor="middle" className="text-[10px]">postMessage</text>

                    {/* 4. Page response */}
                    <line x1="540" y1="205" x2="425" y2="205" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-msg)" />
                    <text x="482" y="198" textAnchor="middle" className="text-[10px]">Result</text>

                    {/* 5. CS response */}
                    <line x1="420" y1="235" x2="255" y2="235" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-msg)" />
                    <text x="337" y="228" textAnchor="middle" className="text-[10px]">Response</text>

                    {/* 6. BG response */}
                    <line x1="250" y1="260" x2="90" y2="260" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-msg)" />
                    <text x="170" y="253" textAnchor="middle" className="text-[10px]">sendResponse</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-msg" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
