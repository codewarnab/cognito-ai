import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"
import { cn } from "@/utils/ui"

function Drawer({
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
    return <DialogPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
    return <DialogPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
    return <DialogPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
    return (
        <DialogPrimitive.Overlay
            data-slot="drawer-overlay"
            className={cn(
                "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "duration-300",
                className
            )}
            {...props}
        />
    )
}

function DrawerContent({
    className,
    children,
    showCloseButton = true,
    showHandle = true,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean
    showHandle?: boolean
}) {
    return (
        <DrawerPortal data-slot="drawer-portal">
            <DrawerOverlay />
            <DialogPrimitive.Content
                data-slot="drawer-content"
                className={cn(
                    // Position at bottom
                    "fixed inset-x-0 bottom-0 z-50",
                    // Sizing
                    "w-full max-h-[90vh]",
                    // Styling with glassmorphism
                    "bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)]",
                    "border-t border-x border-[var(--border-color)]/50",
                    "rounded-t-2xl",
                    // Shadow and glow
                    "shadow-[0_-10px_60px_-15px_rgba(59,130,246,0.15)]",
                    // Layout
                    "px-6 pb-8 pt-4",
                    // Animations - slide up from bottom
                    "data-[state=open]:animate-in data-[state=closed]:animate-out",
                    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                    "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
                    "duration-300 ease-out",
                    className
                )}
                {...props}
            >
                {/* Animated handle indicator */}
                {showHandle && (
                    <div className="flex justify-center mb-4">
                        <div
                            className={cn(
                                "w-12 h-1.5 rounded-full",
                                "bg-gradient-to-r from-blue-500/40 via-blue-400/60 to-blue-500/40",
                                "animate-pulse"
                            )}
                        />
                    </div>
                )}

                {children}

                {showCloseButton && (
                    <DialogPrimitive.Close
                        data-slot="drawer-close"
                        className={cn(
                            "absolute right-4 top-4 p-2 rounded-full",
                            "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                            "bg-white/5 hover:bg-white/10",
                            "transition-all duration-200",
                            "focus:outline-none focus:ring-2 focus:ring-blue-500/40",
                            "cursor-pointer",
                            "hover:scale-110 active:scale-95"
                        )}
                    >
                        <XIcon className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Content>
        </DrawerPortal>
    )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="drawer-header"
            className={cn(
                "flex flex-col gap-2 text-center mb-4",
                className
            )}
            {...props}
        />
    )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="drawer-footer"
            className={cn(
                "flex flex-col gap-2 mt-6",
                className
            )}
            {...props}
        />
    )
}

function DrawerTitle({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            data-slot="drawer-title"
            className={cn(
                "text-lg font-semibold text-[var(--text-primary)]",
                "flex items-center justify-center gap-2",
                className
            )}
            {...props}
        />
    )
}

function DrawerDescription({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            data-slot="drawer-description"
            className={cn(
                "text-sm text-[var(--text-secondary)]",
                className
            )}
            {...props}
        />
    )
}

export {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerOverlay,
    DrawerPortal,
    DrawerTitle,
    DrawerTrigger,
}
