import { cn } from "@/lib/utils";

interface SeparatorProps {
	class?: string;
	orientation?: "horizontal" | "vertical";
}

export function Separator(props: SeparatorProps) {
	const orientation = props.orientation || "horizontal";

	return (
		<div
			class={cn(
				"shrink-0 bg-border",
				orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
				props.class,
			)}
		/>
	);
}
