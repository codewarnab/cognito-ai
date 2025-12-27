import type { SVGProps } from "react";

const VertexAI = (props: SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 48 48" fill="none">
        {/* Vertex AI logo - colorful data points flowing into chevron */}
        {/* Left column - Red */}
        <circle cx="12" cy="8" r="2.5" fill="#EA4335" />
        <circle cx="12" cy="16" r="2.5" fill="#EA4335" />
        <circle cx="12" cy="24" r="2.5" fill="#EA4335" />
        {/* Middle-left column - Green */}
        <circle cx="20" cy="12" r="2.5" fill="#34A853" />
        <circle cx="20" cy="20" r="2.5" fill="#34A853" />
        <circle cx="20" cy="28" r="2.5" fill="#34A853" />
        {/* Middle-right column - Blue */}
        <circle cx="28" cy="8" r="2.5" fill="#4285F4" />
        <circle cx="28" cy="16" r="2.5" fill="#4285F4" />
        <circle cx="28" cy="24" r="2.5" fill="#4285F4" />
        {/* Right column - Blue */}
        <circle cx="36" cy="12" r="2.5" fill="#4285F4" />
        <circle cx="36" cy="20" r="2.5" fill="#4285F4" />
        <circle cx="36" cy="28" r="2.5" fill="#4285F4" />
        {/* Bottom chevron - Yellow/Gold */}
        <path
            d="M8 32L24 44L40 32"
            stroke="#FBBC04"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
    </svg>
);

export { VertexAI };
