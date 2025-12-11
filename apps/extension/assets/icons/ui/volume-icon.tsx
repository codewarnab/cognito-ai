
import { motion } from "framer-motion";

interface AnimatedVolumeIconProps {
    size?: number;
}

const AnimatedVolumeIcon = ({ size = 18 }: AnimatedVolumeIconProps) => {
    const containerVariants = {
        hover: {
            scale: 1.1,
            transition: {
                duration: 0.3,
                ease: "easeOut",
            },
        },
        initial: {},
    };

    const waveVariants = {
        initial: {
            opacity: 1,
            scale: 1,
        },
        hover: {
            opacity: [1, 0.5, 1],
            scale: [1, 1.1, 1],
            transition: {
                repeat: Infinity,
                duration: 1,
                ease: "easeInOut",
            },
        },
    };

    return (
        <motion.svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={containerVariants}
            initial="initial"
            whileHover="hover"
        >
            {/* Speaker cone */}
            <motion.path
                d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"
            />

            {/* Inner sound wave */}
            <motion.path
                d="M16 9a5 5 0 0 1 0 6"
                variants={waveVariants}
                initial="initial"
                whileHover="hover"
            />

            {/* Outer sound wave */}
            <motion.path
                d="M19.364 18.364a9 9 0 0 0 0-12.728"
                variants={waveVariants}
                initial="initial"
                whileHover="hover"
                style={{ originX: "50%", originY: "50%" }}
            />
        </motion.svg>
    );
};

export default AnimatedVolumeIcon;