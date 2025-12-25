import { useMemo, type FC, type SVGProps } from 'react'
import { deepmerge } from 'deepmerge-ts'

import { useGlobalState } from '@/components/aipanel/libs/Providers/context'
import { memo } from '@/components/aipanel/utils'

// Fallback icons from Phosphor
import {
	Robot,
	EyeClosed,
	CirclesFour,
} from '@phosphor-icons/react'

import type { Icon } from '@phosphor-icons/react'

// Custom SVG icon components matching brand identities

const GeminiIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
		fillRule="evenodd"
		width="1em"
		height="1em"
		{...props}
	>
		<path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" />
	</svg>
)

const OpenAIIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
		width="1em"
		height="1em"
		{...props}
	>
		<path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.058 6.058 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
	</svg>
)

const AnthropicIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
		width="1em"
		height="1em"
		{...props}
	>
		<path d="M17.304 3.541h-3.672l6.696 16.918h3.672zm-10.608 0L0 20.459h3.744l1.37-3.553h7.005l1.369 3.553h3.744L10.536 3.541zm-.371 10.623 2.431-6.298 2.431 6.298z" />
	</svg>
)


const GrokIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
		fillRule="evenodd"
		width="1em"
		height="1em"
		{...props}
	>
		<path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815" />
	</svg>
)

const OllamaIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
		width="1em"
		height="1em"
		{...props}
	>
		<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm4 0c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm-2 5c2.21 0 4-1.79 4-4h-8c0 2.21 1.79 4 4 4z" />
	</svg>
)

// Monochrome Vertex AI icon - hexagon with V shape
const VertexAIIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
		width="1em"
		height="1em"
		{...props}
	>
		{/* Hexagon outline */}
		<path
			d="M12 2L21.5 7.5V16.5L12 22L2.5 16.5V7.5L12 2Z"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		/>
		{/* V shape inside */}
		<path
			d="M7 8L12 16L17 8"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
)

// Map providers to proper brand icons
export const module_icon = {
	google_gemini: GeminiIcon,
	anthropic: AnthropicIcon,
	ollama: OllamaIcon,
	openai: OpenAIIcon,
	xai: GrokIcon,
	vertex: VertexAIIcon,
	custom: CirclesFour,
	disabled: EyeClosed
} as Record<string, any>

interface IProps {
	name: string
	color?: string
	size?: string | number
	className?: string
}

const Index = ({ name, ...props }: IProps) => {
	const { icons = {} } = useGlobalState()

	const Icon = useMemo(() => {
		const icon_maps = deepmerge(module_icon, icons)

		return name in icon_maps ? icon_maps[name] : Robot
	}, [name, icons])

	return <Icon {...props} />
}

export default memo(Index)
