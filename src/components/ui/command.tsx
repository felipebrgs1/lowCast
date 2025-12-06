import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/utils";

interface CommandProps {
	children: ComponentChildren;
	className?: string;
	shouldFilter?: boolean;
}

export function Command({ children, className }: CommandProps) {
	return (
		<div
			className={cn(
				"flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
				className,
			)}
			role="listbox"
		>
			{children}
		</div>
	);
}

interface CommandInputProps {
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	className?: string;
}

export function CommandInput({ value, onValueChange, placeholder, className }: CommandInputProps) {
	return (
		<div className="flex items-center border-b px-3">
			<svg
				className="mr-2 h-4 w-4 shrink-0 opacity-50"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				strokeWidth={2}
				stroke="currentColor"
				aria-labelledby="search-icon-title"
			>
				<title id="search-icon-title">Search</title>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
				/>
			</svg>
			<input
				type="text"
				value={value}
				onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => onValueChange(e.currentTarget.value)}
				placeholder={placeholder}
				className={cn(
					"flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
			/>
		</div>
	);
}

interface CommandListProps {
	children: ComponentChildren;
	className?: string;
}

export function CommandList({ children, className }: CommandListProps) {
	return <div className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}>{children}</div>;
}

interface CommandEmptyProps {
	children: ComponentChildren;
}

export function CommandEmpty({ children }: CommandEmptyProps) {
	return <div className="py-6 text-center text-sm">{children}</div>;
}

interface CommandGroupProps {
	children: ComponentChildren;
	heading?: string;
}

export function CommandGroup({ children, heading }: CommandGroupProps) {
	return (
		<div className="overflow-hidden p-1 text-foreground">
			{heading && <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{heading}</div>}
			{children}
		</div>
	);
}

interface CommandItemProps {
	children: ComponentChildren;
	onSelect?: () => void;
	className?: string;
}

export function CommandItem({ children, onSelect, className }: CommandItemProps) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full text-left",
				className,
			)}
		>
			{children}
		</button>
	);
}

export function CommandSeparator() {
	return <div className="-mx-1 h-px bg-border" />;
}

interface CommandShortcutProps {
	children: ComponentChildren;
}

export function CommandShortcut({ children }: CommandShortcutProps) {
	return <span className="ml-auto text-xs tracking-widest text-muted-foreground">{children}</span>;
}
