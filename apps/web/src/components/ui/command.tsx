import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** cmdk command palette, styled to the DextaLearning tokens. */
export const Command = forwardRef<
	ElementRef<typeof CommandPrimitive>,
	ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
	<CommandPrimitive
		ref={ref}
		className={cn(
			"flex h-full w-full flex-col overflow-hidden rounded-card bg-popover text-popover-foreground",
			className,
		)}
		{...props}
	/>
));
Command.displayName = CommandPrimitive.displayName;

export const CommandInput = forwardRef<
	ElementRef<typeof CommandPrimitive.Input>,
	ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
	<div className="flex items-center gap-2 border-border border-b px-3">
		<Search className="size-4 shrink-0 text-muted-foreground" />
		<CommandPrimitive.Input
			ref={ref}
			className={cn(
				"h-11 w-full bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	</div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

export const CommandList = forwardRef<
	ElementRef<typeof CommandPrimitive.List>,
	ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.List
		ref={ref}
		className={cn(
			"max-h-60 overflow-y-auto overflow-x-hidden overscroll-contain py-1",
			className,
		)}
		{...props}
	/>
));
CommandList.displayName = CommandPrimitive.List.displayName;

export const CommandEmpty = forwardRef<
	ElementRef<typeof CommandPrimitive.Empty>,
	ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
	<CommandPrimitive.Empty
		ref={ref}
		className="px-3 py-4 text-center text-muted-foreground text-sm"
		{...props}
	/>
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

export const CommandGroup = forwardRef<
	ElementRef<typeof CommandPrimitive.Group>,
	ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Group
		ref={ref}
		className={cn("overflow-hidden p-1 text-foreground", className)}
		{...props}
	/>
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

export const CommandItem = forwardRef<
	ElementRef<typeof CommandPrimitive.Item>,
	ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Item
		ref={ref}
		className={cn(
			"relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-btn px-3 py-2.5 text-foreground text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
			className,
		)}
		{...props}
	/>
));
CommandItem.displayName = CommandPrimitive.Item.displayName;
