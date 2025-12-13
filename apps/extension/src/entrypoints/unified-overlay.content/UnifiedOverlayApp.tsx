/**
 * Unified Overlay App
 * 
 * Lazy-loads each feature only when needed to minimize initial bundle
 * and memory usage. React is loaded once and shared across all features.
 */
import { lazy, Suspense, useState, useEffect, type FC } from 'react';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

// Lazy load feature apps - they share React and common dependencies
const TextRewriterApp = lazy(() => import('./TextRewriterApp'));
const TextSummarizerApp = lazy(() => import('./TextSummarizerApp'));
const WriteCommandApp = lazy(() => import('./WriteCommandApp'));

interface UnifiedOverlayAppProps {
    ctx: ContentScriptContext;
}

type ActiveFeature = 'none' | 'rewriter' | 'summarizer' | 'writer';

export const UnifiedOverlayApp: FC<UnifiedOverlayAppProps> = ({ ctx }) => {
    // Track which features should be active
    // In a unified approach, all features can coexist but lazy load
    const [activeFeatures, setActiveFeatures] = useState<Set<ActiveFeature>>(new Set(['rewriter', 'summarizer', 'writer']));

    // Listen for feature toggle messages from background if needed
    useEffect(() => {
        const handleMessage = (message: { type: string; feature?: ActiveFeature }) => {
            if (message.type === 'TOGGLE_FEATURE' && message.feature) {
                setActiveFeatures(prev => {
                    const next = new Set(prev);
                    if (next.has(message.feature!)) {
                        next.delete(message.feature!);
                    } else {
                        next.add(message.feature!);
                    }
                    return next;
                });
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, []);

    return (
        <>
            {/* All features render independently within the same Shadow DOM */}
            {activeFeatures.has('rewriter') && (
                <Suspense fallback={null}>
                    <TextRewriterApp ctx={ctx} />
                </Suspense>
            )}

            {activeFeatures.has('summarizer') && (
                <Suspense fallback={null}>
                    <TextSummarizerApp ctx={ctx} />
                </Suspense>
            )}

            {activeFeatures.has('writer') && (
                <Suspense fallback={null}>
                    <WriteCommandApp ctx={ctx} />
                </Suspense>
            )}
        </>
    );
};

export default UnifiedOverlayApp;
