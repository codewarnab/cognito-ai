import type { PresetProvider } from '@/components/aipanel/libs'

export default {
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
} as PresetProvider
