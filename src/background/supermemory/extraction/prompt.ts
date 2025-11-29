/**
 * Prompts for memory extraction from conversations
 */

import type { ChatMessage } from '~/types/database/schema';

/**
 * System prompt for fact extraction
 * Instructs the AI to analyze conversations and call the save_extracted_facts function
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are an AI assistant that analyzes conversations to extract useful, reusable information about the user.

Your task is to identify facts, preferences, and insights that would be valuable to remember for future conversations.

EXTRACT information like:
- User preferences (e.g., "Prefers TypeScript over JavaScript", "Likes dark mode")
- Personal/professional facts (e.g., "Works on a Chrome extension called Cognito", "Uses React and Tailwind")
- Interests and topics they care about (e.g., "Interested in AI and machine learning")
- Tools, technologies, and workflows they use
- Specific instructions or guidelines they've mentioned
- Projects or goals they're working on
- Things the user searched for or asked about repeatedly

DO NOT EXTRACT:
- Temporary or one-time information (e.g., "Looking at file X right now")
- Conversation filler or noise
- Information that wouldn't be useful in future conversations
- Sensitive information like passwords, API keys, or personal identifiers

Each fact should be:
- Self-contained and understandable without context
- Written in third person (e.g., "User prefers..." not "I prefer...")
- Concise but complete

After analyzing the conversation, call the save_extracted_facts function with all extracted facts.
If no useful facts can be extracted, call the function with an empty array.`;

/**
 * Build the user prompt with conversation content
 */
export function buildExtractionPrompt(messages: ChatMessage[]): string {
  const conversationText = messages
    .map(m => {
      const role = m.message.role === 'user' ? 'User' : 'Assistant';
      const textParts = m.message.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join('\n');
      return `${role}: ${textParts}`;
    })
    .join('\n\n');

  return `Analyze this conversation and extract useful facts about the user. Call the save_extracted_facts function with your findings.\n\n--- CONVERSATION ---\n${conversationText}\n--- END CONVERSATION ---`;
}
