import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

function Collapsible({
    ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
    return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
    ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
    return (
        <CollapsiblePrimitive.CollapsibleTrigger
            data-slot="collapsible-trigger"
            {...props}
        />
    )
}

function CollapsibleContent({
    className,
    ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
    return (
        <CollapsiblePrimitive.CollapsibleContent
            data-slot="collapsible-content"
            className={`overflow-hidden data-[state=open]:animate-[collapsible-down_200ms_ease-out] data-[state=closed]:animate-[collapsible-up_200ms_ease-out] ${className || ''}`}
            style={{
                // Keyframe animations for Radix Collapsible
                ...({
                    '@keyframes collapsible-down': {
                        from: { height: 0 },
                        to: { height: 'var(--radix-collapsible-content-height)' }
                    },
                    '@keyframes collapsible-up': {
                        from: { height: 'var(--radix-collapsible-content-height)' },
                        to: { height: 0 }
                    }
                } as any)
            }}
            {...props}
        />
    )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
