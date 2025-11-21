import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { AppItem } from "@/components/AppItem";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppsStore } from "@/stores/appsStore";

export const Route = createFileRoute("/apps")({
	component: AppsPage,
});

function AppsPage() {
	const { filteredApps, isLoading, searchQuery, loadApplications, search } = useAppsStore();

	useEffect(() => {
		loadApplications();
	}, [loadApplications]);

	return (
		<div className="flex flex-col h-full">
			<div className="p-4 border-b space-y-3">
				<h1 className="text-lg font-semibold">Aplicativos</h1>

				<Input
					placeholder="Buscar aplicativos..."
					value={searchQuery}
					onChange={(e) => search(e.target.value)}
					className="w-full"
					autoFocus
				/>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-4 space-y-2">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
						</div>
					) : filteredApps.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<p>Nenhum aplicativo encontrado</p>
						</div>
					) : (
						filteredApps.map((app) => (
							<AppItem
								key={app.desktop_file}
								app={app}
							/>
						))
					)}
				</div>
			</ScrollArea>

			<div className="p-2 border-t text-center text-xs text-muted-foreground">
				{filteredApps.length} aplicativos
			</div>
		</div>
	);
}
