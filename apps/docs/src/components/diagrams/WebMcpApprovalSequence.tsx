export function WebMcpApprovalSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 520 340" className="w-full max-w-xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="40" y="10" width="70" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="75" y="30" textAnchor="middle" className="text-[10px] font-medium">AI Model</text>

                    <rect x="155" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="195" y="30" textAnchor="middle" className="text-[10px] font-medium">Approval UI</text>

                    <rect x="280" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="320" y="30" textAnchor="middle" className="text-[10px] font-medium">Background</text>

                    <rect x="405" y="10" width="85" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="447" y="30" textAnchor="middle" className="text-[10px] font-medium">Content Script</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="75" y1="40" x2="75" y2="330" />
                    <line x1="195" y1="40" x2="195" y2="330" />
                    <line x1="320" y1="40" x2="320" y2="330" />
                    <line x1="447" y1="40" x2="447" y2="330" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. Tool call (no execute) */}
                    <line x1="75" y1="70" x2="190" y2="70" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-webmcp)" />
                    <text x="132" y="63" textAnchor="middle" className="text-[10px]">Tool call (pending)</text>

                    {/* 2. Check auto-approved? */}
                    <path d="M 195 90 Q 230 90 230 105 Q 230 120 195 120" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-webmcp)" />
                    <text x="245" y="108" className="text-[10px]">Check auto-approved?</text>

                    {/* Alt box */}
                    <rect x="130" y="135" width="130" height="65" rx="3" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1" />
                    <text x="140" y="150" className="text-[10px] font-semibold fill-gray-600 dark:fill-gray-400">alt</text>
                    <text x="140" y="165" className="text-[9px] fill-gray-500 dark:fill-gray-400">[Not approved]</text>

                    {/* Show approval dialog */}
                    <path d="M 195 175 Q 230 175 230 182 Q 230 189 195 189" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-webmcp)" />
                    <text x="180" y="183" textAnchor="end" className="text-[9px]">Show dialog</text>

                    {/* Note: Approval options */}
                    <rect x="35" y="205" width="125" height="28" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="97" y="218" textAnchor="middle" className="text-[8px] fill-amber-700 dark:fill-amber-400">Allow | Trust Domain</text>
                    <text x="97" y="228" textAnchor="middle" className="text-[8px] fill-amber-700 dark:fill-amber-400">Always Allow | Session Only</text>

                    {/* 3. Execute tool */}
                    <line x1="195" y1="250" x2="315" y2="250" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-webmcp)" />
                    <text x="255" y="243" textAnchor="middle" className="text-[10px]">Execute tool</text>

                    {/* 4. Forward to content script */}
                    <line x1="320" y1="275" x2="442" y2="275" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-webmcp)" />
                    <text x="381" y="268" textAnchor="middle" className="text-[10px]">Forward to page</text>

                    {/* 5. Tool result */}
                    <line x1="447" y1="300" x2="325" y2="300" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-webmcp)" />
                    <text x="386" y="293" textAnchor="middle" className="text-[10px]">Tool result</text>

                    {/* 6. addToolOutput */}
                    <line x1="320" y1="320" x2="80" y2="320" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-webmcp)" />
                    <text x="200" y="313" textAnchor="middle" className="text-[10px]">addToolOutput()</text>
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
