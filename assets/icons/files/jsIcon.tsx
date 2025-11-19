import { useState } from "react";
import { motion, useAnimation } from "framer-motion";

export const JSIcon = ({ size = 24 }) => {
    const controls = useAnimation();
    const [isHovered, setIsHovered] = useState(false);

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
                setIsHovered(true);
                controls.start("animate");
                e.currentTarget.style.backgroundColor = 'rgba(254, 252, 232, 1)';
            }}
            onMouseLeave={(e) => {
                setIsHovered(false);
                controls.start("normal");
                e.currentTarget.style.backgroundColor = 'transparent';
            }}
        >
            <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                width={size}
                height={size}
                viewBox="0 0 24 24"
                variants={{
                    normal: { scale: 1, rotate: "0deg" },
                    animate: { scale: 1.1, rotate: "5deg" },
                }}
                animate={controls}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
                {/* File shape background with JavaScript yellow theme */}
                <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    fill="#F7DF1E"
                    stroke="#000"
                    strokeWidth="1.5"
                />
                <polyline
                    points="14 2 14 8 20 8"
                    fill="none"
                    stroke="#000"
                    strokeWidth="1.5"
                />

                {/* JS text */}
                <text
                    x="50%"
                    y="60%"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill="#000"
                    style={{
                        fontSize: "6px",
                        fontWeight: "bold",
                        fontFamily: "monospace",
                    }}
                >
                    JS
                </text>
            </motion.svg>
        </div>
    );
};

export default JSIcon;
