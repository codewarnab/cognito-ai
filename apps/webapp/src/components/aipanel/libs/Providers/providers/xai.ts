import type { PresetProvider } from '@/components/aipanel/libs'

export default {
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
} as PresetProvider

