import { memo } from '@/components/aipanel/utils'
import {
	BracketsCurlyIcon,
	BrainIcon,
	EyeIcon,
	FileImageIcon,
	GoogleChromeLogoIcon,
	ImagesSquareIcon,
	ToggleRightIcon,
	WrenchIcon
} from '@phosphor-icons/react'

import type { Icon } from '@phosphor-icons/react'

export const feature_metadata = {
	reasoning: {
		Icon: BrainIcon
	},
	vision: {
		Icon: EyeIcon
	},
	reasoning_optional: {
		Icon: ToggleRightIcon
	},
	function_calling: {
		Icon: WrenchIcon,
		no_border_r: true
	},
	web_search: {
		Icon: GoogleChromeLogoIcon
	},
	image_input: {
		Icon: ImagesSquareIcon
	},
	structured_output: {
		Icon: BracketsCurlyIcon
	},
	image_output: {
		Icon: FileImageIcon,
		no_border_r: true
	}
} as Record<string, { Icon: Icon; col?: string; no_border_r?: boolean }>

export const feature_keys = Object.keys(feature_metadata)

interface IProps {
	name: string
}

const Index = (props: IProps) => {
	const { name } = props
	const { Icon } = feature_metadata[name]

	return <Icon />
}

export default memo(Index)
