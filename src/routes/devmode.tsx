import { createFileRoute } from "@tanstack/solid-router";
import { invoke } from "@tauri-apps/api/core";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { For, Show } from "solid-js/web";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ScrollArea } from "@/components/scroll-area";

export const Route = createFileRoute("/devmode")({
	component: DevMode,
});

interface SystemMetrics {
	cpu_usage: number;
	cpu_count: number;
	memory_total: number;
	memory_used: number;
	memory_available: number;
	swap_total: number;
	swap_used: number;
	process_count: number;
	uptime: number;
}

interface ProcessInfo {
	pid: number;
	name: string;
	cpu_usage: number;
	memory: number;
}

function DevMode() {
	const [metrics, setMetrics] = createSignal<SystemMetrics | null>(null);
	const [cpuPerCore, setCpuPerCore] = createSignal<number[]>([]);
	const [topProcesses, setTopProcesses] = createSignal<ProcessInfo[]>([]);
	const [isRunning, setIsRunning] = createSignal(true);

	// Fetch system metrics
	const fetchMetrics = async () => {
		try {
			const metricsData = await invoke<SystemMetrics>("get_system_metrics");
			setMetrics(metricsData);

			const cpuData = await invoke<number[]>("get_cpu_per_core");
			setCpuPerCore(cpuData);

			const processesData = await invoke<ProcessInfo[]>("get_top_processes", { limit: 10 });
			setTopProcesses(processesData);
		} catch (error) {
			console.error("Failed to fetch metrics:", error);
		}
	};

	// Auto-refresh every second
	let intervalId: number;
	createEffect(() => {
		if (isRunning()) {
			fetchMetrics();
			intervalId = window.setInterval(fetchMetrics, 1000);
		}
	});

	onCleanup(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
	});

	const formatBytes = (bytes: number) => {
		const gb = bytes / 1024 / 1024 / 1024;
		return `${gb.toFixed(2)} GB`;
	};

	const formatUptime = (seconds: number) => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		return `${hours}h ${minutes}m`;
	};

	return (
		<div class="h-full w-full bg-background p-6">
			<div class="mb-6 flex items-center justify-between">
				<h1 class="text-3xl font-bold">DevMode - System Monitor</h1>
				<div class="flex gap-2">
					<Button
						onClick={() => setIsRunning(!isRunning())}
						variant={isRunning() ? "default" : "outline"}
					>
						{isRunning() ? "Pause" : "Resume"}
					</Button>
					<Button onClick={() => window.history.back()} variant="outline">
						Back
					</Button>
				</div>
			</div>

			<Show when={metrics()}>
				{(m) => (
					<div class="grid gap-4">
						{/* Overall Stats */}
						<div class="grid grid-cols-4 gap-4">
							<Card class="p-4">
								<div class="text-sm text-muted-foreground">CPU Usage</div>
								<div class="text-2xl font-bold">{m().cpu_usage.toFixed(1)}%</div>
								<div class="text-xs text-muted-foreground">{m().cpu_count} cores</div>
							</Card>

							<Card class="p-4">
								<div class="text-sm text-muted-foreground">Memory</div>
								<div class="text-2xl font-bold">
									{((m().memory_used / m().memory_total) * 100).toFixed(1)}%
								</div>
								<div class="text-xs text-muted-foreground">
									{formatBytes(m().memory_used)} / {formatBytes(m().memory_total)}
								</div>
							</Card>

							<Card class="p-4">
								<div class="text-sm text-muted-foreground">Swap</div>
								<div class="text-2xl font-bold">
									{m().swap_total > 0
										? ((m().swap_used / m().swap_total) * 100).toFixed(1)
										: "0"}
									%
								</div>
								<div class="text-xs text-muted-foreground">
									{formatBytes(m().swap_used)} / {formatBytes(m().swap_total)}
								</div>
							</Card>

							<Card class="p-4">
								<div class="text-sm text-muted-foreground">Uptime</div>
								<div class="text-2xl font-bold">{formatUptime(m().uptime)}</div>
								<div class="text-xs text-muted-foreground">{m().process_count} processes</div>
							</Card>
						</div>

						{/* CPU Per Core */}
						<Card class="p-4">
							<h2 class="mb-4 text-xl font-semibold">CPU Per Core</h2>
							<div class="grid grid-cols-4 gap-2 md:grid-cols-8">
								<For each={cpuPerCore()}>
									{(usage, index) => (
										<div class="flex flex-col items-center">
											<div class="text-xs text-muted-foreground">Core {index()}</div>
											<div
												class="mt-1 h-20 w-full rounded bg-muted"
												style={{ position: "relative" }}
											>
												<div
													class="absolute bottom-0 w-full rounded bg-primary transition-all"
													style={{
														height: `${usage}%`,
													}}
												/>
											</div>
											<div class="mt-1 text-xs font-semibold">{usage.toFixed(0)}%</div>
										</div>
									)}
								</For>
							</div>
						</Card>

						{/* Top Processes */}
						<Card class="p-4">
							<h2 class="mb-4 text-xl font-semibold">Top Processes (CPU)</h2>
							<ScrollArea class="h-80">
								<div class="space-y-2">
									<For each={topProcesses()}>
										{(process) => (
											<div class="flex items-center justify-between rounded-lg bg-muted p-3">
												<div class="flex-1">
													<div class="font-medium">{process.name}</div>
													<div class="text-xs text-muted-foreground">PID: {process.pid}</div>
												</div>
												<div class="flex gap-4 text-right">
													<div>
														<div class="text-sm font-semibold">
															{process.cpu_usage.toFixed(1)}%
														</div>
														<div class="text-xs text-muted-foreground">CPU</div>
													</div>
													<div>
														<div class="text-sm font-semibold">
															{formatBytes(process.memory)}
														</div>
														<div class="text-xs text-muted-foreground">RAM</div>
													</div>
												</div>
											</div>
										)}
									</For>
								</div>
							</ScrollArea>
						</Card>
					</div>
				)}
			</Show>

			<Show when={!metrics()}>
				<div class="flex h-full items-center justify-center">
					<p class="text-muted-foreground">Loading metrics...</p>
				</div>
			</Show>
		</div>
	);
}
