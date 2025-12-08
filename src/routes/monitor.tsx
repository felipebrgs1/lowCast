import { createFileRoute } from "@tanstack/solid-router";
import AppMonitor from "@/components/AppMonitor";

export const Route = createFileRoute("/monitor")({
	component: MonitorPage,
});

function MonitorPage() {
	return (
		<div class="h-full w-full overflow-auto bg-gray-950">
			<AppMonitor />
		</div>
	);
}
