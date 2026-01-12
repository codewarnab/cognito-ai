/**
 * Engaging Messages for CLI Chat
 * 
 * Provides fun, varied status messages to keep users engaged
 * while waiting for AI responses.
 */

/**
 * Messages shown after initial setup, while waiting for AI response
 */
const THINKING_MESSAGES = [
    '🧠 Thinking deeply about your request...',
    '✨ Consulting the neural networks...',
    '🔮 Gazing into the AI crystal ball...',
    '🚀 Firing up the cognitive engines...',
    '💭 Pondering the possibilities...',
    '🎯 Focusing on your query...',
    '⚡ Processing at lightspeed...',
    '🌟 Channeling artificial intelligence...',
    '🔍 Analyzing your request...',
    '🎨 Crafting a thoughtful response...',
];

/**
 * Messages shown while AI is generating (longer waits)
 */
const WAITING_MESSAGES = [
    '📚 Cross-referencing knowledge bases...',
    '🧩 Piecing together the perfect answer...',
    '🌈 Almost there, adding the finishing touches...',
    '🔧 Fine-tuning the response...',
    '💡 Having a eureka moment...',
    '🎭 Rehearsing the best way to explain this...',
    '🏃 Running through the possibilities...',
    '🎪 Juggling multiple concepts...',
    '🧪 Experimenting with different approaches...',
    '📝 Drafting the ideal response...',
];

/**
 * Fun capability messages (replace boring "Tools available: X" message)
 */
const CAPABILITY_MESSAGES = [
    '🛠️ Ready to browse, click, type, and more!',
    '🌐 Browser superpowers: activated',
    '🤖 Extension tools locked and loaded',
    '⚙️ Full browser automation at your service',
    '🔗 Connected to your Chrome extension',
    '🎮 Browser control mode: engaged',
    '🦾 Armed with browser automation powers',
    '🎯 Chrome tools ready for action',
];

/**
 * Get a random message from an array
 */
function getRandomMessage(messages: string[]): string {
    return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Get a random capability message (replacing "Tools available: X")
 */
export function getCapabilityMessage(toolCount: number): string {
    if (toolCount === 0) {
        return '⏳ Waiting for extension tools...';
    }
    const baseMessage = getRandomMessage(CAPABILITY_MESSAGES);
    return `${baseMessage} (${toolCount} tools)`;
}

/**
 * Create an async generator that sends engaging messages at intervals
 * Returns a controller to stop the messages
 */
export function createEngagingMessageSender(
    sendEvent: (event: string, data: unknown) => void,
    intervalMs: number = 3000
): { start: () => void; stop: () => void } {
    let intervalId: NodeJS.Timeout | null = null;
    let messageIndex = 0;
    let isThinkingPhase = true;

    const start = () => {
        // Send first thinking message immediately
        sendEvent('status', { message: getRandomMessage(THINKING_MESSAGES) });
        messageIndex++;

        intervalId = setInterval(() => {
            // After 2 thinking messages, switch to waiting messages
            if (messageIndex >= 2) {
                isThinkingPhase = false;
            }

            const messages = isThinkingPhase ? THINKING_MESSAGES : WAITING_MESSAGES;
            sendEvent('status', { message: getRandomMessage(messages) });
            messageIndex++;

            // Stop after 5 messages to avoid spam
            if (messageIndex >= 5 && intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }, intervalMs);
    };

    const stop = () => {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    };

    return { start, stop };
}

/**
 * Default interval between engaging messages (in milliseconds)
 */
export const DEFAULT_MESSAGE_INTERVAL = 2500;
