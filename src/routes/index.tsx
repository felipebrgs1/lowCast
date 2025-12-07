import { createFileRoute } from "@tanstack/solid-router";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
	AppWindow,
	ArrowLeft,
	Check,
	Clipboard,
	Copy,
	FileText,
	Image as ImageIcon,
	RefreshCw,
	Trash2,
	X,
} from "lucide-solid";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
	ScrollArea,
} from "@/components";
import type { ClipboardEntry } from "@/lib/database";
import { isTauri } from "@/lib/utils";
import {
	type Application,
	appsStore,
	launchApp,
	loadApplications,
	refreshApplications,
	searchApps,
} from "@/stores/appsStore";
import {
	clearHistory,
	clipboardStore,
	copyToClipboard,
	deleteEntry,
	loadHistory,
	startListening,
	stopListening,
} from "@/stores/clipboardStore";

export const Route = createFileRoute("/")({
	component: IndexPage,
});

type ActiveView = "apps" | "clipboard";

function IndexPage() {
	const [query, setQuery] = createSignal("");
	const [activeView, setActiveView] = createSignal<ActiveView>("apps");
	const [hasInitialized, setHasInitialized] = createSignal(false);
	const [copiedId, setCopiedId] = createSignal<number | null>(null);
	const [expandedImage, setExpandedImage] = createSignal<string | null>(null);

	// Inicialização - executar apenas uma vez
	createEffect(() => {
		if (hasInitialized()) return;
		setHasInitialized(true);

		loadHistory();
		loadApplications();
		startListening();
	});

	// Cleanup
	onCleanup(() => {
		stopListening();
	});

	// Busca reativa
	createEffect(() => {
		searchApps(query());
	});

	const handleLaunchApp = async (app: Application) => {
		await launchApp(app);
		// Esconder a janela após abrir o app
		if (isTauri()) {
			await getCurrentWindow().hide();
		}
	};

	const handleCopyClipboard = async (entry: ClipboardEntry) => {
		await copyToClipboard(entry);
		// Mostrar feedback visual
		setCopiedId(entry.id);
		setTimeout(() => setCopiedId(null), 1500);
	};

	// Converter path de arquivo para URL válida usando protocolo asset do Tauri
	const getImageSrc = (path: string): string => {
		if (isTauri() && path) {
			// No Tauri 2.0, convertFileSrc usa o protocolo asset://
			// Normalizar barras invertidas do Windows
			const normalizedPath = path.replace(/\\/g, "/");
			return convertFileSrc(normalizedPath);
		}
		return path;
	};

	return (
		<div class="h-full w-full">
			<Show when={activeView() === "apps"}>
				<Command
					shouldFilter={false}
					class="rounded-none border-0 bg-transparent"
				>
					<CommandInput
						placeholder="Buscar aplicativos..."
						value={query()}
						onValueChange={setQuery}
						class="text-lg h-14 border-none focus:ring-0"
					/>
					<CommandList class="max-h-[calc(100vh-3.5rem)] pb-2">
						<Show when={query().trim() !== "" && appsStore.filteredApps.length === 0}>
							<CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
						</Show>

						{/* Apps Nativos do lowCast */}
						<CommandGroup heading="Apps">
							<CommandItem
								onSelect={() => setActiveView("clipboard")}
								class="h-12"
							>
								<div class="flex items-center gap-3 w-full">
									<div class="flex h-8 w-8 items-center justify-center rounded bg-muted/50">
										<Clipboard class="h-5 w-5 text-muted-foreground" />
									</div>
									<div class="flex flex-col">
										<span class="font-medium">Clipboard</span>
										<span class="text-xs text-muted-foreground">
											{clipboardStore.entries.length} itens no histórico
										</span>
									</div>
								</div>
								<CommandShortcut>↵</CommandShortcut>
							</CommandItem>
						</CommandGroup>

						<CommandSeparator />

						{/* Apps do Sistema (Windows/Linux) */}
						<CommandGroup
							heading={
								<div class="flex items-center justify-between w-full pr-2">
									<span>Aplicativos do Sistema</span>
									<Button
										variant="ghost"
										size="icon"
										onClick={(e) => {
											e.stopPropagation();
											refreshApplications();
										}}
										disabled={appsStore.isLoading}
										class="h-6 w-6 p-1"
										title="Atualizar lista de aplicativos"
									>
										<RefreshCw class={`h-3.5 w-3.5 ${appsStore.isLoading ? "animate-spin" : ""}`} />
									</Button>
								</div>
							}
						>
							<Show
								when={appsStore.filteredApps.length > 0}
								fallback={
									<div class="px-2 py-4 text-center text-sm text-muted-foreground">
										Carregando aplicativos...
									</div>
								}
							>
								<For each={appsStore.filteredApps}>
									{(app) => (
										<CommandItem
											onSelect={() => handleLaunchApp(app)}
											class="h-12"
										>
											<div class="flex items-center gap-3 w-full">
												<div class="flex h-8 w-8 items-center justify-center rounded bg-muted/50">
													<Show
														when={app.iconDataUrl}
														fallback={<AppWindow class="h-5 w-5 text-muted-foreground" />}
													>
														<img
															src={app.iconDataUrl ?? undefined}
															alt={app.name}
															class="h-6 w-6 object-contain"
															onError={(e) => {
																(e.currentTarget as HTMLImageElement).style.display =
																	"none";
																(
																	e.currentTarget.nextElementSibling as HTMLElement
																)?.classList.remove("hidden");
															}}
														/>
														<AppWindow class="h-5 w-5 text-muted-foreground hidden" />
													</Show>
												</div>
												<div class="flex flex-col">
													<span class="font-medium">{app.name}</span>
													<Show when={app.description}>
														<span class="text-xs text-muted-foreground line-clamp-1">
															{app.description}
														</span>
													</Show>
												</div>
											</div>
											<CommandShortcut>↵</CommandShortcut>
										</CommandItem>
									)}
								</For>
							</Show>
						</CommandGroup>
					</CommandList>
				</Command>
			</Show>

			{/* View do Clipboard (como aba, não modal) */}
			<Show when={activeView() === "clipboard"}>
				<div class="flex flex-col h-full">
					{/* Header do Clipboard */}
					<div class="flex items-center gap-3 h-14 px-4 border-b border-border/50">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setActiveView("apps")}
							class="h-8 w-8"
						>
							<ArrowLeft class="h-4 w-4" />
						</Button>
						<div class="flex items-center gap-2">
							<Clipboard class="h-5 w-5 text-muted-foreground" />
							<span class="font-medium text-lg">Histórico do Clipboard</span>
						</div>
						<span class="text-sm text-muted-foreground ml-auto">{clipboardStore.entries.length} itens</span>
						<Show when={clipboardStore.entries.length > 0}>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => clearHistory()}
								class="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
							>
								<Trash2 class="h-4 w-4 mr-1" />
								Limpar
							</Button>
						</Show>
					</div>

					{/* Lista de itens */}
					<ScrollArea class="flex-1">
						<div class="p-2 space-y-1">
							<Show
								when={clipboardStore.entries.length > 0}
								fallback={
									<div class="text-center py-12 text-muted-foreground">
										<Clipboard class="h-12 w-12 mx-auto mb-4 opacity-50" />
										<p class="font-medium">Nenhum item no histórico</p>
										<p class="text-sm">Copie algo para começar</p>
									</div>
								}
							>
								<For each={clipboardStore.entries}>
									{(entry) => (
										// biome-ignore lint/a11y/useSemanticElements: <fodase>
										<div
											role="button"
											tabIndex={0}
											onClick={() => handleCopyClipboard(entry)}
											onKeyDown={(e) => e.key === "Enter" && handleCopyClipboard(entry)}
											class="flex items-start gap-3 p-3 rounded-lg w-full text-left hover:bg-muted/50 transition-colors group cursor-pointer"
										>
											{/* Preview de imagem ou ícone */}
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
															alt="Imagem do clipboard"
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

											{/* Conteúdo */}
											<div class="flex-1 min-w-0">
												<Show
													when={entry.content_type === "text"}
													fallback={
														<div class="flex items-center gap-1">
															<ImageIcon class="h-4 w-4 text-muted-foreground" />
															<span class="font-medium text-sm">Imagem</span>
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

											{/* Botões de ação */}
											<div class="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
												{/* Botão excluir */}
												<Button
													variant="ghost"
													size="icon"
													onClick={(e) => {
														e.stopPropagation();
														deleteEntry(entry.id);
													}}
													class="h-8 w-8 hover:bg-destructive/10"
													title="Excluir"
												>
													<Trash2 class="h-4 w-4 text-muted-foreground hover:text-destructive" />
												</Button>
												{/* Botão copiar com feedback */}
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
			</Show>

			{/* Modal de imagem expandida */}
			<Show when={expandedImage()}>
				<div
					role="dialog"
					tabIndex={-1}
					class="fixed inset-0 z-50 flex items-center justify-center "
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
						alt="Imagem expandida"
						class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg  pointer-events-none"
					/>
				</div>
			</Show>
		</div>
	);
}
