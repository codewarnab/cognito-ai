export function ProviderModesDiagram() {
    return (
        <div className="not-prose my-6">
            <svg viewBox="0 0 500 180" className="w-full max-w-xl">
                {/* Local Mode */}
                <g>
                    <rect x="20" y="40" width="140" height="100" rx="10" className="fill-emerald-50 stroke-emerald-500 dark:fill-emerald-900/30 dark:stroke-emerald-400" strokeWidth="1.5" />
                    <text x="90" y="65" textAnchor="middle" className="text-sm font-semibold fill-emerald-700 dark:fill-emerald-300">Local</text>
                    <text x="90" y="85" textAnchor="middle" className="text-[10px] fill-emerald-600 dark:fill-emerald-400">Chrome Built-in AI</text>
                    <text x="90" y="105" textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400">Gemini Nano</text>
                    <rect x="45" y="115" width="90" height="18" rx="3" className="fill-emerald-100 dark:fill-emerald-800/40" />
                    <text x="90" y="127" textAnchor="middle" className="text-[9px] fill-emerald-600 dark:fill-emerald-400">No API key needed</text>
                </g>

                {/* BYOK Mode */}
                <g>
                    <rect x="180" y="40" width="140" height="100" rx="10" className="fill-blue-50 stroke-blue-500 dark:fill-blue-900/30 dark:stroke-blue-400" strokeWidth="1.5" />
                    <text x="250" y="65" textAnchor="middle" className="text-sm font-semibold fill-blue-700 dark:fill-blue-300">BYOK</text>
                    <text x="250" y="85" textAnchor="middle" className="text-[10px] fill-blue-600 dark:fill-blue-400">Your API Keys</text>
                    <text x="250" y="105" textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400">Any supported model</text>
                    <rect x="205" y="115" width="90" height="18" rx="3" className="fill-blue-100 dark:fill-blue-800/40" />
                    <text x="250" y="127" textAnchor="middle" className="text-[9px] fill-blue-600 dark:fill-blue-400">Full control</text>
                </g>

                {/* Cloud Mode */}
                <g>
                    <rect x="340" y="40" width="140" height="100" rx="10" className="fill-purple-50 stroke-purple-500 dark:fill-purple-900/30 dark:stroke-purple-400" strokeWidth="1.5" />
                    <text x="410" y="65" textAnchor="middle" className="text-sm font-semibold fill-purple-700 dark:fill-purple-300">Cloud</text>
                    <text x="410" y="85" textAnchor="middle" className="text-[10px] fill-purple-600 dark:fill-purple-400">Cognito Backend</text>
                    <text x="410" y="105" textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400">gemini-2.5-flash</text>
                    <rect x="365" y="115" width="90" height="18" rx="3" className="fill-purple-100 dark:fill-purple-800/40" />
                    <text x="410" y="127" textAnchor="middle" className="text-[9px] fill-purple-600 dark:fill-purple-400">Zero setup</text>
                </g>

                {/* Header */}
                <text x="250" y="22" textAnchor="middle" className="text-[11px] font-semibold fill-gray-600 dark:fill-gray-400 uppercase tracking-wider">Choose Your Provider</text>

                {/* Decorative dots between */}
                <circle cx="167" cy="90" r="3" className="fill-gray-300 dark:fill-gray-600" />
                <circle cx="327" cy="90" r="3" className="fill-gray-300 dark:fill-gray-600" />
            </svg>
        </div>
    );
}
