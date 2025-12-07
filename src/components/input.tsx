import type { ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "@/lib/utils";

interface InputProps extends ComponentProps<"input"> {
	type?: string;
}

export function Input(props: InputProps) {
	const [local, others] = splitProps(props, ["class", "type"]);
	const type = local.type || "text";

	return (
		<input
			type={type}
			class={cn(
				"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
				local.class,
			)}
			{...others}
		/>
	);
}
