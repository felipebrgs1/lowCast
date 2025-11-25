import { readFile } from "@tauri-apps/plugin-fs";
import { Check, Copy, FileText, Image as ImageIcon, Maximize2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ClipboardEntry } from "@/lib/database";
import { useClipboardStore } from "@/stores/clipboardStore";

function ClipboardImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
	const [src, setSrc] = useState<string>("");

	useEffect(() => {
		let active = true;
		let objectUrl: string | null = null;

		const load = async () => {
			try {
				const bytes = await readFile(path);
				const blob = new Blob([bytes]);
				objectUrl = URL.createObjectURL(blob);
				if (active) {
					setSrc(objectUrl);
				}
			} catch (err) {
				console.error("Error loading image:", err);
			}
		};

		load();

		return () => {
			active = false;
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	}, [path]);

	if (!src) return <div className={`${className} bg-muted/50 animate-pulse`} />;

	return (
		<img
			src={src}
			alt={alt}
			className={className}
		/>
	);
}

interface ClipboardItemProps {
	entry: ClipboardEntry;
}

export function ClipboardItem({ entry }: ClipboardItemProps) {
	const { copyToClipboard, deleteEntry } = useClipboardStore();
	const [isCopied, setIsCopied] = useState(false);

	const handleCopy = async () => {
		await copyToClipboard(entry);
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 2000);
	};

	const handleDelete = async () => {
		await deleteEntry(entry.id);
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleString("pt-BR", {
			day: "2-digit",
			month: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<Card
			className={`p-3 transition-all group cursor-pointer border-l-4 ${
				isCopied
					? "bg-green-500/10 border-l-green-500 border-y-transparent border-r-transparent"
					: "hover:bg-accent/50 border-l-transparent"
			}`}
			onClick={handleCopy}
		>
			<div className="flex items-start gap-3">
				<div className="shrink-0 mt-1">
					{entry.content_type === "text" ? (
						<FileText className="w-4 h-4 text-muted-foreground" />
					) : (
						<ImageIcon className="w-4 h-4 text-muted-foreground" />
					)}
				</div>

				<div className="flex-1 min-w-0">
					{entry.content_type === "text" ? (
						<p className="text-sm text-foreground truncate whitespace-pre-wrap line-clamp-3">
							{entry.preview || entry.content}
						</p>
					) : (
						<Dialog>
							<DialogTrigger asChild>
								<button
									type="button"
									className="relative group/image inline-block cursor-pointer border-0 bg-transparent p-0"
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.stopPropagation();
										}
									}}
								>
									<ClipboardImage
										path={entry.content}
										alt="Clipboard image"
										className="max-h-24 rounded object-contain bg-background/50 border"
									/>
									<div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center rounded">
										<Maximize2 className="w-5 h-5 text-white" />
									</div>
								</button>
							</DialogTrigger>
							<DialogContent className="max-w-3xl max-h-[80vh] p-0 bg-transparent border-none shadow-none">
								<DialogTitle className="sr-only">Visualização da Imagem</DialogTitle>
								<DialogDescription className="sr-only">
									Imagem completa do item do clipboard
								</DialogDescription>
								<ClipboardImage
									path={entry.content}
									alt="Clipboard full"
									className="w-full h-full object-contain rounded-lg"
								/>
							</DialogContent>
						</Dialog>
					)}

					<div className="flex items-center gap-2 mt-2">
						<Badge
							variant="secondary"
							className="text-xs"
						>
							{entry.content_type === "text" ? "Texto" : "Imagem"}
						</Badge>
						<span className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</span>
					</div>
				</div>

				<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
					<Button
						variant="ghost"
						size="icon"
						className={`h-8 w-8 ${isCopied ? "text-green-500" : ""}`}
						onClick={(e) => {
							e.stopPropagation();
							handleCopy();
						}}
					>
						{isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-destructive hover:text-destructive"
						onClick={(e) => {
							e.stopPropagation();
							handleDelete();
						}}
					>
						<Trash2 className="w-4 h-4" />
					</Button>
				</div>
			</div>
		</Card>
	);
}
