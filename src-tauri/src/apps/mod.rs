//! Application discovery and management
//!
//! This module handles listing installed applications on Linux and Windows.

pub mod cache;
pub mod icons;

#[cfg(target_os = "linux")]
mod linux;

#[cfg(target_os = "windows")]
mod windows;

use serde::{Deserialize, Serialize};

/// Represents an installed application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Application {
    pub name: String,
    pub exec: String,
    pub icon: String,
    pub description: Option<String>,
    pub desktop_file: String,
    pub categories: Vec<String>,
}

/// Internal function to scan applications from the system
fn scan_applications() -> Vec<Application> {
    #[cfg(target_os = "linux")]
    {
        linux::list_applications_linux()
    }

    #[cfg(target_os = "windows")]
    {
        windows::list_applications_windows()
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        Vec::new()
    }
}

/// List all installed applications (uses cache if available)
#[tauri::command]
pub fn list_applications() -> Vec<Application> {
    // Try to load from cache first
    if let Some(cached) = cache::load_cached_applications() {
        return cached;
    }

    // No cache or invalid, scan fresh
    eprintln!("[Apps] Scanning applications...");
    let apps = scan_applications();

    // Save to cache for next time
    cache::save_applications_to_cache(&apps);

    apps
}

/// Force refresh the application list (ignores cache)
#[tauri::command]
pub fn refresh_applications() -> Vec<Application> {
    eprintln!("[Apps] Force refreshing applications...");

    // Clear existing cache
    cache::clear_cache();

    // Scan fresh
    let apps = scan_applications();

    // Save to cache
    cache::save_applications_to_cache(&apps);

    apps
}

/// Launch an application by its exec command
#[tauri::command]
pub fn launch_application(exec: String) -> Result<(), String> {
    use std::process::Command;

    if exec.trim().is_empty() {
        return Err("Comando vazio".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // No Windows, usar "cmd /C start" para lidar com caminhos com espaços
        Command::new("cmd")
            .args(["/C", "start", "", &exec])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW - não mostra janela do cmd
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        // No Linux, dividir para separar programa de argumentos
        let parts: Vec<&str> = exec.split_whitespace().collect();
        if parts.is_empty() {
            return Err("Comando vazio".to_string());
        }

        let program = parts[0];
        let args = &parts[1..];

        Command::new(program)
            .args(args)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        return Err("Sistema operacional não suportado".to_string());
    }

    Ok(())
}
