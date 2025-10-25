import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import logoImage from '../../assets/logo.png';

interface OnboardingScreenProps {
    onComplete?: () => void;
    showSkip?: boolean;
    onSkip?: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
    onComplete,
    showSkip = true,
    onSkip
}) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        console.log('OnboardingScreen mounted');
        // Trigger animation on mount
        const timer = setTimeout(() => {
            setIsVisible(true);
            console.log('OnboardingScreen animation triggered');
        }, 100);

        // Auto-complete after animation finishes
        if (onComplete) {
            const completeTimer = setTimeout(() => {
                onComplete();
            }, 3000); // 3 seconds total animation time

            return () => clearTimeout(completeTimer);
        }

        return () => clearTimeout(timer);
    }, [onComplete]);

    const handleSkip = () => {
        if (onSkip) {
            onSkip();
        } else if (onComplete) {
            onComplete();
        }
    };

    return (
        <div className="onboarding-screen">
            {/* Skip button */}
            {showSkip && (
                <motion.button
                    className="onboarding-skip"
                    onClick={handleSkip}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.3 }}
                >
                    Skip
                </motion.button>
            )}

            {/* Main content */}
            <div className="onboarding-content">
                {/* Logo with slide-in animation */}
                <motion.div
                    className="onboarding-logo"
                    initial={{ 
                        opacity: 0, 
                        scale: 0.8,
                        y: 50
                    }}
                    animate={isVisible ? { 
                        opacity: 1, 
                        scale: 1,
                        y: 0
                    } : {}}
                    transition={{ 
                        duration: 0.8, 
                        ease: "easeOut",
                        delay: 0.2
                    }}
                >
                    <img 
                        src={logoImage} 
                        alt="Chrome AI Agent" 
                        width={120} 
                        height={120}
                        style={{ objectFit: 'contain' }}
                    />
                </motion.div>

                {/* Welcome text with slide-in animation */}
                <motion.div
                    className="onboarding-text"
                    initial={{ 
                        opacity: 0, 
                        y: 30
                    }}
                    animate={isVisible ? { 
                        opacity: 1, 
                        y: 0
                    } : {}}
                    transition={{ 
                        duration: 0.6, 
                        ease: "easeOut",
                        delay: 0.6
                    }}
                >
                    <h1 className="onboarding-title">Welcome to Chrome AI</h1>
                    <p className="onboarding-subtitle">
                        Your Autonomous AI Browser Agent
                    </p>
                    <p className="onboarding-description">
                        I can browse, click, fill forms, manage tabs, and execute tasks end-to-end. 
                        Just tell me what you need!
                    </p>
                </motion.div>

            </div>
        </div>
    );
};
