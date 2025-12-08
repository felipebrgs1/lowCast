import { convertFileSrc } from "@tauri-apps/api/core";
import { ArrowLeft, Check, Clipboard, Copy, FileText, Image as ImageIcon, Trash2, X } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { Button, ScrollArea } from "@/components";
import type { ClipboardEntry } from "@/lib/database";
import { isTauri } from "@/lib/utils";
import { clearHistory, clipboardStore, copyToClipboard, deleteEntry } from "@/stores/clipboardStore";

interface ClipboardViewProps {
	onBack: () => void;
}

export function ClipboardView(props: ClipboardViewProps) {
	const [copiedId, setCopiedId] = createSignal<number | null>(null);
	const [expandedImage, setExpandedImage] = createSignal<string | null>(null);

	const handleCopyClipboard = async (entry: ClipboardEntry) => {
		await copyToClipboard(entry);
		setCopiedId(entry.id);
		setTimeout(() => setCopiedId(null), 1500);
	};

	const getImageSrc = (path: string): string => {
		if (isTauri() && path) {
			const normalizedPath = path.replace(/\\/g, "/");
			return convertFileSrc(normalizedPath);
		}
		return path;
	};

	return (
		<>
			<div class="flex flex-col h-full">
				{/* Header */}
				<div class="flex items-center gap-3 h-14 px-4 border-b border-border/50">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => props.onBack()}
						class="h-8 w-8"
					>
						<ArrowLeft class="h-4 w-4" />
					</Button>
					<div class="flex items-center gap-2">
						<Clipboard class="h-5 w-5 text-muted-foreground" />
						<span class="font-medium text-lg">Clipboard History</span>
					</div>
					<span class="text-sm text-muted-foreground ml-auto">{clipboardStore.entries.length} items</span>
					<Show when={clipboardStore.entries.length > 0}>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => clearHistory()}
							class="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
						>
							<Trash2 class="h-4 w-4 mr-1" />
							Clear
						</Button>
					</Show>
				</div>

				{/* Items list */}
				<ScrollArea class="flex-1">
					<div class="p-2 space-y-1">
						<Show
							when={clipboardStore.entries.length > 0}
							fallback={
								<div class="text-center py-12 text-muted-foreground">
									<Clipboard class="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p class="font-medium">No items in history</p>
									<p class="text-sm">Copy something to get started</p>
								</div>
							}
						>
							<For each={clipboardStore.entries}>
								{(entry) => (
									// biome-ignore lint/a11y/useSemanticElements: custom button
									<div
										role="button"
										tabIndex={0}
										onClick={() => handleCopyClipboard(entry)}
										onKeyDown={(e) => e.key === "Enter" && handleCopyClipboard(entry)}
										class="flex items-start gap-3 p-3 rounded-lg w-full text-left hover:bg-muted/50 transition-colors group cursor-pointer"
									>
										{/* Image preview or icon */}
										<div class="shrink-0">
											<Show
												when={entry.content_type === "image"}
												fallback={
													<div class="flex h-12 w-12 items-center justify-center rounded-md bg-muted/50">
														<FileText class="h-6 w-6 text-muted-foreground" />
													</div>
												}
											>
												<Button
													variant="ghost"
													onClick={(e) => {
														e.stopPropagation();
														setExpandedImage(getImageSrc(entry.content));
													}}
													class="h-12 w-12 p-0 rounded-md overflow-hidden bg-muted/50 hover:ring-2 hover:ring-primary"
												>
													<img
														src={getImageSrc(entry.content)}
														alt="Clipboard entry"
														loading="lazy"
														decoding="async"
														class="h-full w-full object-cover"
														onError={(e) => {
															const target = e.currentTarget as HTMLImageElement;
															target.style.display = "none";
															const parent = target.parentElement;
															if (parent) {
																parent.innerHTML =
																	'<div class="flex h-full w-full items-center justify-center"><svg class="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
															}
														}}
													/>
												</Button>
											</Show>
										</div>

										{/* Content */}
										<div class="flex-1 min-w-0">
											<Show
												when={entry.content_type === "text"}
												fallback={
													<div class="flex items-center gap-1">
														<ImageIcon class="h-4 w-4 text-muted-foreground" />
														<span class="font-medium text-sm">Image</span>
													</div>
												}
											>
												<p class="text-sm line-clamp-2 break-all">
													{(entry.preview || entry.content).replace(/\n/g, " ")}
												</p>
											</Show>
											<div class="flex items-center gap-2 mt-1">
												<span class="text-xs text-muted-foreground">
													{new Date(entry.created_at).toLocaleString()}
												</span>
												<span class="text-xs text-muted-foreground">•</span>
												<span class="text-xs text-muted-foreground">
													{entry.content_type === "text"
														? `${entry.content.length} chars`
														: "PNG"}
												</span>
											</div>
										</div>

										{/* Action buttons */}
										<div class="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<Button
												variant="ghost"
												size="icon"
												onClick={(e) => {
													e.stopPropagation();
													deleteEntry(entry.id);
												}}
												class="h-8 w-8 hover:bg-destructive/10"
												title="Delete"
											>
												<Trash2 class="h-4 w-4 text-muted-foreground hover:text-destructive" />
											</Button>
											<Show
												when={copiedId() === entry.id}
												fallback={
													<div class="h-8 w-8 flex items-center justify-center rounded-md bg-muted/50">
														<Copy class="h-4 w-4 text-muted-foreground" />
													</div>
												}
											>
												<div class="h-8 w-8 flex items-center justify-center rounded-md bg-green-500/20">
													<Check class="h-4 w-4 text-green-500" />
												</div>
											</Show>
										</div>
									</div>
								)}
							</For>
						</Show>
					</div>
				</ScrollArea>
			</div>

			{/* Expanded image modal */}
			<Show when={expandedImage()}>
				<div
					role="dialog"
					tabIndex={-1}
					class="fixed inset-0 z-50 flex items-center justify-center"
					onClick={() => setExpandedImage(null)}
					onKeyDown={(e) => e.key === "Escape" && setExpandedImage(null)}
				>
					<Button
						variant="ghost"
						size="icon"
						onClick={(e) => {
							e.stopPropagation();
							setExpandedImage(null);
						}}
						class="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 z-10"
					>
						<X class="h-6 w-6 text-white" />
					</Button>
					<img
						src={expandedImage() ?? ""}
						alt="Expanded entry"
						class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg pointer-events-none"
					/>
				</div>
			</Show>
		</>
	);
}
