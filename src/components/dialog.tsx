import type { JSX } from "solid-js";
import { createEffect } from "solid-js";
import { cn } from "@/lib/utils";

interface DialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: JSX.Element;
}

export function Dialog(props: DialogProps) {
	let dialogRef: HTMLDialogElement | undefined;

	createEffect(() => {
		const dialog = dialogRef;
		if (!dialog) return;

		if (props.open) {
			dialog.showModal();
		} else {
			dialog.close();
		}
	});

	const handleBackdropClick = (e: MouseEvent) => {
		// Only close if clicking directly on the dialog (backdrop), not on children
		if (e.target === dialogRef) {
			props.onOpenChange(false);
		}
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			props.onOpenChange(false);
		}
	};

	return (
		<dialog
			ref={dialogRef}
			class="backdrop:bg-black/50 rounded-lg p-0 bg-background border border-border shadow-lg"
			onClose={() => props.onOpenChange(false)}
			onClick={handleBackdropClick}
			onKeyDown={handleKeyDown}
		>
			{props.children}
		</dialog>
	);
}

interface DialogContentProps {
	children: JSX.Element;
	class?: string;
}

export function DialogContent(props: DialogContentProps) {
	return <div class={cn("p-6", props.class)}>{props.children}</div>;
}

interface DialogHeaderProps {
	children: JSX.Element;
	class?: string;
}

export function DialogHeader(props: DialogHeaderProps) {
	return <div class={cn("flex flex-col space-y-1.5 text-center sm:text-left", props.class)}>{props.children}</div>;
}

interface DialogTitleProps {
	children: JSX.Element;
	class?: string;
}

export function DialogTitle(props: DialogTitleProps) {
	return <h2 class={cn("text-lg font-semibold leading-none tracking-tight", props.class)}>{props.children}</h2>;
}
