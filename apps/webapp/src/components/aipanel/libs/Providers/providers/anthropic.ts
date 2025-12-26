import type { PresetProvider } from '@/components/aipanel/libs'

export default {
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
} as PresetProvider
