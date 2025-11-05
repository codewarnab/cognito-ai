"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"

import "./command.css"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "./dialog"

function Command({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
    return (
        <CommandPrimitive
            data-slot="command"
            className={`command ${className || ""}`}
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
            <DialogHeader className="command-dialog-header">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <DialogContent
                className={`command-dialog-content ${className || ""}`}
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
            className="command-input-wrapper"
        >
            <SearchIcon className="search-icon" />
            <CommandPrimitive.Input
                data-slot="command-input"
                className={`command-input ${className || ""}`}
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
            className={`command-list ${className || ""}`}
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
            className="command-empty"
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
            className={`command-group ${className || ""}`}
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
            className={`command-separator ${className || ""}`}
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
            className={`command-item ${className || ""}`}
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
            className={`command-shortcut ${className || ""}`}
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
