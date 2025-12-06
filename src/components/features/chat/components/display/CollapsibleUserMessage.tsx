import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDownIcon } from '@assets/icons/chat/chevrown-down';
import { COLLAPSIBLE_MESSAGE_CONFIG } from '~/constants';

interface CollapsibleUserMessageProps {
  text: string;
  maxCollapsedHeight?: number;
  minTextLengthForCollapse?: number;
  renderContent: (text: string) => React.ReactNode;
}

export const CollapsibleUserMessage: React.FC<CollapsibleUserMessageProps> = ({
  text,
  maxCollapsedHeight = COLLAPSIBLE_MESSAGE_CONFIG.MAX_COLLAPSED_HEIGHT,
  minTextLengthForCollapse = COLLAPSIBLE_MESSAGE_CONFIG.MIN_TEXT_LENGTH_FOR_COLLAPSE,
  renderContent,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Use useLayoutEffect to measure before paint, avoiding flicker
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const checkHeight = () => {
      // Measure the actual scrollHeight of the content
      const height = element.scrollHeight;
      setMeasuredHeight(height);
      
      // Only collapse if height exceeds threshold AND text is long enough
      const shouldCollapse = height > maxCollapsedHeight && text.length >= minTextLengthForCollapse;
      setNeedsCollapse(shouldCollapse);
    };

    // Initial check after render
    checkHeight();

    // Watch for size changes (e.g., window resize, font loading)
    const resizeObserver = new ResizeObserver(checkHeight);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [text, maxCollapsedHeight, minTextLengthForCollapse]);

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => {
      const willCollapse = prev;
      if (willCollapse && wrapperRef.current) {
        wrapperRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      return !prev;
    });
  }, []);

  // Handle empty or whitespace-only text
  if (!text || !text.trim()) {
    return null;
  }

  // Always render the full structure, but only apply collapse styles when needed
  // This ensures we can measure the content properly
  return (
    <div 
      className={`copilot-message-content ${needsCollapse ? 'user-message-collapsible-wrapper' : ''}`} 
      ref={wrapperRef}
    >
      <div
        ref={contentRef}
        className={needsCollapse ? `user-message-collapsible ${isExpanded ? 'expanded' : 'collapsed'}` : undefined}
        style={needsCollapse ? {
          '--collapsed-height': `${maxCollapsedHeight}px`,
          '--full-height': `${measuredHeight}px`,
        } as React.CSSProperties : undefined}
      >
        <div className="user-message-with-mentions">
          {renderContent(text)}
        </div>

        {/* Fade overlay - only visible when collapsed */}
        {needsCollapse && (
          <AnimatePresence>
            {!isExpanded && (
              <motion.div
                className="user-message-fade-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Expand/Collapse button - only show when collapse is needed */}
      {needsCollapse && (
        <button
          type="button"
          className={`user-message-expand-btn ${isExpanded ? 'expanded' : ''}`}
          onClick={handleToggle}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Show less content' : 'Show more content'}
        >
          <span>{isExpanded ? 'Show less' : 'Show more'}</span>
          <span className="user-message-expand-btn-icon">
            <ChevronDownIcon size={12} />
          </span>
        </button>
      )}
    </div>
  );
};
