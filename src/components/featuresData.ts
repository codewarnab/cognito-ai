import type { LucideIcon } from 'lucide-react';
import {
    MousePointerClick,
    Search,
    BarChart3,
    Youtube,
    Brain,
    Zap,
    PenTool,
    ShoppingCart,
} from 'lucide-react';

export interface ExamplePrompt {
    id: string;
    category: string;
    icon: LucideIcon;
    prompts: string[];
}

export const examplePrompts: ExamplePrompt[] = [
    {
        id: 'automation',
        category: 'Browser Automation',
        icon: MousePointerClick,
        prompts: [
            'Click on the "Sign Up" button and fill in the registration form',
            'Scroll down to the bottom of the page and click the "Load More" button',
            'Search for "machine learning" on this website',
            'Navigate to the pricing page and tell me the different plans',
            'Find and click all the social media links on this page'
        ]
    },
    {
        id: 'research',
        category: 'Research & Analysis',
        icon: Search,
        prompts: [
            'Research the top 5 AI tools for productivity and compare their features',
            'Find the latest news about quantum computing',
            'Analyze this article and give me a summary with key points',
            'What are the trending topics on Hacker News today?',
            'Compare the pricing of Netflix, Disney+, and HBO Max'
        ]
    },
    {
        id: 'youtube',
        category: 'YouTube Analysis',
        icon: Youtube,
        prompts: [
            'Summarize this YouTube video and extract key takeaways',
            'What are the main topics discussed in this video?',
            'Get timestamps for important sections of this tutorial',
            'Analyze the comments on this video and tell me the general sentiment'
        ]
    },
    {
        id: 'memory',
        category: 'Memory & Learning',
        icon: Brain,
        prompts: [
            'Remember that I prefer dark mode for all websites',
            'Save my favorite coffee order: medium latte with oat milk',
            'What did I ask you to remember about my preferences?',
            'Remind me in 30 minutes to check my email',
            'Remember this article for later reference'
        ]
    },
    {
        id: 'productivity',
        category: 'Productivity',
        icon: Zap,
        prompts: [
            'Organize my open tabs by category and create tab groups',
            'Find all tabs related to my project and group them together',
            'Close all duplicate tabs',
            'Set a reminder for my meeting tomorrow at 2 PM',
            'What tabs do I have open about AI research?'
        ]
    },
    {
        id: 'content',
        category: 'Content Creation',
        icon: PenTool,
        prompts: [
            'Help me write a professional email response to this inquiry',
            'Generate ideas for blog posts about web development',
            'Proofread and improve this paragraph',
            'Create a social media post about this article',
            'Draft a summary of this documentation page'
        ]
    },
    {
        id: 'shopping',
        category: 'Shopping & Comparison',
        icon: ShoppingCart,
        prompts: [
            'Find the best deals on wireless headphones under $100',
            'Compare prices of this product across different stores',
            'What are the customer reviews saying about this item?',
            'Find similar products at a lower price',
            'Add this item to my cart and proceed to checkout'
        ]
    }
];
