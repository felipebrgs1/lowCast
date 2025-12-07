import type { ComponentProps, JSX } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "@/lib/utils";

interface CardProps extends ComponentProps<"div"> {
	children?: JSX.Element;
}

export function Card(props: CardProps) {
	const [local, others] = splitProps(props, ["class", "children"]);

	return (
		<div
			data-slot="card"
			class={cn("bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm", local.class)}
			{...others}
		>
			{local.children}
		</div>
	);
}

export function CardHeader(props: CardProps) {
	const [local, others] = splitProps(props, ["class", "children"]);

	return (
		<div
			data-slot="card-header"
			class={cn(
				"@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
				local.class,
			)}
			{...others}
		>
			{local.children}
		</div>
	);
}

export function CardTitle(props: CardProps) {
	const [local, others] = splitProps(props, ["class", "children"]);

	return (
		<div
			data-slot="card-title"
			class={cn("leading-none font-semibold", local.class)}
			{...others}
		>
			{local.children}
		</div>
	);
}

export function CardDescription(props: CardProps) {
	const [local, others] = splitProps(props, ["class", "children"]);

	return (
		<div
			data-slot="card-description"
			class={cn("text-muted-foreground text-sm", local.class)}
			{...others}
		>
			{local.children}
		</div>
	);
}

export function CardAction(props: CardProps) {
	const [local, others] = splitProps(props, ["class", "children"]);

	return (
		<div
			data-slot="card-action"
			class={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", local.class)}
			{...others}
		>
			{local.children}
		</div>
	);
}

export function CardContent(props: CardProps) {
	const [local, others] = splitProps(props, ["class", "children"]);

	return (
		<div
			data-slot="card-content"
			class={cn("px-6", local.class)}
			{...others}
		>
			{local.children}
		</div>
	);
}

export function CardFooter(props: CardProps) {
	const [local, others] = splitProps(props, ["class", "children"]);

	return (
		<div
			data-slot="card-footer"
			class={cn("flex items-center px-6 [.border-t]:pt-6", local.class)}
			{...others}
		>
			{local.children}
		</div>
	);
}
