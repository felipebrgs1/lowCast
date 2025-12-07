import type { JSX } from "solid-js";
import { cn } from "@/lib/utils";

interface CommandProps {
	children: JSX.Element;
	class?: string;
	shouldFilter?: boolean;
}

export function Command(props: CommandProps) {
	return (
		<div
			class={cn(
				"flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
				props.class,
			)}
			role="listbox"
		>
			{props.children}
		</div>
	);
}

interface CommandInputProps {
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	class?: string;
}

export function CommandInput(props: CommandInputProps) {
	return (
		<div class="flex items-center border-b px-3">
			<svg
				class="mr-2 h-4 w-4 shrink-0 opacity-50"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width={2}
				stroke="currentColor"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
				/>
			</svg>
			<input
				type="text"
				value={props.value}
				onInput={(e) => props.onValueChange(e.currentTarget.value)}
				placeholder={props.placeholder}
				class={cn(
					"flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
					props.class,
				)}
			/>
		</div>
	);
}

interface CommandListProps {
	children: JSX.Element;
	class?: string;
}

export function CommandList(props: CommandListProps) {
	return <div class={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", props.class)}>{props.children}</div>;
}

interface CommandEmptyProps {
	children: JSX.Element;
}

export function CommandEmpty(props: CommandEmptyProps) {
	return <div class="py-6 text-center text-sm">{props.children}</div>;
}

interface CommandGroupProps {
	children: JSX.Element;
	heading?: JSX.Element;
}

export function CommandGroup(props: CommandGroupProps) {
	return (
		<div class="overflow-hidden p-1 text-foreground">
			{props.heading && <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground">{props.heading}</div>}
			{props.children}
		</div>
	);
}

interface CommandItemProps {
	children: JSX.Element;
	onSelect?: () => void;
	class?: string;
}

export function CommandItem(props: CommandItemProps) {
	return (
		<button
			type="button"
			onClick={props.onSelect}
			class={cn(
				"relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full text-left",
				props.class,
			)}
		>
			{props.children}
		</button>
	);
}

export function CommandSeparator() {
	return <div class="-mx-1 h-px bg-border" />;
}

interface CommandShortcutProps {
	children: JSX.Element;
}

export function CommandShortcut(props: CommandShortcutProps) {
	return <span class="ml-auto text-xs tracking-widest text-muted-foreground">{props.children}</span>;
}
