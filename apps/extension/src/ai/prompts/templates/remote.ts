/**
 * Remote system prompts (shared)
 *
 * This file exists for backwards compatibility with older imports.
 * The canonical prompts live in `@cognito/shared` (`packages/shared/src/constants/systemPrompts.ts`).
 */

import { AGENT_MODE_SYSTEM_PROMPT, CHAT_MODE_SYSTEM_PROMPT } from '@cognito/shared';

// Agent mode (full automation)
export const remoteSystemPrompt = AGENT_MODE_SYSTEM_PROMPT;

// Chat mode (minimal tools, Q&A focused)
export const chatModeSystemPrompt = CHAT_MODE_SYSTEM_PROMPT;

