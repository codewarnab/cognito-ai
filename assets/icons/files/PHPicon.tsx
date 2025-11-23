import { motion, useAnimation } from "framer-motion";
import type React from "react";

interface PHPIconProps {
    size?: number;
}

export const PHPIcon: React.FC<PHPIconProps> = ({ size = 24 }) => {
    const controls = useAnimation();

    return (
        <div
            role="button"
            tabIndex={0}
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
                controls.start("animate");
                e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 1)';
            }}
            onMouseLeave={(e) => {
                controls.start("normal");
                e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    controls.start("animate");
                    e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 1)';
                }
            }}
            onKeyUp={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    controls.start("normal");
                    e.currentTarget.style.backgroundColor = 'transparent';
                }
            }}
        >
            <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                width={size}
                height={size}
                viewBox="0 0 24 24"
                role="img"
                aria-label="PHP file icon"
                variants={{
                    normal: { scale: 1, rotate: "0deg" },
                    animate: { scale: 1.1, rotate: "5deg" },
                }}
                animate={controls}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
                {/* File shape background with PHP-inspired blue color */}
                {/* PHP color */}
                <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    fill="#777BB4"
                    stroke="#f0f0f0"
                    strokeWidth="1.5"
                />
                <polyline
                    points="14 2 14 8 20 8"
                    fill="none"
                    stroke="#f0f0f0"
                    strokeWidth="1.5"
                />

                {/* PHP text */}
                <text
                    x="50%"
                    y="60%"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill="#f0f0f0"
                    style={{
                        fontSize: "4px",
                        fontWeight: "bold",
                        fontFamily: "monospace",
                    }}
                >
                    PHP
                </text>
            </motion.svg>
        </div>
    );
};

export default PHPIcon;
