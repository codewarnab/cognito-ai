import { memo } from '@/components/aipanel/utils'
import { Switch } from '@base-ui-components/react/switch'

import type { ControllerRenderProps } from 'react-hook-form'

const Index = (props: Partial<ControllerRenderProps> & { disabled?: boolean }) => {
	const { name, value, ref, onChange, disabled } = props as ControllerRenderProps & { disabled?: boolean }

	return (
		<div onClick={e => e.stopPropagation()}>
			<Switch.Root
				className='
					flex
					h-4 w-7
					p-px
					bg-soft/30
					transition-[background]
					rounded-full
					data-[checked]:bg-solid
					data-[disabled]:opacity-50
					data-[disabled]:cursor-not-allowed
				'
				name={name}
				checked={value}
				disabled={disabled}
				inputRef={ref}
				onCheckedChange={onChange}
			>
				<Switch.Thumb
					className='
						h-full
						bg-std-white
						transition-[translate]
						rounded-full
						data-[checked]:translate-x-[calc(var(--spacing)*7-var(--spacing)*4)]
						aspect-square
					'
				/>
			</Switch.Root>
		</div>
	)
}

export default memo(Index)
