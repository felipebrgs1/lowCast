import { createFileRoute } from "@tanstack/solid-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppWindow, Clipboard, FileText, Image as ImageIcon, RefreshCw } from "lucide-solid";
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
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
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
import { clipboardStore, copyToClipboard, loadHistory, startListening, stopListening } from "@/stores/clipboardStore";

export const Route = createFileRoute("/")({
	component: IndexPage,
});

function IndexPage() {
	const [query, setQuery] = createSignal("");
	const [clipboardDialogOpen, setClipboardDialogOpen] = createSignal(false);
	const [hasInitialized, setHasInitialized] = createSignal(false);

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
		setClipboardDialogOpen(false);
	};

	return (
		<div class="h-full w-full bg-background/85 backdrop-blur-xl">
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
							onSelect={() => setClipboardDialogOpen(true)}
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
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										refreshApplications();
									}}
									disabled={appsStore.isLoading}
									class="p-1 rounded hover:bg-muted/50 transition-colors disabled:opacity-50"
									title="Atualizar lista de aplicativos"
								>
									<RefreshCw class={`h-3.5 w-3.5 ${appsStore.isLoading ? "animate-spin" : ""}`} />
								</button>
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

			{/* Dialog do Histórico do Clipboard */}
			<Dialog
				open={clipboardDialogOpen()}
				onOpenChange={setClipboardDialogOpen}
			>
				<DialogContent class="max-w-2xl max-h-[80vh]">
					<DialogHeader>
						<DialogTitle>Histórico do Clipboard</DialogTitle>
					</DialogHeader>
					<ScrollArea class="h-[60vh] pr-4">
						<div class="space-y-2">
							<Show
								when={clipboardStore.entries.length > 0}
								fallback={
									<div class="text-center py-8 text-muted-foreground">
										<p>Nenhum item no histórico</p>
										<p class="text-sm">Copie algo para começar</p>
									</div>
								}
							>
								<For each={clipboardStore.entries}>
									{(entry) => (
										<Button
											variant="ghost"
											onClick={() => handleCopyClipboard(entry)}
											class="flex items-center gap-3 p-3 h-auto rounded-lg w-full justify-start"
										>
											<div class="flex h-10 w-10 items-center justify-center rounded bg-muted/50">
												<Show
													when={entry.content_type === "text"}
													fallback={<ImageIcon class="h-5 w-5 text-muted-foreground" />}
												>
													<FileText class="h-5 w-5 text-muted-foreground" />
												</Show>
											</div>
											<div class="flex flex-col flex-1 min-w-0 text-left">
												<span class="font-medium truncate">
													{entry.content_type === "text"
														? (entry.preview || entry.content).replace(/\n/g, " ")
														: "Imagem"}
												</span>
												<span class="text-xs text-muted-foreground">
													{new Date(entry.created_at).toLocaleString()}
												</span>
											</div>
										</Button>
									)}
								</For>
							</Show>
						</div>
					</ScrollArea>
				</DialogContent>
			</Dialog>
		</div>
	);
}
