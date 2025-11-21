import { convertFileSrc } from "@tauri-apps/api/core";
import { Copy, FileText, Image, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ClipboardEntry } from "@/lib/database";
import { useClipboardStore } from "@/stores/clipboardStore";

interface ClipboardItemProps {
	entry: ClipboardEntry;
}

export function ClipboardItem({ entry }: ClipboardItemProps) {
	const { copyToClipboard, deleteEntry } = useClipboardStore();

	const handleCopy = async () => {
		await copyToClipboard(entry);
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
			className="p-3 hover:bg-accent/50 transition-colors group cursor-pointer"
			onClick={handleCopy}
		>
			<div className="flex items-start gap-3">
				<div className="flex-shrink-0 mt-1">
					{entry.content_type === "text" ? (
						<FileText className="w-4 h-4 text-muted-foreground" />
					) : (
						<Image className="w-4 h-4 text-muted-foreground" />
					)}
				</div>

				<div className="flex-1 min-w-0">
					{entry.content_type === "text" ? (
						<p className="text-sm text-foreground truncate whitespace-pre-wrap line-clamp-3">
							{entry.preview || entry.content}
						</p>
					) : (
						<img
							src={convertFileSrc(entry.content)}
							alt="Clipboard image"
							className="max-h-24 rounded object-contain"
						/>
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
						className="h-8 w-8"
						onClick={(e) => {
							e.stopPropagation();
							handleCopy();
						}}
					>
						<Copy className="w-4 h-4" />
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
