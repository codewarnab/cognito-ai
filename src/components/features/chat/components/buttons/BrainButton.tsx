/**
 * BrainButton Component
 * Allows users to analyze AI responses and save extracted facts to Supermemory.
 * Persists analyzed state and shows extracted facts on hover.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Check, AlertCircle } from 'lucide-react';
import { generateObject } from 'ai';
import { z } from 'zod';
import { isSupermemoryReady } from '@/utils/supermemory';
import { initializeModel } from '@/ai/core/modelFactory';
import { addFactsBatch } from '@/background/supermemory/extraction/addService';
import type { ExtractedFact } from '@/background/supermemory/extraction/types';
import { createLogger } from '~logger';

const log = createLogger('BrainButton', 'UTILS');

/** Storage key for persisting analyzed messages with their facts */
const ANALYZED_MESSAGES_STORAGE_KEY = 'supermemory:analyzedMessages';
/** Maximum number of analyzed messages to store (prevents unbounded growth) */
const MAX_ANALYZED_MESSAGES = 500;
/** Error state display duration before returning to idle */
const ERROR_STATE_MS = 3000;
/** Success state display duration before returning to analyzed */
const SUCCESS_STATE_MS = 2000;

/** Stored data for an analyzed message */
interface AnalyzedMessageData {
  facts: string[];
  analyzedAt: number;
}

/** Map of message hash to analyzed data */
type AnalyzedMessagesMap = Record<string, AnalyzedMessageData>;

/**
 * Generate a unique hash for a message based on its content
 */
function generateMessageHash(content: string, threadId?: string): string {
  const input = `${threadId || ''}:${content}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `msg_${Math.abs(hash).toString(36)}`;
}

/**
 * Get analyzed message data from storage
 */
async function getAnalyzedMessageData(messageHash: string): Promise<AnalyzedMessageData | null> {
  try {
    const storage = await chrome.storage.local.get(ANALYZED_MESSAGES_STORAGE_KEY);
    const analyzedMessages = (storage[ANALYZED_MESSAGES_STORAGE_KEY] || {}) as AnalyzedMessagesMap;
    return analyzedMessages[messageHash] || null;
  } catch (error) {
    log.error('Failed to get analyzed message data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}


/**
 * Save analyzed message data to storage
 */
async function saveAnalyzedMessageData(
  messageHash: string,
  facts: string[]
): Promise<void> {
  try {
    const storage = await chrome.storage.local.get(ANALYZED_MESSAGES_STORAGE_KEY);
    const analyzedMessages = (storage[ANALYZED_MESSAGES_STORAGE_KEY] || {}) as AnalyzedMessagesMap;
    
    // Add new entry
    analyzedMessages[messageHash] = {
      facts,
      analyzedAt: Date.now(),
    };
    
    // Trim to max size by removing oldest entries
    const entries = Object.entries(analyzedMessages);
    if (entries.length > MAX_ANALYZED_MESSAGES) {
      entries.sort((a, b) => a[1].analyzedAt - b[1].analyzedAt);
      const toRemove = entries.slice(0, entries.length - MAX_ANALYZED_MESSAGES);
      toRemove.forEach(([key]) => delete analyzedMessages[key]);
    }
    
    await chrome.storage.local.set({ [ANALYZED_MESSAGES_STORAGE_KEY]: analyzedMessages });
    log.debug('Saved analyzed message data', { messageHash, factsCount: facts.length });
  } catch (error) {
    log.error('Failed to save analyzed message data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Zod schema for extracted facts from AI analysis
 */
const extractedFactsSchema = z.object({
  facts: z.array(
    z.object({
      content: z.string().describe('The fact content to be saved to memory'),
      confidence: z.enum(['high', 'medium']).describe('Confidence level of the extraction'),
      category: z.enum(['preference', 'fact', 'interest', 'instruction', 'context'])
        .describe('Category for organization'),
    })
  ).describe('Array of extracted facts from the conversation'),
});

/**
 * Build prompt for fact extraction
 */
function buildExtractionPrompt(userMessage: string, aiResponse: string): string {
  return `Analyze the following conversation between a user and an AI assistant. Extract useful facts about the user that might be valuable to remember for future interactions.

USER MESSAGE:
${userMessage}

AI RESPONSE:
${aiResponse}

INSTRUCTIONS:
- Extract facts about the user's preferences, interests, projects, or specific information they might want to recall later
- Focus on personal details, preferences, ongoing projects, goals, or important context
- Ignore generic questions, tool calls, or temporary information
- Only extract facts with clear value for future recall
- If no meaningful facts can be extracted, return an empty array
- Each fact should be self-contained and understandable without additional context

CATEGORIES:
- preference: User preferences (e.g., "prefers dark mode", "likes TypeScript")
- fact: Personal facts (e.g., "works at Company X", "lives in City Y")
- interest: Topics of interest (e.g., "interested in machine learning")
- instruction: Standing instructions (e.g., "always use metric units")
- context: Project/work context (e.g., "working on a React app called ProjectX")

Return only high or medium confidence facts. Skip low confidence extractions.`;
}

/**
 * Analyze conversation and extract facts using AI
 */
async function analyzeAndExtractFacts(
  userMessage: string,
  aiResponse: string
): Promise<ExtractedFact[]> {
  const { model, provider, modelName } = await initializeModel('gemini-2.5-flash', 'remote');
  
  log.info('Extracting facts with AI', { provider, modelName });

  const prompt = buildExtractionPrompt(userMessage, aiResponse);

  const result = await generateObject({
    model,
    schema: extractedFactsSchema,
    prompt,
    temperature: 0.3,
    maxRetries: 2,
  });

  return result.object.facts;
}

type BrainButtonState = 'idle' | 'analyzing' | 'success' | 'error' | 'no-facts' | 'analyzed';

interface BrainButtonProps {
  content: string;
  previousMessage?: string;
  threadId?: string;
}


export const BrainButton: React.FC<BrainButtonProps> = ({
  content,
  previousMessage,
  threadId,
}) => {
  const [state, setState] = useState<BrainButtonState>('idle');
  const [isSupermemoryConfigured, setIsSupermemoryConfigured] = useState<boolean | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [savedFacts, setSavedFacts] = useState<string[]>([]);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageHash = useRef<string>('');

  // Check if message was already analyzed on mount
  useEffect(() => {
    const checkAnalyzedStatus = async () => {
      if (!content) return;
      
      messageHash.current = generateMessageHash(content, threadId);
      const data = await getAnalyzedMessageData(messageHash.current);
      
      if (data) {
        setSavedFacts(data.facts);
        setState('analyzed');
        log.debug('Message already analyzed', { 
          messageHash: messageHash.current, 
          factsCount: data.facts.length 
        });
      }
    };
    
    checkAnalyzedStatus();
  }, [content, threadId]);

  const checkSupermemoryStatus = useCallback(async () => {
    try {
      const ready = await isSupermemoryReady();
      setIsSupermemoryConfigured(ready);
      return ready;
    } catch (error) {
      log.error('Failed to check Supermemory status', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setIsSupermemoryConfigured(false);
      return false;
    }
  }, []);

  const handleMouseEnter = useCallback(async () => {
    setShowTooltip(true);
    if (isSupermemoryConfigured === null) {
      await checkSupermemoryStatus();
    }
  }, [isSupermemoryConfigured, checkSupermemoryStatus]);

  const handleMouseLeave = useCallback(() => {
    // Keep tooltip visible during analyzing/success/error states
    if (state === 'idle' || state === 'analyzed') {
      setShowTooltip(false);
    }
  }, [state]);

  const handleClick = useCallback(async () => {
    if (state === 'analyzing') return;
    if (!content) return;
    // Don't re-analyze already analyzed messages
    if (state === 'analyzed') return;

    const ready = await checkSupermemoryStatus();
    if (!ready) {
      log.warn('Supermemory not configured, cannot analyze');
      return;
    }

    setState('analyzing');
    setShowTooltip(true);
    log.info('Starting brain analysis', { threadId, contentLength: content.length });

    try {
      const userContext = previousMessage || '';
      const facts = await analyzeAndExtractFacts(userContext, content);

      if (facts.length === 0) {
        log.info('No facts extracted from conversation', { threadId });
        // Still mark as analyzed with empty facts
        await saveAnalyzedMessageData(messageHash.current, []);
        setSavedFacts([]);
        setState('no-facts');
        tooltipTimeoutRef.current = setTimeout(() => {
          setState('analyzed');
          setShowTooltip(false);
        }, SUCCESS_STATE_MS);
        return;
      }

      log.info('Facts extracted', { count: facts.length, threadId });
      const factContents = facts.map(f => f.content);

      // Save facts to Supermemory
      const result = await addFactsBatch(facts, threadId || 'unknown');

      if (result.failed > 0) {
        log.warn('Some facts failed to save', {
          succeeded: result.succeeded,
          failed: result.failed,
          threadId,
        });
      }

      // Persist to storage
      await saveAnalyzedMessageData(messageHash.current, factContents);
      setSavedFacts(factContents);

      log.info('Brain analysis complete', {
        factsExtracted: facts.length,
        factsSaved: result.succeeded,
        threadId,
      });

      setState('success');
      tooltipTimeoutRef.current = setTimeout(() => {
        setState('analyzed');
        setShowTooltip(false);
      }, SUCCESS_STATE_MS);
    } catch (error) {
      log.error('Brain analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        threadId,
      });
      setState('error');
      tooltipTimeoutRef.current = setTimeout(() => {
        setState('idle');
        setShowTooltip(false);
      }, ERROR_STATE_MS);
    }
  }, [state, content, previousMessage, threadId, checkSupermemoryStatus]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);


  const getTooltipContent = (): React.ReactNode => {
    if (state === 'analyzing') return 'Analyzing response...';
    if (state === 'success') return `Saved ${savedFacts.length} fact${savedFacts.length !== 1 ? 's' : ''} to memory`;
    if (state === 'no-facts') return 'No memorable facts found';
    if (state === 'error') return 'Failed to save. Try again.';
    if (isSupermemoryConfigured === false) return 'Configure Supermemory in settings';
    
    // Show saved facts for analyzed messages
    if (state === 'analyzed' && savedFacts.length > 0) {
      return (
        <div className="brain-facts-tooltip">
          <div className="brain-facts-header">
            Saved to memory ({savedFacts.length})
          </div>
          <ul className="brain-facts-list">
            {savedFacts.map((fact, index) => (
              <li key={index} className="brain-fact-item">
                {fact}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    
    if (state === 'analyzed') return 'Already analyzed (no facts)';
    
    return 'Analyze and save to memory';
  };

  const getAriaLabel = (): string => {
    if (state === 'analyzed' && savedFacts.length > 0) {
      return `Analyzed: ${savedFacts.length} fact${savedFacts.length !== 1 ? 's' : ''} saved`;
    }
    if (state === 'analyzed') return 'Already analyzed';
    if (state === 'analyzing') return 'Analyzing response';
    if (state === 'success') return 'Facts saved to memory';
    if (state === 'error') return 'Failed to save';
    return 'Analyze and save to memory';
  };

  const isDisabled = state === 'analyzing' || isSupermemoryConfigured === false || state === 'analyzed';

  const getTooltipClassName = (): string => {
    const baseClass = 'audio-generating-tooltip';
    if (state === 'success' || state === 'no-facts') return `${baseClass} brain-tooltip-success`;
    if (state === 'error') return `${baseClass} brain-tooltip-error`;
    if (state === 'analyzed' && savedFacts.length > 0) return `${baseClass} brain-tooltip-facts`;
    if (state === 'analyzed') return `${baseClass} brain-tooltip-analyzed`;
    return baseClass;
  };

  const isAnalyzedState = state === 'analyzed' || state === 'success' || state === 'no-facts';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className={`copy-message-button ${state === 'analyzing' ? 'brain-analyzing' : ''} ${isAnalyzedState ? 'brain-analyzed' : ''}`}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={isDisabled}
        aria-label={getAriaLabel()}
        style={{ marginLeft: '8px' }}
      >
        <AnimatePresence mode="wait">
          {state === 'success' || state === 'no-facts' ? (
            <motion.div
              key="success"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <Check size={18} style={{ color: '#22c55e' }} />
            </motion.div>
          ) : state === 'error' ? (
            <motion.div
              key="error"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <AlertCircle size={18} style={{ color: '#ef4444' }} />
            </motion.div>
          ) : state === 'analyzed' ? (
            <motion.div
              key="analyzed"
              initial={{ scale: 1 }}
              animate={{ scale: 1 }}
            >
              <Brain
                size={18}
                style={{ color: '#22c55e' }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="brain"
              initial={{ scale: 1 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0, rotate: -180 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className={state === 'analyzing' ? 'brain-shimmer' : ''}
            >
              <Brain
                size={18}
                style={{
                  opacity: isSupermemoryConfigured === false ? 0.4 : 1,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            className={getTooltipClassName()}
            initial={{ opacity: 0, y: 5, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            {state === 'analyzing' ? (
              <span className="brain-tooltip-shimmer">{getTooltipContent()}</span>
            ) : (
              getTooltipContent()
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
