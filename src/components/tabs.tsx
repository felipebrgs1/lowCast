import type { JSX } from "solid-js";
import { cn } from "@/lib/utils";

interface TabsProps {
	children: JSX.Element;
	defaultValue?: string;
	class?: string;
}

export function Tabs(props: TabsProps) {
	return <div class={cn("", props.class)}>{props.children}</div>;
}

interface TabsListProps {
	children: JSX.Element;
	class?: string;
}

export function TabsList(props: TabsListProps) {
	return (
		<div
			class={cn(
				"inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
				props.class,
			)}
		>
			{props.children}
		</div>
	);
}

interface TabsTriggerProps {
	children: JSX.Element;
	value: string;
	class?: string;
	onClick?: () => void;
}

export function TabsTrigger(props: TabsTriggerProps) {
	return (
		<button
			type="button"
			onClick={props.onClick}
			class={cn(
				"inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
				props.class,
			)}
			data-value={props.value}
		>
			{props.children}
		</button>
	);
}

interface TabsContentProps {
	children: JSX.Element;
	value: string;
	class?: string;
}

export function TabsContent(props: TabsContentProps) {
	return (
		<div
			class={cn(
				"mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				props.class,
			)}
			data-value={props.value}
		>
			{props.children}
		</div>
	);
}
