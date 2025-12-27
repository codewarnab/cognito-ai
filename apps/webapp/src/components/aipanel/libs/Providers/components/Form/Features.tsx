import { memo } from '@/components/aipanel/utils'

import { useGlobalState } from '../../context'
import Feature, { feature_keys, feature_metadata } from './Feature'

import type { ControllerRenderProps } from 'react-hook-form'
import type { IPropsFormModelFormFeatures } from '../../types'

const Index = (props: IPropsFormModelFormFeatures) => {
	const { name, value: features = {} } = props as IPropsFormModelFormFeatures & ControllerRenderProps
	const { locales } = useGlobalState()

	return (
		<div className='grid grid-cols-4'>
			{feature_keys.map(key => (
				<div
					className={`
						flex flex-col justify-center items-center
						h-14
						gap-1
						text-soft text-base
						border-b border-border-gray
						select-none
						${feature_metadata[key].no_border_r ? 'border-r-0' : 'border-r'}
						${features[key as keyof typeof features] && 'text-solid'}
						${name === 'features' && 'nth-last-of-type-[-n+4]:border-b-0'}
					`}
					key={key}
				>
					<Feature name={key}></Feature>
					<span className='text-xs capitalize'>
						{locales.form.features[key as keyof typeof locales.form.features]}
					</span>
				</div>
			))}
		</div>
	)
}

export default memo(Index)
