import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useCliNavigation } from "@/hooks/useCliNavigation";
import { useGlobalShortcut } from "@/hooks/useGlobalShortcut";

function RootLayout() {
	// Registrar atalho global Alt+Space
	useGlobalShortcut("Alt+Space");

	// Escutar navegação via CLI
	useCliNavigation();

	return (
		<div className="flex flex-col h-screen bg-background/85 backdrop-blur-xl text-foreground">
			<main className="flex-1 overflow-auto">
				<Outlet />
			</main>
		</div>
	);
}

export const Route = createRootRoute({ component: RootLayout });
