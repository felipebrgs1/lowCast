import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { AppWindow, Clipboard, Search } from "lucide-react";
import { useCliNavigation } from "@/hooks/useCliNavigation";
import { useGlobalShortcut } from "@/hooks/useGlobalShortcut";

function RootLayout() {
	// Registrar atalho global Alt+Space
	useGlobalShortcut("Alt+Space");

	// Escutar navegação via CLI
	useCliNavigation();

	return (
		<div className="flex flex-col h-screen bg-background/85 backdrop-blur-xl text-foreground">
			<nav className="flex items-center gap-1 p-2 border-b bg-card/50">
				<Link
					to="/"
					className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-accent [&.active]:bg-accent [&.active]:text-accent-foreground"
				>
					<Search className="w-4 h-4" />
					Busca
				</Link>
				<Link
					to="/clipboard"
					className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-accent [&.active]:bg-accent [&.active]:text-accent-foreground"
				>
					<Clipboard className="w-4 h-4" />
					Clipboard
				</Link>
				<Link
					to="/apps"
					className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-accent [&.active]:bg-accent [&.active]:text-accent-foreground"
				>
					<AppWindow className="w-4 h-4" />
					Apps
				</Link>
			</nav>
			<main className="flex-1 overflow-auto">
				<Outlet />
			</main>
		</div>
	);
}

export const Route = createRootRoute({ component: RootLayout });
