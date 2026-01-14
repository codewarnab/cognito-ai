export function ToolFlowDiagram() {
    return (
        <div className="not-prose my-6">
            <svg viewBox="0 0 580 250" className="w-full max-w-2xl">
                {/* Step 1: User Request */}
                <g>
                    <circle cx="75" cy="55" r="18" 
                            className="fill-gray-100 stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" 
                            strokeWidth="1.5" />
                    <text x="75" y="60" textAnchor="middle" 
                          className="text-sm font-bold fill-gray-600 dark:fill-gray-300">
                        1
                    </text>
                    <rect x="25" y="85" width="100" height="65" rx="8" 
                          className="fill-blue-100 stroke-blue-500 dark:fill-blue-900/40 dark:stroke-blue-400" 
                          strokeWidth="1.5" />
                    <text x="75" y="115" textAnchor="middle" 
                          className="text-sm font-medium fill-blue-700 dark:fill-blue-300">
                        User
                    </text>
                    <text x="75" y="135" textAnchor="middle" 
                          className="text-sm font-medium fill-blue-700 dark:fill-blue-300">
                        Request
                    </text>
                </g>

                {/* Step 2: AI Analysis */}
                <g>
                    <circle cx="205" cy="55" r="18" 
                            className="fill-gray-100 stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" 
                            strokeWidth="1.5" />
                    <text x="205" y="60" textAnchor="middle" 
                          className="text-sm font-bold fill-gray-600 dark:fill-gray-300">
                        2
                    </text>
                    <rect x="155" y="85" width="100" height="65" rx="8" 
                          className="fill-purple-100 stroke-purple-500 dark:fill-purple-900/40 dark:stroke-purple-400" 
                          strokeWidth="1.5" />
                    <text x="205" y="115" textAnchor="middle" 
                          className="text-sm font-medium fill-purple-700 dark:fill-purple-300">
                        AI
                    </text>
                    <text x="205" y="135" textAnchor="middle" 
                          className="text-sm font-medium fill-purple-700 dark:fill-purple-300">
                        Analysis
                    </text>
                </g>

                {/* Step 3: Tool Selection */}
                <g>
                    <circle cx="335" cy="55" r="18" 
                            className="fill-gray-100 stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" 
                            strokeWidth="1.5" />
                    <text x="335" y="60" textAnchor="middle" 
                          className="text-sm font-bold fill-gray-600 dark:fill-gray-300">
                        3
                    </text>
                    <rect x="285" y="85" width="100" height="65" rx="8" 
                          className="fill-green-100 stroke-green-500 dark:fill-green-900/40 dark:stroke-green-400" 
                          strokeWidth="1.5" />
                    <text x="335" y="115" textAnchor="middle" 
                          className="text-sm font-medium fill-green-700 dark:fill-green-300">
                        Tool
                    </text>
                    <text x="335" y="135" textAnchor="middle" 
                          className="text-sm font-medium fill-green-700 dark:fill-green-300">
                        Selection
                    </text>
                </g>

                {/* Step 4: Execution */}
                <g>
                    <circle cx="465" cy="55" r="18" 
                            className="fill-gray-100 stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" 
                            strokeWidth="1.5" />
                    <text x="465" y="60" textAnchor="middle" 
                          className="text-sm font-bold fill-gray-600 dark:fill-gray-300">
                        4
                    </text>
                    <rect x="415" y="85" width="100" height="65" rx="8" 
                          className="fill-amber-100 stroke-amber-500 dark:fill-amber-900/40 dark:stroke-amber-400" 
                          strokeWidth="1.5" />
                    <text x="465" y="115" textAnchor="middle" 
                          className="text-sm font-medium fill-amber-700 dark:fill-amber-300">
                        Execute
                    </text>
                    <text x="465" y="135" textAnchor="middle" 
                          className="text-sm font-medium fill-amber-700 dark:fill-amber-300">
                        & Respond
                    </text>
                </g>

                {/* Arrows */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="2" markerEnd="url(#arrowToolFlow)">
                    <line x1="125" y1="117" x2="150" y2="117" />
                    <line x1="255" y1="117" x2="280" y2="117" />
                    <line x1="385" y1="117" x2="410" y2="117" />
                </g>

                {/* Labels below */}
                <g className="text-[13px] fill-gray-500 dark:fill-gray-400 font-sans">
                    <text x="75" y="175" textAnchor="middle">"Search for X"</text>
                    <text x="205" y="175" textAnchor="middle">Determines intent</text>
                    <text x="335" y="175" textAnchor="middle">Picks web_search</text>
                    <text x="465" y="175" textAnchor="middle">Returns results</text>
                </g>

                {/* Loop indicator */}
                <path d="M 465 160 C 465 210 75 210 75 160" 
                      className="fill-none stroke-gray-300 dark:stroke-gray-600" 
                      strokeWidth="1.5" strokeDasharray="5 3" />
                <text x="270" y="225" textAnchor="middle" 
                      className="text-[13px] fill-gray-400 dark:fill-gray-500 italic">
                    Multi-step tasks loop back
                </text>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrowToolFlow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto">
                        <path d="M 0 0 L 10 4 L 0 8 z" className="fill-gray-400 dark:fill-gray-500" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
