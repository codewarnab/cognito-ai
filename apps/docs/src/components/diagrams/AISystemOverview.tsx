export function AISystemOverview() {
    return (
        <div className="not-prose my-6">
            <svg viewBox="0 0 750 380" className="w-full max-w-3xl">
                {/* Central AI Core */}
                <g>
                    <circle cx="375" cy="175" r="60" 
                            className="fill-blue-100 stroke-blue-500 dark:fill-blue-900/40 dark:stroke-blue-400" 
                            strokeWidth="2" />
                    <text x="375" y="168" textAnchor="middle" 
                          className="text-base font-bold fill-blue-700 dark:fill-blue-300">
                        AI Core
                    </text>
                    <text x="375" y="190" textAnchor="middle" 
                          className="text-[13px] fill-blue-600 dark:fill-blue-400 italic">
                        Vercel AI SDK
                    </text>
                </g>

                {/* Providers (Left) */}
                <g>
                    <text x="105" y="45" textAnchor="middle" 
                          className="text-[13px] font-bold fill-gray-600 dark:fill-gray-400 uppercase tracking-wider">
                        Providers
                    </text>

                    <rect x="35" y="65" width="140" height="45" rx={6} 
                          className="fill-purple-100 stroke-purple-500 dark:fill-purple-900/40 dark:stroke-purple-400" 
                          strokeWidth="1.5" />
                    <text x="105" y="93" textAnchor="middle" 
                          className="text-sm font-medium fill-purple-700 dark:fill-purple-300">
                        Chrome AI
                    </text>

                    <rect x="35" y="125" width="140" height="45" rx={6} 
                          className="fill-purple-100 stroke-purple-500 dark:fill-purple-900/40 dark:stroke-purple-400" 
                          strokeWidth="1.5" />
                    <text x="105" y="153" textAnchor="middle" 
                          className="text-sm font-medium fill-purple-700 dark:fill-purple-300">
                        Your API Keys
                    </text>

                    <rect x="35" y="185" width="140" height="45" rx={6} 
                          className="fill-purple-100 stroke-purple-500 dark:fill-purple-900/40 dark:stroke-purple-400" 
                          strokeWidth="1.5" />
                    <text x="105" y="213" textAnchor="middle" 
                          className="text-sm font-medium fill-purple-700 dark:fill-purple-300">
                        Cloud Backend
                    </text>
                </g>

                {/* Tools (Right) */}
                <g>
                    <text x="645" y="45" textAnchor="middle" 
                          className="text-[13px] font-bold fill-gray-600 dark:fill-gray-400 uppercase tracking-wider">
                        Tools
                    </text>

                    <rect x="575" y="60" width="140" height="42" rx={6} 
                          className="fill-green-100 stroke-green-500 dark:fill-green-900/40 dark:stroke-green-400" 
                          strokeWidth="1.5" />
                    <text x="645" y="86" textAnchor="middle" 
                          className="text-sm font-medium fill-green-700 dark:fill-green-300">
                        Browser Tools
                    </text>

                    <rect x="575" y="112" width="140" height="42" rx={6} 
                          className="fill-green-100 stroke-green-500 dark:fill-green-900/40 dark:stroke-green-400" 
                          strokeWidth="1.5" />
                    <text x="645" y="138" textAnchor="middle" 
                          className="text-sm font-medium fill-green-700 dark:fill-green-300">
                        Server Tools
                    </text>

                    <rect x="575" y="164" width="140" height="42" rx={6} 
                          className="fill-green-100 stroke-green-500 dark:fill-green-900/40 dark:stroke-green-400" 
                          strokeWidth="1.5" />
                    <text x="645" y="190" textAnchor="middle" 
                          className="text-sm font-medium fill-green-700 dark:fill-green-300">
                        MCP Tools
                    </text>

                    <rect x="575" y="216" width="140" height="42" rx={6} 
                          className="fill-green-100 stroke-green-500 dark:fill-green-900/40 dark:stroke-green-400" 
                          strokeWidth="1.5" />
                    <text x="645" y="242" textAnchor="middle" 
                          className="text-sm font-medium fill-green-700 dark:fill-green-300">
                        WebMCP Tools
                    </text>
                </g>

                {/* Modes (Bottom) */}
                <g>
                    <text x="375" y="360" textAnchor="middle" 
                          className="text-[13px] font-bold fill-gray-600 dark:fill-gray-400 uppercase tracking-wider">
                        Modes
                    </text>

                    <rect x="210" y="300" width="95" height="42" rx={6} 
                          className="fill-amber-100 stroke-amber-500 dark:fill-amber-900/40 dark:stroke-amber-400" 
                          strokeWidth="1.5" />
                    <text x="257" y="326" textAnchor="middle" 
                          className="text-sm font-medium fill-amber-700 dark:fill-amber-300">
                        Chat
                    </text>

                    <rect x="320" y="300" width="95" height="42" rx={6} 
                          className="fill-amber-100 stroke-amber-500 dark:fill-amber-900/40 dark:stroke-amber-400" 
                          strokeWidth="1.5" />
                    <text x="367" y="326" textAnchor="middle" 
                          className="text-sm font-medium fill-amber-700 dark:fill-amber-300">
                        Agent
                    </text>

                    <rect x="430" y="300" width="95" height="42" rx={6} 
                          className="fill-amber-100 stroke-amber-500 dark:fill-amber-900/40 dark:stroke-amber-400" 
                          strokeWidth="1.5" />
                    <text x="477" y="326" textAnchor="middle" 
                          className="text-sm font-medium fill-amber-700 dark:fill-amber-300">
                        Adaptive
                    </text>
                </g>

                {/* Connection lines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1.5">
                    {/* Providers to Core */}
                    <line x1="175" y1="87" x2="315" y2="150" />
                    <line x1="175" y1="147" x2="315" y2="170" />
                    <line x1="175" y1="207" x2="315" y2="195" />

                    {/* Core to Tools */}
                    <line x1="435" y1="150" x2="575" y2="81" />
                    <line x1="435" y1="165" x2="575" y2="133" />
                    <line x1="435" y1="180" x2="575" y2="185" />
                    <line x1="435" y1="200" x2="575" y2="237" />

                    {/* Core to Modes */}
                    <line x1="340" y1="235" x2="280" y2="300" />
                    <line x1="375" y1="235" x2="375" y2="300" />
                    <line x1="410" y1="235" x2="470" y2="300" />
                </g>
            </svg>
        </div>
    );
}
