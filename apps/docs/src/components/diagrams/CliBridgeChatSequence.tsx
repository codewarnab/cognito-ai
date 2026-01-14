export function CliBridgeChatSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 800 520" className="w-full max-w-4xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="20" y="10" width="90" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="65" y="30" textAnchor="middle" className="text-[11px] font-medium">Extension UI</text>

                    <rect x="140" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="190" y="30" textAnchor="middle" className="text-[11px] font-medium">CLI Bridge</text>

                    <rect x="280" y="10" width="110" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="335" y="30" textAnchor="middle" className="text-[11px] font-medium">Agent Handler</text>

                    <rect x="430" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="480" y="30" textAnchor="middle" className="text-[11px] font-medium">AI SDK</text>

                    <rect x="570" y="10" width="90" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="615" y="30" textAnchor="middle" className="text-[11px] font-medium">LLM API</text>

                    <rect x="695" y="10" width="90" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="740" y="30" textAnchor="middle" className="text-[11px] font-medium">Extension</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="65" y1="40" x2="65" y2="510" />
                    <line x1="190" y1="40" x2="190" y2="510" />
                    <line x1="335" y1="40" x2="335" y2="510" />
                    <line x1="480" y1="40" x2="480" y2="510" />
                    <line x1="615" y1="40" x2="615" y2="510" />
                    <line x1="740" y1="40" x2="740" y2="510" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. POST /cli/chat */}
                    <line x1="65" y1="65" x2="185" y2="65" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-chat)" />
                    <text x="125" y="58" textAnchor="middle" className="text-[10px]">POST /cli/chat</text>

                    {/* Note: request body */}
                    <rect x="70" y="73" width="115" height="30" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="127" y="86" textAnchor="middle" className="text-[9px] fill-amber-700 dark:fill-amber-400">{`{messages, agent,`}</text>
                    <text x="127" y="98" textAnchor="middle" className="text-[9px] fill-amber-700 dark:fill-amber-400">{`enabledTools, toolsMode}`}</text>

                    {/* 2. Route to handler */}
                    <line x1="190" y1="118" x2="330" y2="118" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-chat)" />
                    <text x="260" y="111" textAnchor="middle" className="text-[10px]">handleGeminiAgent()</text>

                    {/* 3. Build AI SDK tools */}
                    <path d="M 335 138 Q 375 138 375 153 Q 375 168 335 168" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-chat)" />
                    <text x="392" y="156" className="text-[10px]">buildAISDKTools()</text>

                    {/* 4. streamText() */}
                    <line x1="335" y1="190" x2="475" y2="190" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-chat)" />
                    <text x="405" y="183" textAnchor="middle" className="text-[10px]">streamText(model, tools)</text>

                    {/* 5. API call to LLM */}
                    <line x1="480" y1="215" x2="610" y2="215" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-chat)" />
                    <text x="545" y="208" textAnchor="middle" className="text-[10px]">Generate completion</text>

                    {/* Loop box for tool calls */}
                    <rect x="155" y="235" width="630" height="200" rx="3" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1" />
                    <text x="165" y="250" className="text-[10px] font-semibold fill-gray-600 dark:fill-gray-400">loop</text>
                    <text x="195" y="250" className="text-[9px] fill-gray-500 dark:fill-gray-400">[for each tool call]</text>

                    {/* 6. Tool call from LLM */}
                    <line x1="615" y1="270" x2="485" y2="270" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-cli-chat)" />
                    <text x="550" y="263" textAnchor="middle" className="text-[10px]">Tool call</text>

                    {/* 7. SSE tool_call event */}
                    <line x1="335" y1="295" x2="70" y2="295" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-cli-chat)" />
                    <text x="202" y="288" textAnchor="middle" className="text-[10px]">SSE: tool_call</text>

                    {/* 8. executeToolOnExtension */}
                    <line x1="480" y1="320" x2="735" y2="320" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-chat)" />
                    <text x="607" y="313" textAnchor="middle" className="text-[10px]">SSE: tool:execute</text>

                    {/* Note: Tool events channel */}
                    <rect x="595" y="328" width="150" height="22" rx="2" className="fill-blue-50 stroke-blue-400 dark:fill-blue-900/30 dark:stroke-blue-500" strokeWidth="1" />
                    <text x="670" y="343" textAnchor="middle" className="text-[9px] fill-blue-700 dark:fill-blue-400">/bridge/tools/events SSE</text>

                    {/* 9. Execute locally */}
                    <path d="M 740 360 Q 780 360 780 375 Q 780 390 740 390" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-chat)" />
                    <text x="775" y="378" className="text-[9px]">Execute</text>

                    {/* 10. Return result */}
                    <line x1="740" y1="405" x2="485" y2="405" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-cli-chat)" />
                    <text x="612" y="398" textAnchor="middle" className="text-[10px]">POST /bridge/tools/result</text>

                    {/* 11. SSE tool_result event */}
                    <line x1="335" y1="425" x2="70" y2="425" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-cli-chat)" />
                    <text x="202" y="418" textAnchor="middle" className="text-[10px]">SSE: tool_result</text>

                    {/* End of loop - Final response */}
                    <line x1="615" y1="455" x2="485" y2="455" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-cli-chat)" />
                    <text x="550" y="448" textAnchor="middle" className="text-[10px]">Text stream</text>

                    {/* 12. SSE text/done events */}
                    <line x1="335" y1="480" x2="70" y2="480" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-cli-chat)" />
                    <text x="202" y="473" textAnchor="middle" className="text-[10px]">SSE: text, done</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-cli-chat" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
