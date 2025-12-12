import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/utils/ui"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

const variantStyles: Record<BadgeVariant, string> = {
    default: "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]",
    secondary: "border-transparent bg-[var(--secondary)] text-[var(--secondary-foreground)]",
    destructive: "border-transparent bg-[var(--destructive)] text-white dark:bg-[color-mix(in_srgb,var(--destructive)_60%,black)]",
    outline: "text-[var(--foreground)]"
}

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
    const isLink = asChild || props.onClick

    return (
        <Comp
            data-slot="badge"
            className={cn(
                // Base styles
                "inline-flex items-center justify-center rounded-full border",
                "px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap",
                "flex-shrink-0 gap-1 overflow-hidden",
                "transition-[color,box-shadow]",
                // Focus styles
                "focus-visible:border-[var(--ring)] focus-visible:shadow-[0_0_0_3px_rgba(var(--ring-rgb),0.5)]",
                // Invalid state
                "aria-[invalid=true]:shadow-[0_0_0_3px_rgba(var(--destructive-rgb),0.2)] aria-[invalid=true]:border-[var(--destructive)]",
                "dark:aria-[invalid=true]:shadow-[0_0_0_3px_rgba(var(--destructive-rgb),0.4)]",
                // Variant styles
                variantStyles[variant],
                // Destructive focus
                variant === "destructive" && "focus-visible:shadow-[0_0_0_3px_rgba(var(--destructive-rgb),0.2)] dark:focus-visible:shadow-[0_0_0_3px_rgba(var(--destructive-rgb),0.4)]",
                // SVG child styles
                "[&>svg]:w-3 [&>svg]:h-3 [&>svg]:pointer-events-none",
                className
            )}
            style={
                isLink ? {
                    // Hover effects using color-mix (not supported in Tailwind)
                    ...(variant === "default" && {
                        "--hover-bg": "color-mix(in srgb, var(--primary) 90%, black)"
                    } as React.CSSProperties),
                    ...(variant === "secondary" && {
                        "--hover-bg": "color-mix(in srgb, var(--secondary) 90%, black)"
                    } as React.CSSProperties),
                    ...(variant === "destructive" && {
                        "--hover-bg": "color-mix(in srgb, var(--destructive) 90%, black)"
                    } as React.CSSProperties),
                    ...(variant === "outline" && {
                        "--hover-bg": "var(--accent)",
                        "--hover-color": "var(--accent-foreground)"
                    } as React.CSSProperties)
                } as React.CSSProperties : undefined
            }
            onMouseEnter={isLink && variant !== "outline" ? (e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--hover-bg)"
            } : isLink && variant === "outline" ? (e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--hover-bg)";
                (e.currentTarget as HTMLElement).style.color = "var(--hover-color)"
            } : undefined}
            onMouseLeave={isLink ? (e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "";
                (e.currentTarget as HTMLElement).style.color = ""
            } : undefined}
            {...props}
        />
    )
}

export { Badge }
export type { BadgeVariant }
