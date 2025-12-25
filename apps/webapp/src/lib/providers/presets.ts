import type { PresetProvider, SpecialProvider } from '@/components/aipanel/libs/Providers/types'

export const openai: PresetProvider = {
    name: 'openai',
    enabled: true,
    api_key: '',
    models: [
        {
            enabled: true,
            id: 'gpt-4.5-preview',
            name: 'GPT 4.5 Preview',
            features: {
                function_calling: true,
                structured_output: true,
                web_search: true,
                image_input: true,
                reasoning: true,
                reasoning_optional: true
            }
        },
        {
            enabled: true,
            id: 'gpt-4o',
            name: 'GPT 4o',
            features: {
                function_calling: true,
                structured_output: true,
                web_search: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'gpt-4o-mini',
            name: 'GPT 4o Mini',
            features: {
                function_calling: true,
                structured_output: true,
                web_search: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'o1',
            name: 'o1',
            features: {
                function_calling: true,
                structured_output: true,
                web_search: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'o3-mini',
            name: 'o3 Mini',
            features: {
                function_calling: true,
                structured_output: true,
                web_search: true,
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
            id: 'claude-3-7-sonnet-20250219',
            name: 'Claude 3.7 Sonnet',
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                reasoning_optional: true,
                web_search: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'claude-3-5-sonnet-20241022',
            name: 'Claude 3.5 Sonnet',
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true, // Extended thinking
                reasoning_optional: true,
                web_search: true,
                image_input: true
            }
        },
        {
            enabled: true,
            id: 'claude-3-5-haiku-20241022',
            name: 'Claude 3.5 Haiku',
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: false,
                web_search: true,
                image_input: true
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
            id: 'gemini-2.0-pro-exp-0211',
            name: 'Gemini 2.0 Pro',
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                reasoning_optional: true,
                web_search: true
            }
        },
        {
            enabled: true,
            id: 'gemini-2.0-flash',
            name: 'Gemini 2.0 Flash',
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                reasoning_optional: true,
                web_search: true
            }
        },
        {
            enabled: true,
            id: 'gemini-1.5-pro',
            name: 'Gemini 1.5 Pro',
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                reasoning_optional: true,
                web_search: true
            }
        },
        {
            enabled: true,
            id: 'gemini-1.5-flash',
            name: 'Gemini 1.5 Flash',
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                reasoning_optional: true,
                web_search: true
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
            id: 'gemini-2.0-flash-001',
            name: 'Gemini 2.0 Flash',
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                web_search: true
            }
        },
        {
            enabled: true,
            id: 'gemini-1.5-pro-002',
            name: 'Gemini 1.5 Pro',
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                web_search: true
            }
        },
        {
            enabled: true,
            id: 'gemini-1.5-flash-002',
            name: 'Gemini 1.5 Flash',
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true,
                web_search: true
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
            id: 'grok-2-1212',
            name: 'Grok 2',
            features: {
                function_calling: true,
                structured_output: true,
                reasoning: true
            }
        },
        {
            enabled: true,
            id: 'grok-2-vision-1212',
            name: 'Grok 2 Vision',
            features: {
                function_calling: true,
                structured_output: true,
                image_input: true
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
