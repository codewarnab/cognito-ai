import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DeleteIcon } from '@assets/icons/ui/trash';
import type { DeleteIconHandle } from '@assets/icons/ui/trash';
import cssText from 'data-text:~/styles/trash-zone.css';

export const getStyle = () => {
    const style = document.createElement("style");
    style.textContent = cssText;
    return style;
};

interface Position {
    x: number;
    y: number;
}

interface TrashZoneProps {
    isVisible: boolean;           // Show/hide based on drag state
    isButtonNear: boolean;        // For proximity visual feedback
    isButtonOver: boolean;        // When button is over trash zone
    buttonPosition: Position;     // Current button position
    onButtonEnter: () => void;    // When button enters trash zone
    onButtonLeave: () => void;    // When button leaves trash zone
}

const TRASH_ZONE_CONFIG = {
    // Size and positioning
    SIZE: 80,                     // Diameter in pixels
    BOTTOM_OFFSET: 40,            // Distance from bottom of viewport

    // Detection thresholds
    NEAR_THRESHOLD: 150,          // Distance to trigger "near" effect
    OVER_THRESHOLD: 80,           // Distance to trigger "over" effect (same as size)

    // Animation timings
    ENTRANCE_DURATION: 0.3,
    EXIT_DURATION: 0.2,

    // Icon size
    ICON_SIZE: 32,
};

/**
 * TrashZone Component
 * 
 * Displays a trash zone at the bottom-center of the viewport when dragging the Ask AI button.
 * Provides visual feedback when button is near or over the zone.
 */
export const TrashZone: React.FC<TrashZoneProps> = ({
    isVisible,
    isButtonNear,
    isButtonOver,
    buttonPosition,
    onButtonEnter,
    onButtonLeave,
}) => {
    const trashIconRef = useRef<DeleteIconHandle>(null);
    const previousOverState = useRef(isButtonOver);

    // Calculate trash zone position (bottom-center of viewport)
    const trashPosition: Position = {
        x: window.innerWidth / 2,
        y: window.innerHeight - TRASH_ZONE_CONFIG.BOTTOM_OFFSET,
    };

    // Calculate distance between button and trash zone
    const distance = Math.sqrt(
        Math.pow(buttonPosition.x - trashPosition.x, 2) +
        Math.pow(buttonPosition.y - trashPosition.y, 2)
    );

    // Check thresholds
    const isOver = distance < TRASH_ZONE_CONFIG.OVER_THRESHOLD;

    // Trigger callbacks when over state changes
    useEffect(() => {
        if (isOver && !previousOverState.current) {
            onButtonEnter();
        } else if (!isOver && previousOverState.current) {
            onButtonLeave();
        }
        previousOverState.current = isOver;
    }, [isOver, onButtonEnter, onButtonLeave]);

    // Animate trash icon based on button proximity
    useEffect(() => {
        if (trashIconRef.current) {
            if (isButtonNear || isButtonOver) {
                trashIconRef.current.startAnimation();
            } else {
                trashIconRef.current.stopAnimation();
            }
        }
    }, [isButtonNear, isButtonOver]);

    // Determine CSS class based on state
    const getTrashZoneClass = () => {
        const classes = ['trash-zone'];
        if (isButtonOver) {
            classes.push('button-over');
        } else if (isButtonNear) {
            classes.push('button-near');
        }
        return classes.join(' ');
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className={getTrashZoneClass()}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{
                        duration: TRASH_ZONE_CONFIG.ENTRANCE_DURATION,
                        ease: 'easeOut',
                    }}
                    style={{
                        position: 'fixed',
                        bottom: `${TRASH_ZONE_CONFIG.BOTTOM_OFFSET}px`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: `${TRASH_ZONE_CONFIG.SIZE}px`,
                        height: `${TRASH_ZONE_CONFIG.SIZE}px`,
                        zIndex: 2147483646, // Just below button
                        pointerEvents: 'none', // Don't interfere with drag
                    }}
                >
                    <div className="trash-zone-inner">
                        <DeleteIcon
                            ref={trashIconRef}
                            size={TRASH_ZONE_CONFIG.ICON_SIZE}
                            className="trash-icon"
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
