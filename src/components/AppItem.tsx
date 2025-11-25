import { AppWindow } from "lucide-react";
import { Card } from "@/components/ui/card";
import { type Application, useAppsStore } from "@/stores/appsStore";

interface AppItemProps {
	app: Application;
	onLaunch?: () => void;
}

export function AppItem({ app, onLaunch }: AppItemProps) {
	const { launchApp } = useAppsStore();

	const handleLaunch = async () => {
		await launchApp(app);
		onLaunch?.();
	};

	return (
		<Card
			className="p-3 hover:bg-accent/50 transition-colors cursor-pointer"
			onClick={handleLaunch}
		>
			<div className="flex items-center gap-3">
				<div className="shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
					{app.iconDataUrl ? (
						<img
							src={app.iconDataUrl}
							alt={app.name}
							className="w-8 h-8 object-contain"
							onError={(e) => {
								e.currentTarget.style.display = "none";
								e.currentTarget.nextElementSibling?.classList.remove("hidden");
							}}
						/>
					) : null}
					<AppWindow className={`w-6 h-6 text-muted-foreground ${app.iconDataUrl ? "hidden" : ""}`} />
				</div>

				<div className="flex-1 min-w-0">
					<p className="font-medium text-sm truncate">{app.name}</p>
					{app.description && <p className="text-xs text-muted-foreground truncate">{app.description}</p>}
				</div>
			</div>
		</Card>
	);
}
