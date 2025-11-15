import type React from "react"

import { motion, useAnimation } from "framer-motion"
import { useState } from "react"

interface JSXIconProps {
    size?: number
}

const JSXIcon: React.FC<JSXIconProps> = ({ size = 24 }) => {
    const controls = useAnimation()
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div
            style={{
                cursor: 'pointer',
                userSelect: 'none',
                padding: '0.25rem',
                borderRadius: '0.375rem',
                transitionProperty: 'background-color',
                transitionDuration: '200ms',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
                setIsHovered(true)
                controls.start("animate")
                e.currentTarget.style.backgroundColor = 'rgba(239, 246, 255, 1)'
            }}
            onMouseLeave={(e) => {
                setIsHovered(false)
                controls.start("normal")
                e.currentTarget.style.backgroundColor = 'transparent'
            }}
        >
            <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                width={size}
                height={size}
                viewBox="0 0 24 24"
                variants={{
                    normal: {
                        scale: 1,
                        rotate: "0deg",
                    },
                    animate: {
                        scale: 1.1,
                        rotate: "5deg",
                    },
                }}
                animate={controls}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
                {/* File shape background */}
                <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    fill="#2B2B2B"
                    stroke="#61DAFB"
                    strokeWidth="1.5"
                />
                <polyline points="14 2 14 8 20 8" fill="none" stroke="#61DAFB" strokeWidth="1.5" />

                {/* JSX text */}
                <text
                    x="50%"
                    y="60%"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill="#61DAFB"
                    style={{
                        fontSize: "6px",
                        fontWeight: "bold",
                        fontFamily: "monospace",
                    }}
                >
                    JSX
                </text>

                {/* Small React logo */}
                <g transform="translate(12, 15) scale(0.3)">
                    <circle cx="0" cy="0" r="1.5" fill="#61DAFB" />
                    <ellipse cx="0" cy="0" rx="8" ry="3" fill="none" stroke="#61DAFB" strokeWidth="1" transform="rotate(0)" />
                    <ellipse cx="0" cy="0" rx="8" ry="3" fill="none" stroke="#61DAFB" strokeWidth="1" transform="rotate(60)" />
                    <ellipse cx="0" cy="0" rx="8" ry="3" fill="none" stroke="#61DAFB" strokeWidth="1" transform="rotate(120)" />
                </g>
            </motion.svg>
        </div>
    )
}

export default JSXIcon
