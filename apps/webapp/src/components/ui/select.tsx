"use client";

import {
  ComponentPropsWithoutRef,
  ReactNode,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

type SelectOptionProps = {
  value: string;
  children: string;
  setValue?: (value: string) => void;
  handleSelection?: (text: string) => void;
  closeDropdown?: () => void;
};

export function Select({
  children,
  className,
  placeholder,
  setValue,
  value,
  ...props
}: {
  children: ReactNode;
  placeholder: string;
  className?: string;
  setValue: (value: string) => void;
  value?: string;
  popoverClassName?: string;
} & ComponentPropsWithoutRef<"button">) {
  const [isOpened, setIsOpened] = useState<boolean>(false);
  const [displayText, setDisplayText] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const childrenArray = Array.isArray(children) ? children : [children];

  // Sync internal state with external value prop
  useEffect(() => {
    if (value !== undefined) {
      const selectedChildIndex = childrenArray.findIndex(
        (child) => isValidElement<SelectOptionProps>(child) && child.props.value === value
      );

      if (selectedChildIndex !== -1) {
        const child = childrenArray[selectedChildIndex];
        if (isValidElement<SelectOptionProps>(child)) {
          setDisplayText(child.props.children);
          setSelectedIndex(selectedChildIndex);
        }
      } else {
        setDisplayText("");
        setSelectedIndex(-1);
      }
    }
  }, [value, childrenArray]);

  const closeDropdown = () => setIsOpened(false);

  // Handler for selection that updates both text and index
  const handleSelection = (text: string, index: number) => {
    setDisplayText(text);
    setSelectedIndex(index);
  };

  const childrenWithProps = childrenArray.map((child, index) => {
    if (isValidElement<SelectOptionProps>(child)) {
      return cloneElement(child, {
        setValue,
        handleSelection: (text: string) => handleSelection(text, index),
        closeDropdown,
        key: child.props.value || index,
      });
    }
    return child;
  });

  return (
    <PopoverPrimitive.Root open={isOpened} onOpenChange={setIsOpened}>
      <PopoverPrimitive.Trigger asChild>
        <button
          className={cn(
            "flex items-center w-full gap-2 rounded-xl py-2 px-3 bg-background text-foreground border-input border outline-none hover:bg-accent hover:text-accent-foreground transition ease-in-out duration-200 cursor-pointer min-w-44 justify-between ring-0 focus:ring-2 ring-ring focus:border-border",
            className
          )}
          style={{ minHeight: "40px" }}
          {...props}
        >
          <div className="flex-1 text-left truncate">
            {displayText || <span className="text-muted-foreground">{placeholder}</span>}
          </div>

          <CaretDown
            className={cn(
              "transition-transform duration-200 ml-2 h-4 w-4 opacity-50 flex-shrink-0",
              isOpened && "rotate-180"
            )}
          />
        </button>
      </PopoverPrimitive.Trigger>

      <AnimatePresence>
        {isOpened && (
          <PopoverPrimitive.Portal forceMount>
            <PopoverPrimitive.Content
              align="start"
              className={cn(
                "z-[9999]",
                props.popoverClassName
              )}
              sideOffset={5}
              asChild
            >
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="w-[var(--radix-popover-trigger-width)] border border-border text-popover-foreground rounded-xl p-1 bg-popover shadow-lg max-h-60 overflow-y-auto outline-none"
              >
                {childrenWithProps}
              </motion.div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        )}
      </AnimatePresence>
    </PopoverPrimitive.Root>
  );
}

export function SelectOption({
  children,
  value,
  setValue,
  handleSelection,
  closeDropdown,
  className,
}: SelectOptionProps & { className?: string }) {
  return (
    <div
      className={cn(
        "hover:bg-accent hover:text-accent-foreground p-2 px-5 rounded-xl cursor-pointer transition ease-in-out duration-200",
        className
      )}
      onClick={() => {
        setValue?.(value);
        handleSelection?.(children);
        closeDropdown?.();
      }}
    >
      {children}
    </div>
  );
}
