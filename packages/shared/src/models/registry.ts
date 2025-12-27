import type { PresetProvider, SpecialProvider } from '../types/providers';

export const openai: PresetProvider = {
    name: 'openai',
    enabled: true,
    api_key: '',
    models: [
        {
            enabled: true,
            id: 'gpt-5.2',
            name: 'GPT 5.2',
            desc: 'Flagship model for coding, agentic workflows, tool calling, broad reasoning.',
            fee: { input: 0.875, output: 7.00 },
            features: {
                function_calling: true,
                structured_output: true,
                image_input: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'gpt-5.1',
            name: 'GPT 5.1',
            desc: 'Prior generation to 5.2 with strong reasoning and coding.',
            fee: { input: 0.625, output: 5.00 },
            features: {
                function_calling: true,
                structured_output: true,
                image_input: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'gpt-5-mini',
            name: 'GPT 5 Mini',
            desc: 'Faster, cheaper version of GPT-5 family for lighter tasks.',
            fee: { input: 0.125, output: 1.00 },
            features: {
                function_calling: true,
                structured_output: true,
                image_input: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'gpt-5-nano',
            name: 'GPT 5 Nano',
            desc: 'Fastest, most cost-efficient in GPT-5 lineup, suited for high throughput.',
            fee: { input: 0.025, output: 0.20 },
            features: {
                function_calling: true,
                structured_output: true,
                image_input: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'gpt-4.1',
            name: 'GPT 4.1',
            desc: 'Advanced multimodal model with excellent coding, long context support.',
            fee: { input: 1.00, output: 4.00 },
            features: {
                function_calling: true,
                structured_output: true,
                image_input: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'gpt-4.1-mini',
            name: 'GPT 4.1 Mini',
            desc: 'Cheaper, faster alternative to GPT-4.1 with strong multimodal performance.',
            fee: { input: 0.20, output: 0.80 },
            features: {
                function_calling: true,
                structured_output: true,
                image_input: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'gpt-4.1-nano',
            name: 'GPT 4.1 Nano',
            desc: 'Fastest and cheapest GPT-4.1 series model.',
            fee: { input: 0.05, output: 0.20 },
            features: {
                function_calling: true,
                structured_output: true,
                image_input: true,
                reasoning: true
            }
        }
    ]
}

export const anthropic: PresetProvider = {
    name: 'anthropic',
    enabled: true,
    api_key: '',
    models: [
        {
            enabled: true,
            id: 'claude-opus-4-5',
            name: 'Claude Opus 4.5',
            desc: 'Most advanced Anthropic model (Nov 2025) with top reasoning, coding, agentic workflows, and tool execution performance. Suitable for heavy AI agents and complex tasks.',
            fee: { input: 5.00, output: 25.00 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'claude-opus-4-1',
            name: 'Claude Opus 4.1',
            desc: 'Earlier Opus variant with strong coding, multi-step workflows, agentic search and tool use.',
            fee: { input: 5.00, output: 25.00 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'claude-sonnet-4-5',
            name: 'Claude Sonnet 4.5',
            desc: 'Balanced performance model designed for broad usage: reasoning, code, agentic tasks, large contexts.',
            fee: { input: 3.00, output: 15.00 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'claude-haiku-4-5',
            name: 'Claude Haiku 4.5',
            desc: 'Smallest and fastest Anthropic model; cost-efficient for high-volume use and lighter tasks.',
            fee: { input: 1.00, output: 5.00 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true
            }
        }
    ]
}

export const google_gemini: PresetProvider = {
    name: 'google_gemini',
    enabled: true,
    api_key: '',
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
        }
    ]
}

export const vertex: SpecialProvider = {
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
        }
    ]
}

export const xai: PresetProvider = {
    name: 'xai',
    enabled: true,
    api_key: '',
    models: [
        {
            enabled: true,
            id: 'grok-4',
            name: 'Grok 4',
            desc: 'Latest flagship model (Jul 2025) with up to 256K context, advanced reasoning, and real-time search.',
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
            id: 'grok-4-1-fast-reasoning',
            name: 'Grok 4.1 Fast (Reasoning)',
            desc: 'Latest Grok 4.1 (Nov 2025) fast variant with reasoning enabled. Improved multimodal understanding.',
            fee: { input: 0.20, output: 0.50 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'grok-4-1-fast-non-reasoning',
            name: 'Grok 4.1 Fast',
            desc: 'Latest Grok 4.1 (Nov 2025) fast variant without reasoning. Cost-efficient for high throughput.',
            fee: { input: 0.20, output: 0.50 },
            features: {
                function_calling: true,
                structured_output: true
            }
        },
        {
            enabled: true,
            id: 'grok-4-fast-reasoning',
            name: 'Grok 4 Fast (Reasoning)',
            desc: 'Fast Grok 4 variant with reasoning enabled for cost-efficient inference.',
            fee: { input: 0.20, output: 0.50 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'grok-4-fast-non-reasoning',
            name: 'Grok 4 Fast',
            desc: 'Fast Grok 4 variant without reasoning. Lowest cost for high-volume use.',
            fee: { input: 0.20, output: 0.50 },
            features: {
                function_calling: true,
                structured_output: true
            }
        },
        {
            enabled: true,
            id: 'grok-code-fast-1',
            name: 'Grok Code Fast 1',
            desc: 'Specialized model for agentic coding (Aug 2025). Optimized for code generation and debugging.',
            fee: { input: 0.20, output: 1.50 },
            features: {
                function_calling: true,
                structured_output: true
            }
        },
        {
            enabled: true,
            id: 'grok-3',
            name: 'Grok 3',
            desc: 'Previous flagship (Feb 2025) with strong reasoning and broad capabilities.',
            fee: { input: 3.00, output: 15.00 },
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'grok-2-image-1212',
            name: 'Grok 2 Image',
            desc: 'Image generation model for creating visual content.',
            fee: { input: 2.00, output: 10.00 },
            features: {
                image_output: true
            }
        }
    ]
}

export const cognitoProviders = [
    openai,
    anthropic,
    google_gemini,
    vertex,
    xai,
]
