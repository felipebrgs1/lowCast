import type { JSX } from "solid-js";
import { cn } from "@/lib/utils";

interface ScrollAreaProps {
	children: JSX.Element;
	class?: string;
}

export function ScrollArea(props: ScrollAreaProps) {
	return (
		<div
			class={cn(
				"relative overflow-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
				props.class,
			)}
		>
			{props.children}
		</div>
	);
}
