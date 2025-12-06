//! Application cache management
//!
//! Caches the application list to avoid re-scanning on every startup.
//! Cache is invalidated when the system boot time changes.

use super::Application;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;

/// Cached application data with metadata
#[derive(Debug, Serialize, Deserialize)]
struct AppCache {
    /// System boot time when cache was created (as unix timestamp)
    boot_time: u64,
    /// Cached applications
    applications: Vec<Application>,
}

/// Get the cache file path
fn get_cache_path() -> Option<PathBuf> {
    dirs::data_local_dir().map(|dir| dir.join("lowcast").join("apps_cache.json"))
}

/// Get the system boot time as a unix timestamp
#[cfg(target_os = "windows")]
fn get_system_boot_time() -> u64 {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    // Use WMIC to get the last boot time
    let output = Command::new("wmic")
        .args(["os", "get", "LastBootUpTime", "/value"])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .ok();

    if let Some(output) = output {
        let text = String::from_utf8_lossy(&output.stdout);
        // Format: LastBootUpTime=20231206141530.500000-180
        if let Some(line) = text.lines().find(|l| l.starts_with("LastBootUpTime=")) {
            if let Some(value) = line.strip_prefix("LastBootUpTime=") {
                // Parse first 14 chars (YYYYMMDDHHmmss) as a unique identifier
                let boot_id: u64 = value
                    .chars()
                    .take(14)
                    .filter(|c| c.is_ascii_digit())
                    .collect::<String>()
                    .parse()
                    .unwrap_or(0);
                return boot_id;
            }
        }
    }

    // Fallback: use current time (will always invalidate cache)
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(target_os = "linux")]
fn get_system_boot_time() -> u64 {
    // On Linux, read /proc/stat for boot time
    if let Ok(content) = fs::read_to_string("/proc/stat") {
        for line in content.lines() {
            if line.starts_with("btime ") {
                if let Some(time_str) = line.strip_prefix("btime ") {
                    return time_str.trim().parse().unwrap_or(0);
                }
            }
        }
    }

    // Fallback
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn get_system_boot_time() -> u64 {
    // Fallback for unsupported OS
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Load cached applications if the cache is still valid
pub fn load_cached_applications() -> Option<Vec<Application>> {
    let cache_path = get_cache_path()?;

    if !cache_path.exists() {
        eprintln!("[Cache] No cache file found");
        return None;
    }

    let content = fs::read_to_string(&cache_path).ok()?;
    let cache: AppCache = serde_json::from_str(&content).ok()?;

    let current_boot_time = get_system_boot_time();

    if cache.boot_time == current_boot_time {
        eprintln!(
            "[Cache] Valid cache found with {} applications",
            cache.applications.len()
        );
        Some(cache.applications)
    } else {
        eprintln!(
            "[Cache] Cache invalidated - boot time changed ({} -> {})",
            cache.boot_time, current_boot_time
        );
        None
    }
}

/// Save applications to cache
pub fn save_applications_to_cache(applications: &[Application]) {
    let Some(cache_path) = get_cache_path() else {
        eprintln!("[Cache] Could not determine cache path");
        return;
    };

    // Ensure directory exists
    if let Some(parent) = cache_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let cache = AppCache {
        boot_time: get_system_boot_time(),
        applications: applications.to_vec(),
    };

    match serde_json::to_string(&cache) {
        Ok(json) => {
            if let Err(e) = fs::write(&cache_path, json) {
                eprintln!("[Cache] Failed to write cache: {}", e);
            } else {
                eprintln!("[Cache] Saved {} applications to cache", applications.len());
            }
        }
        Err(e) => {
            eprintln!("[Cache] Failed to serialize cache: {}", e);
        }
    }
}

/// Clear the cache file
pub fn clear_cache() {
    if let Some(cache_path) = get_cache_path() {
        if cache_path.exists() {
            let _ = fs::remove_file(&cache_path);
            eprintln!("[Cache] Cache cleared");
        }
    }
}
