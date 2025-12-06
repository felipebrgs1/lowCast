import type { ComponentChildren, JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { cn } from "@/lib/utils";

interface DialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ComponentChildren;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		if (open) {
			dialog.showModal();
		} else {
			dialog.close();
		}
	}, [open]);

	const handleBackdropClick = (e: JSX.TargetedMouseEvent<HTMLDialogElement>) => {
		// Only close if clicking directly on the dialog (backdrop), not on children
		if (e.target === dialogRef.current) {
			onOpenChange(false);
		}
	};

	const handleKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLDialogElement>) => {
		if (e.key === "Escape") {
			onOpenChange(false);
		}
	};

	return (
		<dialog
			ref={dialogRef}
			className="backdrop:bg-black/50 rounded-lg p-0 bg-background border border-border shadow-lg"
			onClose={() => onOpenChange(false)}
			onClick={handleBackdropClick}
			onKeyDown={handleKeyDown}
		>
			{children}
		</dialog>
	);
}

interface DialogContentProps {
	children: ComponentChildren;
	className?: string;
}

export function DialogContent({ children, className }: DialogContentProps) {
	return <div className={cn("p-6", className)}>{children}</div>;
}

interface DialogHeaderProps {
	children: ComponentChildren;
	className?: string;
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
	return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}>{children}</div>;
}

interface DialogTitleProps {
	children: ComponentChildren;
	className?: string;
}

export function DialogTitle({ children, className }: DialogTitleProps) {
	return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>{children}</h2>;
}
