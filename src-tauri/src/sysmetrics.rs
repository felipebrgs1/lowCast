//! System metrics module for devmode
//!
//! Provides real-time system information like CPU, memory, process stats, etc.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use sysinfo::{ProcessesToUpdate, System};

/// Global system instance (reused for efficiency)
static SYSTEM: Mutex<Option<System>> = Mutex::new(None);

/// Initialize the system monitor
fn get_system() -> &'static Mutex<Option<System>> {
	&SYSTEM
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemMetrics {
	pub cpu_usage: f32,
	pub cpu_count: usize,
	pub memory_total: u64,
	pub memory_used: u64,
	pub memory_available: u64,
	pub swap_total: u64,
	pub swap_used: u64,
	pub process_count: usize,
	pub uptime: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessInfo {
	pub pid: u32,
	pub name: String,
	pub cpu_usage: f32,
	pub memory: u64,
}

/// Get current system metrics
#[tauri::command]
pub fn get_system_metrics() -> Result<SystemMetrics, String> {
	let sys_lock = get_system();
	let mut sys_guard = sys_lock.lock().unwrap();

	// Initialize if needed
	if sys_guard.is_none() {
		*sys_guard = Some(System::new_all());
	}

	let sys = sys_guard.as_mut().unwrap();

	// Refresh CPU and memory
	sys.refresh_cpu_all();
	sys.refresh_memory();

	// Calculate average CPU usage
	let cpu_usage = sys.cpus().iter().map(|cpu| cpu.cpu_usage()).sum::<f32>()
		/ sys.cpus().len() as f32;

	Ok(SystemMetrics {
		cpu_usage,
		cpu_count: sys.cpus().len(),
		memory_total: sys.total_memory(),
		memory_used: sys.used_memory(),
		memory_available: sys.available_memory(),
		swap_total: sys.total_swap(),
		swap_used: sys.used_swap(),
		process_count: sys.processes().len(),
		uptime: System::uptime(),
	})
}

/// Get top processes by CPU usage
#[tauri::command]
pub fn get_top_processes(limit: usize) -> Result<Vec<ProcessInfo>, String> {
	let sys_lock = get_system();
	let mut sys_guard = sys_lock.lock().unwrap();

	// Initialize if needed
	if sys_guard.is_none() {
		*sys_guard = Some(System::new_all());
	}

	let sys = sys_guard.as_mut().unwrap();

	// Refresh processes (update all processes)
	sys.refresh_processes(ProcessesToUpdate::All, true);

	let mut processes: Vec<ProcessInfo> = sys
		.processes()
		.iter()
		.map(|(pid, process)| ProcessInfo {
			pid: pid.as_u32(),
			name: process.name().to_string_lossy().to_string(),
			cpu_usage: process.cpu_usage(),
			memory: process.memory(),
		})
		.collect();

	// Sort by CPU usage descending
	processes.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap());

	// Take top N
	processes.truncate(limit);

	Ok(processes)
}

/// Get per-core CPU usage
#[tauri::command]
pub fn get_cpu_per_core() -> Result<Vec<f32>, String> {
	let sys_lock = get_system();
	let mut sys_guard = sys_lock.lock().unwrap();

	// Initialize if needed
	if sys_guard.is_none() {
		*sys_guard = Some(System::new_all());
	}

	let sys = sys_guard.as_mut().unwrap();
	sys.refresh_cpu_all();

	Ok(sys.cpus().iter().map(|cpu| cpu.cpu_usage()).collect())
}
