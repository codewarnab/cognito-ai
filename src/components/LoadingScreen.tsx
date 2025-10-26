import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import logoImage from '../../assets/logo.png';

interface LoadingScreenProps {
    duration?: number; // Duration in seconds
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ duration = 10 }) => {
    const [countdown, setCountdown] = useState(duration);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [duration]);

    return (
        <div className="loading-screen">
            <div className="loading-content">
                {/* Logo with subtle animation */}
                <motion.div
                    className="loading-logo"
                    animate={{ 
                        rotate: [0, 5, -5, 0],
                        scale: [1, 1.05, 1]
                    }}
                    transition={{ 
                        duration: 2, 
                        repeat: Infinity, 
                        ease: "easeInOut" 
                    }}
                >
                    <img 
                        src={logoImage} 
                        alt="Chrome AI Agent" 
                        width={80} 
                        height={80}
                        style={{ objectFit: 'contain' }}
                    />
                </motion.div>

                {/* Loading text */}
                <motion.div
                    className="loading-text"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                >
                    <h2 className="loading-title">Preparing Your AI Assistant</h2>
                    <p className="loading-subtitle">Setting up your autonomous browser agent...</p>
                </motion.div>

                {/* Countdown */}
                <motion.div
                    className="loading-countdown"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 0.4 }}
                >
                    <div className="countdown-circle">
                        <span className="countdown-number">{countdown}</span>
                    </div>
                    <p className="countdown-text">Starting in {countdown} seconds</p>
                </motion.div>

                {/* Progress bar */}
                <motion.div
                    className="loading-progress"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5, duration: 0.4 }}
                >
                    <div className="progress-bar">
                        <motion.div
                            className="progress-fill"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: duration, ease: "linear" }}
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
