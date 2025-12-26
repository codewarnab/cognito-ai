import type { PresetProvider } from '@/components/aipanel/libs'

export default {
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
} as PresetProvider
