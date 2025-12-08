import { Link } from "@tanstack/solid-router";
import { open } from "@tauri-apps/plugin-shell";
import { ArrowLeft } from "lucide-solid";
import { createEffect, For, onCleanup, Show } from "solid-js";
import {
	clearLogs,
	clearMetrics,
	isMonitoring,
	logFilePath,
	logger,
	logs,
	metricsHistory,
	metricsStats,
	refreshLogs,
	startMonitoring,
	stopMonitoring,
} from "@/stores/appMetricsStore";

export default function AppMonitor() {
	// Auto-start monitoring when component mounts
	createEffect(() => {
		startMonitoring(1000); // Update every second
	});

	onCleanup(() => {
		stopMonitoring();
	});

	const getLogLevelColor = (level: string) => {
		switch (level) {
			case "Debug":
				return "text-gray-400";
			case "Info":
				return "text-blue-400";
			case "Warning":
				return "text-yellow-400";
			case "Error":
				return "text-red-400";
			case "Critical":
				return "text-red-600 font-bold";
			default:
				return "text-gray-300";
		}
	};

	const getLogLevelIcon = (level: string) => {
		switch (level) {
			case "Debug":
				return "🐛";
			case "Info":
				return "ℹ️";
			case "Warning":
				return "⚠️";
			case "Error":
				return "❌";
			case "Critical":
				return "🔥";
			default:
				return "•";
		}
	};

	const formatTimestamp = (timestamp: string) => {
		try {
			const date = new Date(timestamp);
			return date.toLocaleTimeString("pt-BR", {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				fractionalSecondDigits: 3,
			});
		} catch {
			return timestamp;
		}
	};

	const handleOpenLogFile = async () => {
		const path = logFilePath();
		if (path) {
			try {
				await open(path);
			} catch (error) {
				logger.error("Failed to open log file", String(error));
			}
		}
	};

	const handleClearLogs = async () => {
		await clearLogs();
		await refreshLogs();
		logger.info("Logs cleared");
	};

	const handleClearMetrics = async () => {
		await clearMetrics();
		logger.info("Metrics cleared");
	};

	return (
		<div class="max-w-7xl mx-auto p-6 space-y-6">
			{/* Header */}
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<Link
						to="/"
						class="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors group"
						title="Voltar"
					>
						<ArrowLeft class="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
					</Link>
					<div>
						<h1 class="text-3xl font-bold text-white">App Monitor</h1>
						<p class="text-gray-400 mt-1">Monitoramento de performance e logs do processo</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<Show when={isMonitoring()}>
						<div class="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
							<div class="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
							<span class="text-green-400 text-sm font-medium">Monitoring</span>
						</div>
					</Show>
				</div>
			</div>

			{/* Stats Cards */}
			<Show when={metricsStats()}>
				{(stats) => (
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						{/* Current CPU */}
						<div class="bg-linear-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4">
							<div class="flex items-center justify-between mb-2">
								<span class="text-gray-400 text-sm font-medium">CPU Atual</span>
								<span class="text-2xl">⚡</span>
							</div>
							<div class="text-3xl font-bold text-white">{stats().current.cpu_usage.toFixed(2)}%</div>
							<div class="mt-2 text-xs text-gray-500">
								Avg: {stats().avg_cpu.toFixed(2)}% | Max: {stats().max_cpu.toFixed(2)}%
							</div>
						</div>

						{/* Current Memory */}
						<div class="bg-linear-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-4">
							<div class="flex items-center justify-between mb-2">
								<span class="text-gray-400 text-sm font-medium">RAM Atual</span>
								<span class="text-2xl">💾</span>
							</div>
							<div class="text-3xl font-bold text-white">{stats().current.memory_mb.toFixed(0)} MB</div>
							<div class="mt-2 text-xs text-gray-500">
								Avg: {stats().avg_memory_mb.toFixed(0)} MB | Max: {stats().max_memory_mb.toFixed(0)} MB
							</div>
						</div>

						{/* CPU Spikes */}
						<div class="bg-linear-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-xl p-4">
							<div class="flex items-center justify-between mb-2">
								<span class="text-gray-400 text-sm font-medium">CPU Spikes</span>
								<span class="text-2xl">📈</span>
							</div>
							<div class="text-3xl font-bold text-white">{stats().spike_count}</div>
							<div class="mt-2 text-xs text-gray-500">Threshold: {"\u003e"}50% CPU</div>
						</div>

						{/* Samples */}
						<div class="bg-linear-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-4">
							<div class="flex items-center justify-between mb-2">
								<span class="text-gray-400 text-sm font-medium">Samples</span>
								<span class="text-2xl">📊</span>
							</div>
							<div class="text-3xl font-bold text-white">{stats().samples_count}</div>
							<div class="mt-2 text-xs text-gray-500">Último 1000 max</div>
						</div>
					</div>
				)}
			</Show>

			{/* Metrics Chart */}
			<div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-semibold text-white">📈 Histórico de Métricas</h2>
					<button
						type="button"
						onClick={handleClearMetrics}
						class="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium transition-colors"
					>
						Limpar Métricas
					</button>
				</div>

				<Show
					when={metricsHistory().length > 0}
					fallback={<div class="text-center py-12 text-gray-500">Nenhuma métrica coletada ainda...</div>}
				>
					<div class="space-y-4">
						{/* CPU Chart */}
						<div>
							<div class="text-sm text-gray-400 mb-2">CPU Usage (%)</div>
							<div class="h-32 flex items-end gap-0.5">
								<For each={metricsHistory().slice(-50)}>
									{(sample) => (
										<div
											class="flex-1 min-w-0.5 rounded-t transition-all"
											classList={{
												"bg-blue-500": !sample.is_spike,
												"bg-red-500": sample.is_spike,
											}}
											style={{
												height: `${Math.min((sample.cpu_usage / 100) * 100, 100)}%`,
											}}
											title={`${formatTimestamp(sample.timestamp)}: ${sample.cpu_usage.toFixed(2)}%`}
										/>
									)}
								</For>
							</div>
						</div>

						{/* Memory Chart */}
						<div>
							<div class="text-sm text-gray-400 mb-2">Memory (MB)</div>
							<div class="h-32 flex items-end gap-0.5">
								<For each={metricsHistory().slice(-50)}>
									{(sample) => {
										const maxMemory = Math.max(
											...metricsHistory().map((s: { memory_mb: number }) => s.memory_mb),
										);
										return (
											<div
												class="flex-1 min-w-0.5 bg-purple-500 rounded-t transition-all"
												style={{
													height: `${Math.min((sample.memory_mb / maxMemory) * 100, 100)}%`,
												}}
												title={`${formatTimestamp(sample.timestamp)}: ${sample.memory_mb.toFixed(2)} MB`}
											/>
										);
									}}
								</For>
							</div>
						</div>
					</div>
				</Show>
			</div>

			{/* Logs */}
			<div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-semibold text-white">📝 Application Logs</h2>
					<div class="flex items-center gap-2">
						<Show when={logFilePath()}>
							<button
								type="button"
								onClick={handleOpenLogFile}
								class="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-sm font-medium transition-colors"
							>
								📄 Abrir Arquivo
							</button>
						</Show>
						<button
							type="button"
							onClick={async () => await refreshLogs()}
							class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm font-medium transition-colors"
						>
							🔄 Atualizar
						</button>
						<button
							type="button"
							onClick={handleClearLogs}
							class="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium transition-colors"
						>
							🗑️ Limpar
						</button>
					</div>
				</div>

				<Show
					when={logs().length > 0}
					fallback={<div class="text-center py-12 text-gray-500">Nenhum log registrado ainda...</div>}
				>
					<div class="bg-black/30 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm space-y-1">
						<For each={logs()}>
							{(log) => (
								<div class="flex items-start gap-3 py-1 hover:bg-white/5 px-2 rounded transition-colors">
									<span class="text-xs text-gray-500 min-w-[100px]">
										{formatTimestamp(log.timestamp)}
									</span>
									<span class="text-lg leading-none">{getLogLevelIcon(log.level)}</span>
									<span class={`font-medium min-w-20 ${getLogLevelColor(log.level)}`}>
										{log.level}
									</span>
									<span class="text-gray-300 flex-1">{log.message}</span>
									<Show when={log.context}>
										<span class="text-gray-500 text-xs">{log.context}</span>
									</Show>
								</div>
							)}
						</For>
					</div>
				</Show>

				<Show when={logFilePath()}>
					<div class="mt-4 text-xs text-gray-500">
						📁 Log file: <span class="text-gray-400">{logFilePath()}</span>
					</div>
				</Show>
			</div>

			{/* Test Buttons */}
			<div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
				<h2 class="text-xl font-semibold text-white mb-4">🧪 Test Logging</h2>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => logger.debug("Debug message test", "context info")}
						class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-medium transition-colors"
					>
						Test Debug
					</button>
					<button
						type="button"
						onClick={() => logger.info("Info message test")}
						class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-colors"
					>
						Test Info
					</button>
					<button
						type="button"
						onClick={() => logger.warning("Warning message test")}
						class="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-white font-medium transition-colors"
					>
						Test Warning
					</button>
					<button
						type="button"
						onClick={() => logger.error("Error message test")}
						class="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white font-medium transition-colors"
					>
						Test Error
					</button>
					<button
						type="button"
						onClick={() => logger.critical("Critical message test", "URGENT")}
						class="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-white font-bold transition-colors"
					>
						Test Critical
					</button>
				</div>
			</div>
		</div>
	);
}
