export function ExtensionContextsDiagram() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 620 340" className="w-full max-w-2xl">
                {/* Extension Container */}
                <rect x="20" y="20" width="380" height="240" rx="8" className="fill-gray-50 stroke-gray-300 dark:fill-gray-900 dark:stroke-gray-600" strokeWidth="2" strokeDasharray="5 3" />
                <text x="35" y="45" className="text-[11px] font-semibold fill-gray-500 dark:fill-gray-400">Extension Contexts</text>

                {/* Side Panel */}
                <rect x="40" y="70" width="100" height="80" rx="6" className="fill-blue-100 stroke-blue-500 dark:fill-blue-900/50 dark:stroke-blue-400" strokeWidth="2" />
                <text x="90" y="100" textAnchor="middle" className="text-[11px] font-semibold fill-blue-700 dark:fill-blue-300">Side Panel</text>
                <text x="90" y="115" textAnchor="middle" className="text-[9px] fill-blue-600 dark:fill-blue-400">React UI</text>
                <text x="90" y="128" textAnchor="middle" className="text-[9px] fill-blue-600 dark:fill-blue-400">Chat + AI Calls</text>

                {/* Background SW */}
                <rect x="160" y="70" width="110" height="80" rx="6" className="fill-purple-100 stroke-purple-500 dark:fill-purple-900/50 dark:stroke-purple-400" strokeWidth="2" />
                <text x="215" y="100" textAnchor="middle" className="text-[11px] font-semibold fill-purple-700 dark:fill-purple-300">Background</text>
                <text x="215" y="115" textAnchor="middle" className="text-[9px] fill-purple-600 dark:fill-purple-400">Service Worker</text>
                <text x="215" y="128" textAnchor="middle" className="text-[9px] fill-purple-600 dark:fill-purple-400">MCP + Routing</text>

                {/* Content Scripts */}
                <rect x="290" y="70" width="100" height="80" rx="6" className="fill-green-100 stroke-green-500 dark:fill-green-900/50 dark:stroke-green-400" strokeWidth="2" />
                <text x="340" y="100" textAnchor="middle" className="text-[11px] font-semibold fill-green-700 dark:fill-green-300">Content</text>
                <text x="340" y="115" textAnchor="middle" className="text-[9px] fill-green-600 dark:fill-green-400">Scripts</text>
                <text x="340" y="128" textAnchor="middle" className="text-[9px] fill-green-600 dark:fill-green-400">Page Access</text>

                {/* Storage */}
                <rect x="120" y="175" width="180" height="50" rx="6" className="fill-amber-100 stroke-amber-500 dark:fill-amber-900/50 dark:stroke-amber-400" strokeWidth="2" />
                <text x="210" y="200" textAnchor="middle" className="text-[11px] font-semibold fill-amber-700 dark:fill-amber-300">Chrome Storage</text>
                <text x="210" y="213" textAnchor="middle" className="text-[9px] fill-amber-600 dark:fill-amber-400">Synced State</text>

                {/* Browser Container */}
                <rect x="420" y="20" width="180" height="300" rx="8" className="fill-gray-50 stroke-gray-300 dark:fill-gray-900 dark:stroke-gray-600" strokeWidth="2" strokeDasharray="5 3" />
                <text x="435" y="45" className="text-[11px] font-semibold fill-gray-500 dark:fill-gray-400">Browser / External</text>

                {/* Web Page */}
                <rect x="440" y="70" width="140" height="70" rx="6" className="fill-rose-100 stroke-rose-500 dark:fill-rose-900/50 dark:stroke-rose-400" strokeWidth="2" />
                <text x="510" y="95" textAnchor="middle" className="text-[11px] font-semibold fill-rose-700 dark:fill-rose-300">Web Page</text>
                <text x="510" y="110" textAnchor="middle" className="text-[9px] fill-rose-600 dark:fill-rose-400">DOM + Page Tools</text>

                {/* AI Backend */}
                <rect x="440" y="160" width="140" height="60" rx="6" className="fill-cyan-100 stroke-cyan-500 dark:fill-cyan-900/50 dark:stroke-cyan-400" strokeWidth="2" />
                <text x="510" y="185" textAnchor="middle" className="text-[11px] font-semibold fill-cyan-700 dark:fill-cyan-300">AI Backend</text>
                <text x="510" y="200" textAnchor="middle" className="text-[9px] fill-cyan-600 dark:fill-cyan-400">Chat API</text>

                {/* MCP Servers */}
                <rect x="440" y="240" width="140" height="60" rx="6" className="fill-indigo-100 stroke-indigo-500 dark:fill-indigo-900/50 dark:stroke-indigo-400" strokeWidth="2" />
                <text x="510" y="265" textAnchor="middle" className="text-[11px] font-semibold fill-indigo-700 dark:fill-indigo-300">MCP Servers</text>
                <text x="510" y="280" textAnchor="middle" className="text-[9px] fill-indigo-600 dark:fill-indigo-400">External Tools</text>

                {/* Arrows */}
                {/* SP to AI Backend (direct) */}
                <path d="M 140 95 L 200 60 L 420 60 L 500 60 L 500 70" className="stroke-cyan-500 dark:stroke-cyan-400" strokeWidth="1.5" markerEnd="url(#arrow-ctx-cyan)" fill="none" />
                <text x="280" y="53" textAnchor="middle" className="text-[8px] fill-cyan-600 dark:fill-cyan-400">chat requests</text>

                {/* BG to CS */}
                <path d="M 270 110 L 285 110" className="stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" markerEnd="url(#arrow-ctx)" fill="none" />

                {/* CS to Page */}
                <path d="M 390 105 L 435 105" className="stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" markerEnd="url(#arrow-ctx)" fill="none" />

                {/* SP to Storage */}
                <path d="M 90 150 L 90 170 L 115 175" className="stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" markerEnd="url(#arrow-ctx)" fill="none" />

                {/* BG to Storage */}
                <path d="M 215 150 L 215 170" className="stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" markerEnd="url(#arrow-ctx)" fill="none" />

                {/* BG to MCP */}
                <path d="M 270 130 L 350 240 L 350 270 L 435 270" className="stroke-indigo-500 dark:stroke-indigo-400" strokeWidth="1.5" markerEnd="url(#arrow-ctx-indigo)" fill="none" />
                <text x="300" y="260" textAnchor="middle" className="text-[8px] fill-indigo-600 dark:fill-indigo-400">MCP</text>

                {/* Arrow markers */}
                <defs>
                    <marker id="arrow-ctx" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-500 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-ctx-cyan" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-cyan-500 dark:fill-cyan-400" />
                    </marker>
                    <marker id="arrow-ctx-indigo" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-indigo-500 dark:fill-indigo-400" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
