import type { ComponentChildren } from "preact";
import { cn } from "@/lib/utils";

interface TabsProps {
	children: ComponentChildren;
	defaultValue?: string;
	className?: string;
}

export function Tabs({ children, className }: TabsProps) {
	return <div className={cn("", className)}>{children}</div>;
}

interface TabsListProps {
	children: ComponentChildren;
	className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
	return (
		<div
			className={cn(
				"inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
				className,
			)}
		>
			{children}
		</div>
	);
}

interface TabsTriggerProps {
	children: ComponentChildren;
	value: string;
	className?: string;
	onClick?: () => void;
}

export function TabsTrigger({ children, value, className, onClick }: TabsTriggerProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
				className,
			)}
			data-value={value}
		>
			{children}
		</button>
	);
}

interface TabsContentProps {
	children: ComponentChildren;
	value: string;
	className?: string;
}

export function TabsContent({ children, value, className }: TabsContentProps) {
	return (
		<div
			className={cn(
				"mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				className,
			)}
			data-value={value}
		>
			{children}
		</div>
	);
}
