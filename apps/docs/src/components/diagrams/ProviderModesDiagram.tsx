export function ProviderModesDiagram() {
    return (
        <div className="not-prose my-6">
            <svg viewBox="0 0 580 210" className="w-full max-w-2xl">
                {/* Header */}
                <text x="290" y="25" textAnchor="middle" 
                      className="text-sm font-bold fill-gray-600 dark:fill-gray-400 uppercase tracking-wider">
                    Choose Your Provider
                </text>

                {/* Local Mode */}
                <g>
                    <rect x="25" y="50" width="160" height="120" rx="10" 
                          className="fill-emerald-50 stroke-emerald-500 dark:fill-emerald-900/30 dark:stroke-emerald-400" 
                          strokeWidth="1.5" />
                    <text x="105" y="80" textAnchor="middle" 
                          className="text-base font-bold fill-emerald-700 dark:fill-emerald-300">
                        Local
                    </text>
                    <text x="105" y="102" textAnchor="middle" 
                          className="text-sm fill-emerald-600 dark:fill-emerald-400">
                        Chrome Built-in AI
                    </text>
                    <text x="105" y="122" textAnchor="middle" 
                          className="text-[13px] fill-gray-500 dark:fill-gray-400">
                        Gemini Nano
                    </text>
                    <rect x="45" y="135" width="120" height="24" rx="4" 
                          className="fill-emerald-100 dark:fill-emerald-800/40" />
                    <text x="105" y="152" textAnchor="middle" 
                          className="text-xs fill-emerald-600 dark:fill-emerald-400 font-medium">
                        No API key needed
                    </text>
                </g>

                {/* BYOK Mode */}
                <g>
                    <rect x="210" y="50" width="160" height="120" rx="10" 
                          className="fill-blue-50 stroke-blue-500 dark:fill-blue-900/30 dark:stroke-blue-400" 
                          strokeWidth="1.5" />
                    <text x="290" y="80" textAnchor="middle" 
                          className="text-base font-bold fill-blue-700 dark:fill-blue-300">
                        BYOK
                    </text>
                    <text x="290" y="102" textAnchor="middle" 
                          className="text-sm fill-blue-600 dark:fill-blue-400">
                        Your API Keys
                    </text>
                    <text x="290" y="122" textAnchor="middle" 
                          className="text-[13px] fill-gray-500 dark:fill-gray-400">
                        Any supported model
                    </text>
                    <rect x="230" y="135" width="120" height="24" rx="4" 
                          className="fill-blue-100 dark:fill-blue-800/40" />
                    <text x="290" y="152" textAnchor="middle" 
                          className="text-xs fill-blue-600 dark:fill-blue-400 font-medium">
                        Full control
                    </text>
                </g>

                {/* Cloud Mode */}
                <g>
                    <rect x="395" y="50" width="160" height="120" rx="10" 
                          className="fill-purple-50 stroke-purple-500 dark:fill-purple-900/30 dark:stroke-purple-400" 
                          strokeWidth="1.5" />
                    <text x="475" y="80" textAnchor="middle" 
                          className="text-base font-bold fill-purple-700 dark:fill-purple-300">
                        Cloud
                    </text>
                    <text x="475" y="102" textAnchor="middle" 
                          className="text-sm fill-purple-600 dark:fill-purple-400">
                        Cognito Backend
                    </text>
                    <text x="475" y="122" textAnchor="middle" 
                          className="text-[13px] fill-gray-500 dark:fill-gray-400">
                        gemini-2.5-flash
                    </text>
                    <rect x="415" y="135" width="120" height="24" rx="4" 
                          className="fill-purple-100 dark:fill-purple-800/40" />
                    <text x="475" y="152" textAnchor="middle" 
                          className="text-xs fill-purple-600 dark:fill-purple-400 font-medium">
                        Zero setup
                    </text>
                </g>

                {/* Decorative dots between */}
                <circle cx="193" cy="110" r="4" className="fill-gray-300 dark:fill-gray-600" />
                <circle cx="387" cy="110" r="4" className="fill-gray-300 dark:fill-gray-600" />
            </svg>
        </div>
    );
}
