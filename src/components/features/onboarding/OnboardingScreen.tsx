import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { WelcomePage } from './WelcomePage';
import { FeaturesPage } from './FeaturesPage';
import { CapabilitiesPage } from './CapabilitiesPage';
import { GetStartedPage } from './GetStartedPage';

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
    const [currentPage, setCurrentPage] = useState(0);
    const [[page, direction], setPage] = useState([0, 0]);

    const totalPages = 4;

    useEffect(() => {
        console.log('OnboardingScreen mounted');
        // Animation happens automatically on mount
        return () => { };
    }, []);

    const handleSkip = () => {
        if (onSkip) {
            onSkip();
        } else if (onComplete) {
            onComplete();
        }
    };

    const paginate = (newDirection: number) => {
        const newPage = currentPage + newDirection;
        if (newPage >= 0 && newPage < totalPages) {
            setPage([newPage, newDirection]);
            setCurrentPage(newPage);
        }
    };

    const handleDone = () => {
        if (onComplete) {
            onComplete();
        }
    };

    const renderPage = () => {
        switch (currentPage) {
            case 0:
                return <WelcomePage />;
            case 1:
                return <FeaturesPage />;
            case 2:
                return <CapabilitiesPage />;
            case 3:
                return <GetStartedPage />;
            default:
                return <WelcomePage />;
        }
    };

    const progressPercentage = ((currentPage + 1) / totalPages) * 100;

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
                {/* Animated Page Content */}
                <div className="onboarding-page-wrapper">
                    <AnimatePresence mode="sync" initial={false} custom={direction}>
                        <motion.div
                            key={page}
                            custom={direction}
                            initial={{ x: direction > 0 ? '20%' : '-20%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 35 },
                                opacity: { duration: 0.2 }
                            }}
                            className="onboarding-page-slide"
                        >
                            {renderPage()}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer Navigation */}
                <motion.div
                    className="onboarding-footer"
                    initial={{
                        opacity: 1,
                        y: 0
                    }}
                    animate={{
                        opacity: 1,
                        y: 0
                    }}
                    transition={{
                        duration: 0,
                        ease: "easeOut"
                    }}
                >
                    {/* Progress Indicator */}
                    <div className="onboarding-progress">
                        <div className="onboarding-progress-bar">
                            <motion.div
                                className="onboarding-progress-fill"
                                animate={{ width: `${progressPercentage}%` }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                            ></motion.div>
                        </div>
                        <div className="onboarding-progress-dots">
                            {[0, 1, 2, 3].map((index) => (
                                <div
                                    key={index}
                                    className={`onboarding-dot ${currentPage === index ? 'active' : ''}`}
                                ></div>
                            ))}
                        </div>
                    </div>

                    {/* Animated Navigation Buttons */}
                    <div className="onboarding-button-container">
                        <AnimatePresence mode="popLayout">
                            {currentPage === 0 && (
                                <motion.div
                                    layout
                                    key="single-button"
                                    initial={{ width: "50%" }}
                                    animate={{ width: "100%" }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 300,
                                        damping: 30,
                                        mass: 1
                                    }}
                                    className="onboarding-button-wrapper onboarding-button-wrapper--single"
                                >
                                    <motion.button
                                        layout
                                        onClick={() => paginate(1)}
                                        className="onboarding-button onboarding-button--primary"
                                    >
                                        <span>Next</span>
                                        <div className="onboarding-button-icon onboarding-button-icon--right">
                                            <ArrowRight size={18} />
                                        </div>
                                    </motion.button>
                                </motion.div>
                            )}

                            {currentPage === 1 && (
                                <motion.div
                                    layout
                                    className="onboarding-button-group"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    key="two-buttons-1"
                                >
                                    <motion.button
                                        layout
                                        onClick={() => paginate(-1)}
                                        className="onboarding-button onboarding-button--secondary"
                                        style={{ flex: 1 }}
                                    >
                                        <div className="onboarding-button-icon onboarding-button-icon--left">
                                            <ArrowLeft size={18} />
                                        </div>
                                        <span>Back</span>
                                    </motion.button>
                                    <motion.button
                                        layout
                                        onClick={() => paginate(1)}
                                        className="onboarding-button onboarding-button--primary"
                                        style={{ flex: 1 }}
                                    >
                                        <span>Next</span>
                                        <div className="onboarding-button-icon onboarding-button-icon--right">
                                            <ArrowRight size={18} />
                                        </div>
                                    </motion.button>
                                </motion.div>
                            )}

                            {currentPage === 2 && (
                                <motion.div
                                    layout
                                    className="onboarding-button-group"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    key="two-buttons-2"
                                >
                                    <motion.button
                                        layout
                                        onClick={() => paginate(-1)}
                                        className="onboarding-button onboarding-button--secondary"
                                        style={{ flex: 1 }}
                                    >
                                        <div className="onboarding-button-icon onboarding-button-icon--left">
                                            <ArrowLeft size={18} />
                                        </div>
                                        <span>Back</span>
                                    </motion.button>
                                    <motion.button
                                        layout
                                        onClick={() => paginate(1)}
                                        className="onboarding-button onboarding-button--primary"
                                        style={{ flex: 1 }}
                                    >
                                        <span>Next</span>
                                        <div className="onboarding-button-icon onboarding-button-icon--right">
                                            <ArrowRight size={18} />
                                        </div>
                                    </motion.button>
                                </motion.div>
                            )}

                            {currentPage === 3 && (
                                <motion.div
                                    layout
                                    className="onboarding-button-group"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    key="two-buttons-3"
                                >
                                    <motion.button
                                        layout
                                        onClick={() => paginate(-1)}
                                        className="onboarding-button onboarding-button--secondary"
                                        style={{ flex: 1 }}
                                    >
                                        <div className="onboarding-button-icon onboarding-button-icon--left">
                                            <ArrowLeft size={18} />
                                        </div>
                                        <span>Back</span>
                                    </motion.button>
                                    <motion.button
                                        layout
                                        onClick={handleDone}
                                        className="onboarding-button onboarding-button--primary"
                                        style={{ flex: 1 }}
                                    >
                                        <span>Get Started</span>
                                        <div className="onboarding-button-icon onboarding-button-icon--right">
                                            {/* <Check size={18} /> */}
                                        </div>
                                    </motion.button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

            </div>
        </div>
    );
};
