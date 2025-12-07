import { createRootRoute, Outlet } from "@tanstack/solid-router";
import { useCliNavigation } from "@/hooks/useCliNavigation";
import { useGlobalShortcut } from "@/hooks/useGlobalShortcut";

export const Route = createRootRoute({
	component: RootComponent,
	errorComponent: (props) => (
		<div class="flex flex-col items-center justify-center h-screen bg-background text-foreground p-8">
			<h1 class="text-2xl font-bold mb-4 text-red-500">Algo deu errado</h1>
			<div class="bg-muted p-4 rounded-lg overflow-auto max-w-2xl w-full max-h-[50vh] mb-4">
				<pre class="font-mono text-sm whitespace-pre-wrap break-words">
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

	return (
		<div class="flex flex-col h-screen bg-background/85 backdrop-blur-xl text-foreground">
			<main class="flex-1 overflow-auto">
				<Outlet />
			</main>
		</div>
	);
}
