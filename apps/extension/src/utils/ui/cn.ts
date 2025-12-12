import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines clsx and tailwind-merge for optimal class merging.
 * Compatible with both Tailwind CSS v3 and v4.
 * 
 * @param inputs - Class names, arrays, objects, or conditional class values.
 * @returns A single string with merged and deduplicated class names.
 * 
 * @example
 * // Basic usage
 * cn("px-2 py-1", "px-4") // => "py-1 px-4"
 * 
 * // Conditional classes
 * cn("base", isActive && "active", { "disabled": isDisabled })
 * 
 * // Arrays
 * cn(["flex", "items-center"], "gap-2")
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

/**
 * Legacy function for backward compatibility.
 * @deprecated Use `cn` instead for better Tailwind class merging.
 */
export function classNames(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(" ");
}
