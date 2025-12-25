import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
      className={`whitespace-pre-wrap break-words ${needsCollapse ? 'relative' : ''}`}
      ref={wrapperRef}
    >
      <div
        ref={contentRef}
        className={needsCollapse ? `relative overflow-hidden transition-[max-height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[max-height]` : undefined}
        style={needsCollapse ? {
          maxHeight: isExpanded ? `${measuredHeight}px` : `${maxCollapsedHeight}px`,
        } as React.CSSProperties : undefined}
      >
        <div>
          {renderContent(text)}
        </div>

        {/* Fade overlay - only visible when collapsed */}
        {needsCollapse && (
          <AnimatePresence>
            {!isExpanded && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-[60px] bg-gradient-to-b from-blue-500/0 via-blue-500/60 to-blue-500 pointer-events-none rounded-bl-2xl"
                style={{
                  backgroundImage: 'linear-gradient(to bottom, rgba(59, 130, 246, 0) 0%, rgba(59, 130, 246, 0.6) 35%, rgba(59, 130, 246, 0.9) 65%, #3b82f6 100%)'
                }}
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
          className={`inline-flex items-center justify-center gap-1.5 mt-2.5 px-3.5 py-1.5 bg-white/15 border border-white/20 rounded-[14px] text-white text-xs font-medium cursor-pointer transition-all duration-200 float-right backdrop-blur-sm hover:bg-white/[0.22] hover:border-white/[0.32] hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] active:translate-y-0 active:shadow-none focus-visible:outline-2 focus-visible:outline-white/60 focus-visible:outline-offset-2`}
          onClick={handleToggle}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Show less content' : 'Show more content'}
        >
          <span>{isExpanded ? 'Show less' : 'Show more'}</span>
          <span className={`flex items-center justify-center transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? 'rotate-180' : ''}`} style={{ backfaceVisibility: 'hidden' }}>
            <ChevronDownIcon size={12} />
          </span>
        </button>
      )}
      {/* Clear float after button */}
      {needsCollapse && <div className="clear-both table" />}
    </div>
  );
};
