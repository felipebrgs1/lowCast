import type { ComponentChildren } from "preact";
import { cn } from "@/lib/utils";

interface ScrollAreaProps {
	children: ComponentChildren;
	className?: string;
}

export function ScrollArea({ children, className }: ScrollAreaProps) {
	return (
		<div
			className={cn(
				"relative overflow-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
				className,
			)}
		>
			{children}
		</div>
	);
}
