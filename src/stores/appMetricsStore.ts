import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";

export type LogLevel = "Debug" | "Info" | "Warning" | "Error" | "Critical";

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	context?: string;
}

export interface AppMetricsSample {
	timestamp: string;
	cpu_usage: number;
	memory_bytes: number;
	memory_mb: number;
	is_spike: boolean;
}

export interface AppMetricsStats {
	current: AppMetricsSample;
	avg_cpu: number;
	max_cpu: number;
	min_cpu: number;
	avg_memory_mb: number;
	max_memory_mb: number;
	min_memory_mb: number;
	spike_count: number;
	samples_count: number;
}

// Signals for reactive state
export const [metricsStats, setMetricsStats] = createSignal<AppMetricsStats | null>(null);
export const [metricsHistory, setMetricsHistory] = createSignal<AppMetricsSample[]>([]);
export const [logs, setLogs] = createSignal<LogEntry[]>([]);
export const [logFilePath, setLogFilePath] = createSignal<string>("");
export const [isMonitoring, setIsMonitoring] = createSignal(false);

let monitoringInterval: number | null = null;

// Commands
export async function collectMetrics(): Promise<AppMetricsSample> {
	return invoke<AppMetricsSample>("collect_app_metrics");
}

export async function getStats(): Promise<AppMetricsStats> {
	return invoke<AppMetricsStats>("get_app_stats");
}

export async function getMetricsHistory(limit?: number): Promise<AppMetricsSample[]> {
	return invoke<AppMetricsSample[]>("get_app_metrics_history", { limit });
}

export async function addLog(level: LogLevel, message: string, context?: string): Promise<void> {
	return invoke("app_log", { level, message, context });
}

export async function getLogs(limit?: number): Promise<LogEntry[]> {
	return invoke<LogEntry[]>("get_app_logs", { limit });
}

export async function clearLogs(): Promise<void> {
	return invoke("clear_app_logs");
}

export async function clearMetrics(): Promise<void> {
	return invoke("clear_app_metrics");
}

export async function getLogFilePath(): Promise<string> {
	return invoke<string>("get_log_file_path");
}

// Helper to start monitoring
export async function startMonitoring(intervalMs = 1000) {
	if (isMonitoring()) {
		console.warn("Monitoring already started");
		return;
	}

	setIsMonitoring(true);

	// Get initial data
	await refreshMetrics();
	await refreshLogs();

	// Get log file path
	try {
		const path = await getLogFilePath();
		setLogFilePath(path);
	} catch (error) {
		console.error("Failed to get log file path:", error);
	}

	// Start interval
	monitoringInterval = window.setInterval(async () => {
		await refreshMetrics();
	}, intervalMs);
}

export function stopMonitoring() {
	if (monitoringInterval !== null) {
		clearInterval(monitoringInterval);
		monitoringInterval = null;
	}
	setIsMonitoring(false);
}

async function refreshMetrics() {
	try {
		// Collect new sample
		await collectMetrics();

		// Get updated stats
		const stats = await getStats();
		setMetricsStats(stats);

		// Get recent history
		const history = await getMetricsHistory(100);
		setMetricsHistory(history);
	} catch (error) {
		console.error("Failed to refresh metrics:", error);
	}
}

export async function refreshLogs() {
	try {
		const logEntries = await getLogs(200);
		setLogs(logEntries);
	} catch (error) {
		console.error("Failed to refresh logs:", error);
	}
}

// Public logging functions for use throughout the app
export const logger = {
	debug: (message: string, context?: string) => addLog("Debug", message, context),
	info: (message: string, context?: string) => addLog("Info", message, context),
	warning: (message: string, context?: string) => addLog("Warning", message, context),
	error: (message: string, context?: string) => addLog("Error", message, context),
	critical: (message: string, context?: string) => addLog("Critical", message, context),
};

// Log app startup
logger.info("LowCast application started");
