//! Application discovery and management
//!
//! This module handles listing installed applications on Linux and Windows.

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

/// List all installed applications
#[tauri::command]
pub fn list_applications() -> Vec<Application> {
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

/// Launch an application by its exec command
#[tauri::command]
pub fn launch_application(exec: String) -> Result<(), String> {
    use std::process::Command;

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

    Ok(())
}
