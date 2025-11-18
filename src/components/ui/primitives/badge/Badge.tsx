import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "../../../../utils/cn"
import "./badge.css"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

function Badge({
    className,
    variant = "default",
    asChild = false,
    ...props
}: React.ComponentPropsWithoutRef<"span"> & {
    variant?: BadgeVariant
    asChild?: boolean
}) {
    const Comp = asChild ? Slot : "span"

    return (
        <Comp
            data-slot="badge"
            className={cn("badge", `badge-${variant}`, className)}
            {...props}
        />
    )
}

export { Badge }
export type { BadgeVariant }
