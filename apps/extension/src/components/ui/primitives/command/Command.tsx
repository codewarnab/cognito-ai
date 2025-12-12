import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../dialog"

function Command({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
    return (
        <CommandPrimitive
            data-slot="command"
            className={`flex h-full w-full flex-col overflow-hidden rounded-md bg-[var(--popover-background,white)] text-[var(--popover-foreground,#1f2937)] ${className || ""}`}
            {...props}
        />
    )
}

function CommandDialog({
    title = "Command Palette",
    description = "Search for a command to run...",
    children,
    className,
    showCloseButton = true,
    ...props
}: React.ComponentProps<typeof Dialog> & {
    title?: string
    description?: string
    className?: string
    showCloseButton?: boolean
}) {
    return (
        <Dialog {...props}>
            <DialogHeader className="sr-only">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <DialogContent
                className={`overflow-hidden p-0 [&_.command-styled_[cmdk-group-heading]]:text-[var(--muted-foreground-color,#6b7280)] [&_.command-styled_[cmdk-group-heading]]:px-2 [&_.command-styled_[cmdk-group-heading]]:font-medium [&_.command-styled_[data-slot=command-input-wrapper]]:h-12 [&_.command-styled_[cmdk-group]]:px-2 [&_.command-styled_[cmdk-group]:not([hidden])~[cmdk-group]]:pt-0 [&_.command-styled_[cmdk-input-wrapper]_svg]:h-5 [&_.command-styled_[cmdk-input-wrapper]_svg]:w-5 [&_.command-styled_[cmdk-input]]:h-12 [&_.command-styled_[cmdk-item]]:px-2 [&_.command-styled_[cmdk-item]]:py-3 [&_.command-styled_[cmdk-item]_svg]:h-5 [&_.command-styled_[cmdk-item]_svg]:w-5 ${className || ""}`}
                showCloseButton={showCloseButton}
            >
                <Command className="command-styled">
                    {children}
                </Command>
            </DialogContent>
        </Dialog>
    )
}

function CommandInput({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
    return (
        <div
            data-slot="command-input-wrapper"
            className="flex h-9 items-center gap-2 border-b border-[var(--border-color,#e5e7eb)] px-3"
        >
            <SearchIcon className="w-4 h-4 flex-shrink-0 opacity-50" />
            <CommandPrimitive.Input
                data-slot="command-input"
                className={`flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none border-none placeholder:text-[var(--muted-foreground-color,#6b7280)] disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`}
                {...props}
            />
        </div>
    )
}

function CommandList({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
    return (
        <CommandPrimitive.List
            data-slot="command-list"
            className={`max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto ${className || ""}`}
            {...props}
        />
    )
}

function CommandEmpty({
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
    return (
        <CommandPrimitive.Empty
            data-slot="command-empty"
            className="py-6 text-center text-sm"
            {...props}
        />
    )
}

function CommandGroup({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
    return (
        <CommandPrimitive.Group
            data-slot="command-group"
            className={`overflow-hidden p-1 text-[var(--foreground-color,#1f2937)] [&_[cmdk-group-heading]]:text-[var(--muted-foreground-color,#6b7280)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium ${className || ""}`}
            {...props}
        />
    )
}

function CommandSeparator({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
    return (
        <CommandPrimitive.Separator
            data-slot="command-separator"
            className={`h-px -mx-1 bg-[var(--border-color,#e5e7eb)] ${className || ""}`}
            {...props}
        />
    )
}

function CommandItem({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
    return (
        <CommandPrimitive.Item
            data-slot="command-item"
            className={`relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[selected=true]:bg-[var(--accent-color,#f3f4f6)] data-[selected=true]:text-[var(--accent-foreground-color,#1f2937)] data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:flex-shrink-0 [&_svg:not([class*='size-'])]:w-4 [&_svg:not([class*='size-'])]:h-4 [&_svg:not([class*='text-'])]:text-[var(--muted-foreground-color,#6b7280)] ${className || ""}`}
            {...props}
        />
    )
}

function CommandShortcut({
    className,
    ...props
}: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="command-shortcut"
            className={`ml-auto text-xs tracking-widest text-[var(--muted-foreground-color,#6b7280)] ${className || ""}`}
            {...props}
        />
    )
}

export {
    Command,
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandShortcut,
    CommandSeparator,
}
