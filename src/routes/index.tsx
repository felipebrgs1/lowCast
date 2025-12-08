import { createFileRoute } from "@tanstack/solid-router";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { loadApplications } from "@/stores/appsStore";
import { loadHistory, startListening, stopListening } from "@/stores/clipboardStore";
import { loadCapabilities, setupCliScreenshotListener } from "@/stores/screenshotStore";
import { AppsView, ClipboardView } from "@/views";

export const Route = createFileRoute("/")({
	component: IndexPage,
});

type ActiveView = "apps" | "clipboard";

function IndexPage() {
	const [activeView, setActiveView] = createSignal<ActiveView>("apps");
	const [hasInitialized, setHasInitialized] = createSignal(false);

	// Initialize once
	createEffect(() => {
		if (hasInitialized()) return;
		setHasInitialized(true);

		loadHistory();
		loadApplications();
		startListening();
		loadCapabilities();
	});

	// Setup CLI screenshot listener
	const cleanupScreenshotListener = setupCliScreenshotListener();

	// Cleanup
	onCleanup(() => {
		stopListening();
		cleanupScreenshotListener();
	});

	return (
		<div class="h-full w-full">
			<Show when={activeView() === "apps"}>
				<AppsView onViewClipboard={() => setActiveView("clipboard")} />
			</Show>

			<Show when={activeView() === "clipboard"}>
				<ClipboardView onBack={() => setActiveView("apps")} />
			</Show>
		</div>
	);
}
