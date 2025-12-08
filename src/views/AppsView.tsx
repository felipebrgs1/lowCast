import { getCurrentWindow } from "@tauri-apps/api/window";
import { Link } from "@tanstack/solid-router";
import { Activity, AppWindow, Clipboard, Monitor, RefreshCw, Scissors } from "lucide-solid";
import { createEffect, createSignal, For, Show } from "solid-js";
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
} from "@/components";
import { isTauri } from "@/lib/utils";
import { type Application, appsStore, launchApp, refreshApplications, searchApps } from "@/stores/appsStore";
import { clipboardStore } from "@/stores/clipboardStore";
import {
	copyLastScreenshotToClipboard,
	takeFullscreenScreenshot,
	takeRegionScreenshot,
} from "@/stores/screenshotStore";

interface AppsViewProps {
	onViewClipboard: () => void;
}

export function AppsView(props: AppsViewProps) {
	const [query, setQuery] = createSignal("");

	// Reactive search
	createEffect(() => {
		searchApps(query());
	});

	const handleLaunchApp = async (app: Application) => {
		await launchApp(app);
		if (isTauri()) {
			await getCurrentWindow().hide();
		}
	};

	// Fullscreen screenshot: capture and copy to clipboard
	const handleScreenshotFullscreen = async () => {
		if (isTauri()) {
			await getCurrentWindow().hide();
			await new Promise((r) => setTimeout(r, 100));
			const result = await takeFullscreenScreenshot();
			if (result) {
				await copyLastScreenshotToClipboard();
			}
		}
	};

	// Region screenshot: use slurp/native and copy to clipboard
	const handleScreenshotRegion = async () => {
		if (isTauri()) {
			await getCurrentWindow().hide();
			await new Promise((r) => setTimeout(r, 100));
			const result = await takeRegionScreenshot();
			if (result) {
				await copyLastScreenshotToClipboard();
			}
		}
	};

	return (
		<Command
			shouldFilter={false}
			class="rounded-none border-0 bg-transparent"
		>
			<CommandInput
				placeholder="Search apps..."
				value={query()}
				onValueChange={setQuery}
				class="text-lg h-14 border-none focus:ring-0"
			/>
			<CommandList class="max-h-[calc(100vh-3.5rem)] pb-2">
				<Show when={query().trim() !== "" && appsStore.filteredApps.length === 0}>
					<CommandEmpty>No results found.</CommandEmpty>
				</Show>

				{/* lowCast Native Apps */}
				<CommandGroup heading="Apps">
					<CommandItem
						onSelect={() => props.onViewClipboard()}
						class="h-12"
					>
						<div class="flex items-center gap-3 w-full">
							<div class="flex h-8 w-8 items-center justify-center rounded bg-muted/50">
								<Clipboard class="h-5 w-5 text-muted-foreground" />
							</div>
							<div class="flex flex-col">
								<span class="font-medium">Clipboard</span>
								<span class="text-xs text-muted-foreground">
									{clipboardStore.entries.length} items in history
								</span>
							</div>
						</div>
						<CommandShortcut>↵</CommandShortcut>
					</CommandItem>
					<Link to="/devmode">
						<CommandItem class="h-12">
							<div class="flex items-center gap-3 w-full">
								<div class="flex h-8 w-8 items-center justify-center rounded bg-purple-500/10">
									<Activity class="h-5 w-5 text-purple-500" />
								</div>
								<div class="flex flex-col">
									<span class="font-medium">DevMode</span>
									<span class="text-xs text-muted-foreground">System monitor & performance</span>
								</div>
							</div>
							<CommandShortcut>↵</CommandShortcut>
						</CommandItem>
					</Link>
					<CommandItem
						onSelect={handleScreenshotFullscreen}
						class="h-12"
					>
						<div class="flex items-center gap-3 w-full">
							<div class="flex h-8 w-8 items-center justify-center rounded bg-blue-500/10">
								<Monitor class="h-5 w-5 text-blue-500" />
							</div>
							<div class="flex flex-col">
								<span class="font-medium">Screenshot Full</span>
								<span class="text-xs text-muted-foreground">Capture screen and copy to clipboard</span>
							</div>
						</div>
						<CommandShortcut>↵</CommandShortcut>
					</CommandItem>
					<CommandItem
						onSelect={handleScreenshotRegion}
						class="h-12"
					>
						<div class="flex items-center gap-3 w-full">
							<div class="flex h-8 w-8 items-center justify-center rounded bg-green-500/10">
								<Scissors class="h-5 w-5 text-green-500" />
							</div>
							<div class="flex flex-col">
								<span class="font-medium">Screenshot Region</span>
								<span class="text-xs text-muted-foreground">Select area and copy to clipboard</span>
							</div>
						</div>
						<CommandShortcut>↵</CommandShortcut>
					</CommandItem>
				</CommandGroup>

				<CommandSeparator />

				{/* System Apps */}
				<CommandGroup
					heading={
						<div class="flex items-center justify-between w-full pr-2">
							<span>System Applications</span>
							<Button
								variant="ghost"
								size="icon"
								onClick={(e) => {
									e.stopPropagation();
									refreshApplications();
								}}
								disabled={appsStore.isLoading}
								class="h-6 w-6 p-1"
								title="Refresh applications"
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
								Loading applications...
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
														(e.currentTarget as HTMLImageElement).style.display = "none";
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
	);
}
