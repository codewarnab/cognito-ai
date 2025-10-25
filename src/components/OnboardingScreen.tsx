import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
                {/* Welcome text at the top */}
                <motion.div
                    className="onboarding-text"
                    initial={{ 
                        opacity: 0, 
                        y: -30
                    }}
                    animate={isVisible ? { 
                        opacity: 1, 
                        y: 0
                    } : {}}
                    transition={{ 
                        duration: 0.6, 
                        ease: "easeOut",
                        delay: 0.2
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

                {/* Logo in the center with slide-in animation */}
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
                        delay: 0.6
                    }}
                >
                    <img 
                        src={logoImage} 
                        alt="Chrome AI Agent" 
                        width={400} 
                        height={400}
                        style={{ objectFit: 'contain' }}
                    />
                </motion.div>

                {/* Footer Navigation */}
                <motion.div
                    className="onboarding-footer"
                    initial={{ 
                        opacity: 0, 
                        y: 20
                    }}
                    animate={isVisible ? { 
                        opacity: 1, 
                        y: 0
                    } : {}}
                    transition={{ 
                        duration: 0.4, 
                        ease: "easeOut",
                        delay: 0.8
                    }}
                >
                    {/* Progress Indicator */}
                    <div className="onboarding-progress">
                        <div className="onboarding-progress-bar">
                            <div className="onboarding-progress-fill"></div>
                        </div>
                        <div className="onboarding-progress-dots">
                            <div className="onboarding-dot active"></div>
                            <div className="onboarding-dot"></div>
                            <div className="onboarding-dot"></div>
                        </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="onboarding-navigation">
                        <button className="onboarding-nav-btn onboarding-nav-btn--back">
                            <ChevronLeft size={20} />
                        </button>
                        <button 
                            className="onboarding-nav-btn onboarding-nav-btn--next"
                            onClick={handleSkip}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </motion.div>

            </div>
        </div>
    );
};
