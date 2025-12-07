import { createRootRoute, Outlet } from "@tanstack/solid-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { onMount } from "solid-js";
import { useCliNavigation } from "@/hooks/useCliNavigation";
import { useGlobalShortcut } from "@/hooks/useGlobalShortcut";
import { isTauri } from "@/lib/utils";

export const Route = createRootRoute({
	component: RootComponent,
	errorComponent: (props) => (
		<div class="flex flex-col items-center justify-center h-screen bg-background text-foreground p-8">
			<h1 class="text-2xl font-bold mb-4 text-red-500">Algo deu errado</h1>
			<div class="bg-muted p-4 rounded-lg overflow-auto max-w-2xl w-full max-h-[50vh] mb-4">
				<pre class="font-mono text-sm whitespace-pre-wrap wrap-break-word">
					{props.error instanceof Error ? props.error.stack : JSON.stringify(props.error)}
				</pre>
			</div>
			<button
				type="button"
				class="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
				onClick={() => window.location.reload()}
			>
				Recarregar
			</button>
		</div>
	),
});

function RootComponent() {
	// Registrar atalho global Alt+Space
	useGlobalShortcut("Alt+Space");

	// Escutar navegação via CLI
	useCliNavigation();

	// Fechar ao perder foco (exceto em dev)
	onMount(() => {
		if (isTauri()) {
			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.key === "Escape") {
					getCurrentWindow().hide();
				}
			};
			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}
	});

	return (
		// Janela simples sem overlay - o card É a janela
		<div class="h-screen w-screen bg-background text-foreground rounded-2xl overflow-hidden">
			<main class="h-full overflow-auto">
				<Outlet />
			</main>
		</div>
	);
}
