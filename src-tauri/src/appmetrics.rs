//! Application metrics and logging module
//!
//! Tracks CPU, memory, and performance metrics specifically for the LowCast process
//! Provides structured logging with persistence for debugging and analysis
//!
//! This module is only compiled when the `app-monitor` feature is enabled.

#![cfg(feature = "app-monitor")]

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use sysinfo::{Pid, System};

const MAX_METRICS_HISTORY: usize = 1000; // Keep last 1000 samples
const MAX_LOGS_IN_MEMORY: usize = 500; // Keep last 500 logs in memory
const CPU_SPIKE_THRESHOLD: f32 = 50.0; // CPU% threshold to consider a spike

/// Global state for metrics and logs
static APP_MONITOR: Mutex<Option<AppMonitor>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    Debug,
    Info,
    Warning,
    Error,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: LogLevel,
    pub message: String,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppMetricsSample {
    pub timestamp: String,
    pub cpu_usage: f32,
    pub memory_bytes: u64,
    pub memory_mb: f64,
    pub is_spike: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppMetricsStats {
    pub current: AppMetricsSample,
    pub avg_cpu: f32,
    pub max_cpu: f32,
    pub min_cpu: f32,
    pub avg_memory_mb: f64,
    pub max_memory_mb: f64,
    pub min_memory_mb: f64,
    pub spike_count: usize,
    pub samples_count: usize,
}

struct AppMonitor {
    system: System,
    pid: Pid,
    metrics_history: VecDeque<AppMetricsSample>,
    logs: VecDeque<LogEntry>,
    log_file_path: PathBuf,
}

impl AppMonitor {
    fn new() -> Self {
        let pid = Pid::from_u32(std::process::id());
        let mut system = System::new();
        system.refresh_all();

        // Create logs directory
        let log_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("lowcast")
            .join("logs");

        fs::create_dir_all(&log_dir).ok();

        let log_file_path = log_dir.join(format!(
            "lowcast_{}.log",
            Utc::now().format("%Y%m%d_%H%M%S")
        ));

        Self {
            system,
            pid,
            metrics_history: VecDeque::with_capacity(MAX_METRICS_HISTORY),
            logs: VecDeque::with_capacity(MAX_LOGS_IN_MEMORY),
            log_file_path,
        }
    }

    fn collect_sample(&mut self) -> Option<AppMetricsSample> {
        // Refresh to get latest process info
        self.system.refresh_all();

        if let Some(process) = self.system.process(self.pid) {
            let cpu_usage = process.cpu_usage();
            let memory_bytes = process.memory();
            let memory_mb = memory_bytes as f64 / 1024.0 / 1024.0;

            // Detect spike
            let is_spike = cpu_usage > CPU_SPIKE_THRESHOLD;

            let sample = AppMetricsSample {
                timestamp: Utc::now().to_rfc3339(),
                cpu_usage,
                memory_bytes,
                memory_mb,
                is_spike,
            };

            // Add to history
            if self.metrics_history.len() >= MAX_METRICS_HISTORY {
                self.metrics_history.pop_front();
            }
            self.metrics_history.push_back(sample.clone());

            // Log spike automatically
            if is_spike {
                self.add_log_internal(
                    LogLevel::Warning,
                    format!("CPU spike detected: {:.2}%", cpu_usage),
                    Some(format!("Memory: {:.2} MB", memory_mb)),
                );
            }

            Some(sample)
        } else {
            None
        }
    }

    fn get_stats(&self) -> Option<AppMetricsStats> {
        if self.metrics_history.is_empty() {
            return None;
        }

        let current = self.metrics_history.back()?.clone();

        let cpu_values: Vec<f32> = self.metrics_history.iter().map(|s| s.cpu_usage).collect();
        let memory_values: Vec<f64> = self.metrics_history.iter().map(|s| s.memory_mb).collect();

        let avg_cpu = cpu_values.iter().sum::<f32>() / cpu_values.len() as f32;
        let max_cpu = cpu_values
            .iter()
            .fold(f32::MIN, |a, &b| if a > b { a } else { b });
        let min_cpu = cpu_values
            .iter()
            .fold(f32::MAX, |a, &b| if a < b { a } else { b });

        let avg_memory_mb = memory_values.iter().sum::<f64>() / memory_values.len() as f64;
        let max_memory_mb = memory_values
            .iter()
            .fold(f64::MIN, |a, &b| if a > b { a } else { b });
        let min_memory_mb = memory_values
            .iter()
            .fold(f64::MAX, |a, &b| if a < b { a } else { b });

        let spike_count = self.metrics_history.iter().filter(|s| s.is_spike).count();

        Some(AppMetricsStats {
            current,
            avg_cpu,
            max_cpu,
            min_cpu,
            avg_memory_mb,
            max_memory_mb,
            min_memory_mb,
            spike_count,
            samples_count: self.metrics_history.len(),
        })
    }

    fn add_log_internal(&mut self, level: LogLevel, message: String, context: Option<String>) {
        let entry = LogEntry {
            timestamp: Utc::now().to_rfc3339(),
            level: level.clone(),
            message: message.clone(),
            context: context.clone(),
        };

        // Add to memory
        if self.logs.len() >= MAX_LOGS_IN_MEMORY {
            self.logs.pop_front();
        }
        self.logs.push_back(entry.clone());

        // Write to file
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_file_path)
        {
            let log_line = format!(
                "[{}] {:?}: {} {}\n",
                entry.timestamp,
                level,
                message,
                context.unwrap_or_default()
            );
            let _ = file.write_all(log_line.as_bytes());
        }
    }

    fn get_logs(&self, limit: Option<usize>) -> Vec<LogEntry> {
        let limit = limit.unwrap_or(100).min(self.logs.len());
        self.logs
            .iter()
            .rev()
            .take(limit)
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect()
    }

    fn get_metrics_history(&self, limit: Option<usize>) -> Vec<AppMetricsSample> {
        let limit = limit.unwrap_or(100).min(self.metrics_history.len());
        self.metrics_history
            .iter()
            .rev()
            .take(limit)
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect()
    }

    fn clear_logs(&mut self) {
        self.logs.clear();
    }

    fn clear_metrics(&mut self) {
        self.metrics_history.clear();
    }
}

fn get_or_init_monitor() -> &'static Mutex<Option<AppMonitor>> {
    let mut guard = APP_MONITOR.lock().unwrap();
    if guard.is_none() {
        *guard = Some(AppMonitor::new());
    }
    drop(guard);
    &APP_MONITOR
}

/// Collect a metrics sample for the current process
#[tauri::command]
pub fn collect_app_metrics() -> Result<AppMetricsSample, String> {
    let monitor_lock = get_or_init_monitor();
    let mut guard = monitor_lock.lock().unwrap();
    let monitor = guard.as_mut().unwrap();

    monitor
        .collect_sample()
        .ok_or_else(|| "Failed to collect metrics".to_string())
}

/// Get current statistics and metrics
#[tauri::command]
pub fn get_app_stats() -> Result<AppMetricsStats, String> {
    let monitor_lock = get_or_init_monitor();
    let guard = monitor_lock.lock().unwrap();
    let monitor = guard.as_ref().unwrap();

    monitor
        .get_stats()
        .ok_or_else(|| "No metrics available".to_string())
}

/// Get metrics history
#[tauri::command]
pub fn get_app_metrics_history(limit: Option<usize>) -> Result<Vec<AppMetricsSample>, String> {
    let monitor_lock = get_or_init_monitor();
    let guard = monitor_lock.lock().unwrap();
    let monitor = guard.as_ref().unwrap();

    Ok(monitor.get_metrics_history(limit))
}

/// Add a log entry
#[tauri::command]
pub fn app_log(level: LogLevel, message: String, context: Option<String>) -> Result<(), String> {
    let monitor_lock = get_or_init_monitor();
    let mut guard = monitor_lock.lock().unwrap();
    let monitor = guard.as_mut().unwrap();

    monitor.add_log_internal(level, message, context);
    Ok(())
}

/// Get log entries
#[tauri::command]
pub fn get_app_logs(limit: Option<usize>) -> Result<Vec<LogEntry>, String> {
    let monitor_lock = get_or_init_monitor();
    let guard = monitor_lock.lock().unwrap();
    let monitor = guard.as_ref().unwrap();

    Ok(monitor.get_logs(limit))
}

/// Clear all logs
#[tauri::command]
pub fn clear_app_logs() -> Result<(), String> {
    let monitor_lock = get_or_init_monitor();
    let mut guard = monitor_lock.lock().unwrap();
    let monitor = guard.as_mut().unwrap();

    monitor.clear_logs();
    Ok(())
}

/// Clear metrics history
#[tauri::command]
pub fn clear_app_metrics() -> Result<(), String> {
    let monitor_lock = get_or_init_monitor();
    let mut guard = monitor_lock.lock().unwrap();
    let monitor = guard.as_mut().unwrap();

    monitor.clear_metrics();
    Ok(())
}

/// Get log file path
#[tauri::command]
pub fn get_log_file_path() -> Result<String, String> {
    let monitor_lock = get_or_init_monitor();
    let guard = monitor_lock.lock().unwrap();
    let monitor = guard.as_ref().unwrap();

    Ok(monitor.log_file_path.to_string_lossy().to_string())
}

/// Start background metrics collection
/// This runs in a separate thread and collects metrics every 1 second
pub fn start_background_monitoring() {
    // Initialize monitor first
    let _ = get_or_init_monitor();
    
    thread::spawn(move || {
        loop {
            // Collect sample
            if let Ok(_sample) = collect_app_metrics() {
                // Sample collected and stored automatically
            }
            
            // Wait 1 second before next collection
            thread::sleep(Duration::from_secs(1));
        }
    });
}
