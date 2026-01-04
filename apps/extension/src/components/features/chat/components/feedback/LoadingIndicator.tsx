import { useCliModeStore } from '@/stores/cliMode/cliModeStore';
import { TextShimmer } from '@/components/ui/TextShimmer';

const THINKING_MESSAGES = [
    'Thinking...',
    'Still thinking...',
    'Processing...',
    'Analyzing...',
    'Almost there...',
    'Working on it...',
    'Just a moment longer...',
    'Putting it all together...',
];

const MESSAGE_INTERVAL = 7000;

export const LoadingIndicator: React.FC = () => {
    const [messageIndex, setMessageIndex] = React.useState(0);
    const agentStatus = useCliModeStore((s) => s.agentStatus);

    React.useEffect(() => {
        // Only cycle messages if no agent status is provided
        if (agentStatus) return;

        const interval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % THINKING_MESSAGES.length);
        }, MESSAGE_INTERVAL);
        return () => clearInterval(interval);
    }, [agentStatus]);

    // Use agent status if available, otherwise fall back to cycling messages
    const displayMessage = agentStatus || THINKING_MESSAGES[messageIndex] || 'Thinking...';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex gap-3 justify-start items-start py-1"
        >
            <TextShimmer
                key={displayMessage}
                as="span"
                className="text-sm font-medium [--base-color:#a1a1aa] [--base-gradient-color:#ffffff]"
                duration={2}
                spread={2}
            >
                {displayMessage}
            </TextShimmer>
        </motion.div>
    );
};
