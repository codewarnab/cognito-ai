import type { SpecialProvider } from '@/components/aipanel/libs'

export default {
    name: 'vertex',
    enabled: true,
    custom_fields: {
        projectId: '',
        location: 'us-central1',
        clientEmail: '',
        privateKey: '',
    },
    models: [
        {
            enabled: true,
            id: 'gemini-3-pro-preview',
            name: 'Gemini 3 Pro (Preview)',
            desc: 'Highest-tier multimodal model from Gemini 3 series with advanced reasoning, coding, and tool integration.',
            fee: { input: 1.50, output: 12.00 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'gemini-3-flash-preview',
            name: 'Gemini 3 Flash (Preview)',
            desc: 'Fastest 3-series model with frontier performance suitable for production applications.',
            fee: { input: 0.20, output: 0.80 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'gemini-2.5-pro',
            name: 'Gemini 2.5 Pro',
            desc: 'High-quality Gemini model with strong reasoning, coding, and tool workflow support.',
            fee: { input: 1.25, output: 10.00 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'gemini-2.5-flash',
            name: 'Gemini 2.5 Flash',
            desc: 'Cost-efficient Flash model optimized for throughput and responsiveness.',
            fee: { input: 0.15, output: 0.60 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'gemini-2.5-flash-lite',
            name: 'Gemini 2.5 Flash-Lite',
            desc: 'Smallest, cheapest Gemini 2.5 Flash variant for high-volume use.',
            fee: { input: 0.075, output: 0.30 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                image_input: true
            }
        },
        // Anthropic Claude Models (via Vertex AI)
        {
            enabled: true,
            id: 'claude-sonnet-4@20250514',
            name: 'Claude Sonnet 4',
            desc: 'Latest Claude Sonnet model with improved reasoning, coding, and agentic capabilities.',
            fee: { input: 3.00, output: 15.00 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'claude-3-7-sonnet@20250219',
            name: 'Claude 3.7 Sonnet',
            desc: 'Hybrid model with extended thinking for complex reasoning and rapid responses.',
            fee: { input: 3.00, output: 15.00 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'claude-3-5-sonnet-v2@20241022',
            name: 'Claude 3.5 Sonnet v2',
            desc: 'Improved Claude 3.5 Sonnet with enhanced computer use and agentic coding.',
            fee: { input: 3.00, output: 15.00 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'claude-3-5-sonnet@20240620',
            name: 'Claude 3.5 Sonnet',
            desc: 'High-performance model balancing intelligence and speed for enterprise use.',
            fee: { input: 3.00, output: 15.00 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'claude-3-5-haiku@20241022',
            name: 'Claude 3.5 Haiku',
            desc: 'Fastest and most affordable Claude model for quick, efficient responses.',
            fee: { input: 0.80, output: 4.00 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'claude-3-opus@20240229',
            name: 'Claude 3 Opus',
            desc: 'Most powerful Claude 3 model for complex analysis, coding, and creative tasks.',
            fee: { input: 15.00, output: 75.00 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'claude-3-haiku@20240307',
            name: 'Claude 3 Haiku',
            desc: 'Fast and compact Claude 3 model optimized for near-instant responsiveness.',
            fee: { input: 0.25, output: 1.25 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                image_input: true
            }
        }
    ]
} as SpecialProvider
