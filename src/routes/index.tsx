import { createFileRoute } from "@tanstack/react-router";
import { AppWindow, Clipboard, FileText, Image as ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ClipboardEntry } from "@/lib/database";
import { type Application, useAppsStore } from "@/stores/appsStore";
import { useClipboardStore } from "@/stores/clipboardStore";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const [query, setQuery] = useState("");
	const [clipboardDialogOpen, setClipboardDialogOpen] = useState(false);

	const {
		entries: clipboardEntries,
		loadHistory,
		startListening,
		stopListening,
		copyToClipboard,
	} = useClipboardStore();

	const { filteredApps, loadApplications, search: searchApps, launchApp } = useAppsStore();

	// Ref para controlar inicialização única
	const hasInitialized = useRef(false);

	// Inicialização - executar apenas uma vez
	useEffect(() => {
		if (hasInitialized.current) return;
		hasInitialized.current = true;

		loadHistory();
		loadApplications();
		startListening();

		return () => {
			stopListening();
		};
	}, [loadHistory, loadApplications, startListening, stopListening]);

	// Busca reativa
	const searchAppsRef = useRef(searchApps);
	searchAppsRef.current = searchApps;

	useEffect(() => {
		searchAppsRef.current(query);
	}, [query]);

	const handleLaunchApp = async (app: Application) => {
		await launchApp(app);
	};

	const handleCopyClipboard = async (entry: ClipboardEntry) => {
		await copyToClipboard(entry);
		setClipboardDialogOpen(false);
	};

	return (
		<div className="h-full w-full bg-background/85 backdrop-blur-xl">
			<Command
				shouldFilter={false}
				className="rounded-none border-0 bg-transparent"
			>
				<CommandInput
					placeholder="Buscar aplicativos..."
					value={query}
					onValueChange={setQuery}
					className="text-lg h-14 border-none focus:ring-0"
				/>
				<CommandList className="max-h-[calc(100vh-3.5rem)] pb-2">
					<CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

					{/* Apps Nativos do lowCast */}
					<CommandGroup heading="Apps">
						<CommandItem
							onSelect={() => setClipboardDialogOpen(true)}
							className="h-12"
						>
							<div className="flex items-center gap-3 w-full">
								<div className="flex h-8 w-8 items-center justify-center rounded bg-muted/50">
									<Clipboard className="h-5 w-5 text-muted-foreground" />
								</div>
								<div className="flex flex-col">
									<span className="font-medium">Clipboard</span>
									<span className="text-xs text-muted-foreground">
										{clipboardEntries.length} itens no histórico
									</span>
								</div>
							</div>
							<CommandShortcut>↵</CommandShortcut>
						</CommandItem>
					</CommandGroup>

					<CommandSeparator />

					{/* Apps do Sistema (Windows/Linux) */}
					<CommandGroup heading="Aplicativos do Sistema">
						{filteredApps.length === 0 ? (
							<div className="px-2 py-4 text-center text-sm text-muted-foreground">
								Carregando aplicativos...
							</div>
						) : (
							filteredApps.map((app) => (
								<CommandItem
									key={app.desktop_file}
									onSelect={() => handleLaunchApp(app)}
									className="h-12"
								>
									<div className="flex items-center gap-3 w-full">
										<div className="flex h-8 w-8 items-center justify-center rounded bg-muted/50">
											{app.iconDataUrl ? (
												<img
													src={app.iconDataUrl}
													alt={app.name}
													className="h-6 w-6 object-contain"
													onError={(e) => {
														e.currentTarget.style.display = "none";
														e.currentTarget.nextElementSibling?.classList.remove("hidden");
													}}
												/>
											) : null}
											<AppWindow
												className={`h-5 w-5 text-muted-foreground ${app.iconDataUrl ? "hidden" : ""}`}
											/>
										</div>
										<div className="flex flex-col">
											<span className="font-medium">{app.name}</span>
											{app.description && (
												<span className="text-xs text-muted-foreground line-clamp-1">
													{app.description}
												</span>
											)}
										</div>
									</div>
									<CommandShortcut>↵</CommandShortcut>
								</CommandItem>
							))
						)}
					</CommandGroup>
				</CommandList>
			</Command>

			{/* Dialog do Histórico do Clipboard */}
			<Dialog
				open={clipboardDialogOpen}
				onOpenChange={setClipboardDialogOpen}
			>
				<DialogContent className="max-w-2xl max-h-[80vh]">
					<DialogHeader>
						<DialogTitle>Histórico do Clipboard</DialogTitle>
					</DialogHeader>
					<ScrollArea className="h-[60vh] pr-4">
						<div className="space-y-2">
							{clipboardEntries.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<p>Nenhum item no histórico</p>
									<p className="text-sm">Copie algo para começar</p>
								</div>
							) : (
								clipboardEntries.map((entry) => (
									<button
										type="button"
										key={entry.id}
										onClick={() => handleCopyClipboard(entry)}
										className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors w-full text-left"
									>
										<div className="flex h-10 w-10 items-center justify-center rounded bg-muted/50">
											{entry.content_type === "text" ? (
												<FileText className="h-5 w-5 text-muted-foreground" />
											) : (
												<ImageIcon className="h-5 w-5 text-muted-foreground" />
											)}
										</div>
										<div className="flex flex-col flex-1 min-w-0">
											<span className="font-medium truncate">
												{entry.content_type === "text"
													? (entry.preview || entry.content).replace(/\n/g, " ")
													: "Imagem"}
											</span>
											<span className="text-xs text-muted-foreground">
												{new Date(entry.created_at).toLocaleString()}
											</span>
										</div>
									</button>
								))
							)}
						</div>
					</ScrollArea>
				</DialogContent>
			</Dialog>
		</div>
	);
}
