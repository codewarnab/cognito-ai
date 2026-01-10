export function StdioMcpSequence() {
  return (
    <div className="not-prose my-6 font-mono text-sm">
      <svg viewBox="0 0 520 380" className="w-full max-w-xl">
        {/* Participants */}
        <g className="fill-current text-gray-800 dark:text-gray-200">
          <rect x="50" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
          <text x="90" y="30" textAnchor="middle" className="text-xs font-medium">Extension</text>

          <rect x="220" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
          <text x="260" y="30" textAnchor="middle" className="text-xs font-medium">Backend</text>

          <rect x="390" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
          <text x="430" y="30" textAnchor="middle" className="text-xs font-medium">MCP Process</text>
        </g>

        {/* Lifelines */}
        <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
          <line x1="90" y1="40" x2="90" y2="370" />
          <line x1="260" y1="40" x2="260" y2="370" />
          <line x1="430" y1="40" x2="430" y2="370" />
        </g>

        {/* Messages */}
        <g className="fill-current text-gray-700 dark:text-gray-300">
          {/* Discovery Phase */}
          {/* 1. Discover tools request */}
          <line x1="90" y1="70" x2="255" y2="70" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-stdio)" />
          <text x="172" y="63" textAnchor="middle" className="text-[10px]">Discover tools request</text>

          {/* Note: Lookup server */}
          <rect x="195" y="80" width="130" height="20" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
          <text x="260" y="94" textAnchor="middle" className="text-[9px] fill-amber-700 dark:fill-amber-400">Lookup server in registry</text>

          {/* 2. Spawn process */}
          <line x1="260" y1="115" x2="425" y2="115" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-stdio)" />
          <text x="342" y="108" textAnchor="middle" className="text-[10px]">Spawn process</text>

          {/* 3. Tool schemas */}
          <line x1="430" y1="145" x2="265" y2="145" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-stdio)" />
          <text x="347" y="138" textAnchor="middle" className="text-[10px]">Tool schemas</text>

          {/* 4. Available tools */}
          <line x1="260" y1="175" x2="95" y2="175" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-stdio)" />
          <text x="177" y="168" textAnchor="middle" className="text-[10px]">Available tools</text>

          {/* Separator line */}
          <line x1="40" y1="205" x2="480" y2="205" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="1" strokeDasharray="8 4" />
          <text x="50" y="220" className="text-[9px] fill-gray-500 dark:fill-gray-400 italic">Execution</text>

          {/* Execution Phase */}
          {/* 5. Execute tool request */}
          <line x1="90" y1="245" x2="255" y2="245" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-stdio)" />
          <text x="172" y="238" textAnchor="middle" className="text-[10px]">Execute tool request</text>

          {/* 6. Call via stdin */}
          <line x1="260" y1="280" x2="425" y2="280" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-stdio)" />
          <text x="342" y="273" textAnchor="middle" className="text-[10px]">Call via stdin</text>

          {/* 7. Result via stdout */}
          <line x1="430" y1="315" x2="265" y2="315" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-stdio)" />
          <text x="347" y="308" textAnchor="middle" className="text-[10px]">Result via stdout</text>

          {/* 8. Tool result */}
          <line x1="260" y1="350" x2="95" y2="350" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-stdio)" />
          <text x="177" y="343" textAnchor="middle" className="text-[10px]">Tool result</text>
        </g>

        {/* Arrow marker */}
        <defs>
          <marker id="arrow-stdio" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
