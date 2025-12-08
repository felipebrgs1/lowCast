//! Screenshot capture functionality
//!
//! Cross-platform screenshot capture supporting:
//! - Full screen capture
//! - Region selection capture
//! - Monitor selection
//!
//! On Linux Wayland (Hyprland), uses native tools (grim + slurp)
//! On Linux X11 and Windows, uses xcap library

use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;
use tauri::Manager;

/// Screenshot region coordinates
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Region {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Screenshot result with path to saved file
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScreenshotResult {
    pub path: String,
    pub width: u32,
    pub height: u32,
}

/// Check if running on Wayland
fn is_wayland() -> bool {
    std::env::var("WAYLAND_DISPLAY").is_ok()
        || std::env::var("XDG_SESSION_TYPE")
            .map(|v| v == "wayland")
            .unwrap_or(false)
}

/// Check if grim and slurp are available (for Wayland)
fn has_wayland_tools() -> bool {
    Command::new("which")
        .arg("grim")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
        && Command::new("which")
            .arg("slurp")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
}

/// Get screenshots directory
fn get_screenshots_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let screenshots_dir = app_data_dir.join("screenshots");
    std::fs::create_dir_all(&screenshots_dir)
        .map_err(|e| format!("Failed to create screenshots dir: {}", e))?;

    Ok(screenshots_dir)
}

/// Generate screenshot filename with timestamp
fn generate_filename() -> String {
    let now = chrono::Local::now();
    format!("screenshot_{}.png", now.format("%Y%m%d_%H%M%S"))
}

/// Capture full screen screenshot using Wayland tools
#[cfg(target_os = "linux")]
fn capture_fullscreen_wayland(output_path: &PathBuf) -> Result<(), String> {
    let output = Command::new("grim")
        .arg(output_path.to_string_lossy().to_string())
        .output()
        .map_err(|e| format!("Failed to execute grim: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "grim failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

/// Capture region screenshot using Wayland tools (grim + slurp)
#[cfg(target_os = "linux")]
fn capture_region_wayland(output_path: &PathBuf) -> Result<Region, String> {
    // First, get region from slurp
    let slurp_output = Command::new("slurp")
        .output()
        .map_err(|e| format!("Failed to execute slurp: {}", e))?;

    if !slurp_output.status.success() {
        return Err("Region selection cancelled".to_string());
    }

    let geometry = String::from_utf8_lossy(&slurp_output.stdout)
        .trim()
        .to_string();

    if geometry.is_empty() {
        return Err("No region selected".to_string());
    }

    // Parse geometry (format: "x,y WxH")
    let parts: Vec<&str> = geometry.split_whitespace().collect();
    if parts.len() != 2 {
        return Err(format!("Invalid geometry format: {}", geometry));
    }

    let pos_parts: Vec<&str> = parts[0].split(',').collect();
    let size_parts: Vec<&str> = parts[1].split('x').collect();

    let region = Region {
        x: pos_parts.get(0).and_then(|s| s.parse().ok()).unwrap_or(0),
        y: pos_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0),
        width: size_parts.get(0).and_then(|s| s.parse().ok()).unwrap_or(0),
        height: size_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0),
    };

    // Capture with grim using the geometry
    let output = Command::new("grim")
        .args(["-g", &geometry, output_path.to_string_lossy().as_ref()])
        .output()
        .map_err(|e| format!("Failed to execute grim: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "grim failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(region)
}

/// Capture screenshot of specific region using Wayland tools
#[cfg(target_os = "linux")]
fn capture_area_wayland(output_path: &PathBuf, region: &Region) -> Result<(), String> {
    let geometry = format!(
        "{},{} {}x{}",
        region.x, region.y, region.width, region.height
    );

    let output = Command::new("grim")
        .args(["-g", &geometry, output_path.to_string_lossy().as_ref()])
        .output()
        .map_err(|e| format!("Failed to execute grim: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "grim failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

/// Capture full screen using xcap library
#[cfg(target_os = "linux")]
fn capture_fullscreen_xcap(output_path: &PathBuf) -> Result<(u32, u32), String> {
    use xcap::Monitor;

    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;

    let monitor = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .or_else(|| Monitor::all().ok().and_then(|m| m.into_iter().next()))
        .ok_or("No monitor found")?;

    let image = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture: {}", e))?;

    let width = image.width();
    let height = image.height();

    image
        .save(output_path)
        .map_err(|e| format!("Failed to save: {}", e))?;

    Ok((width, height))
}

/// Capture region using xcap library
#[cfg(target_os = "linux")]
fn capture_area_xcap(output_path: &PathBuf, region: &Region) -> Result<(), String> {
    use xcap::Monitor;

    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;

    let monitor = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .or_else(|| Monitor::all().ok().and_then(|m| m.into_iter().next()))
        .ok_or("No monitor found")?;

    let image = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture: {}", e))?;

    // Crop to region
    let cropped = image::imageops::crop_imm(
        &image,
        region.x as u32,
        region.y as u32,
        region.width,
        region.height,
    )
    .to_image();

    cropped
        .save(output_path)
        .map_err(|e| format!("Failed to save: {}", e))?;

    Ok(())
}

/// Windows: Capture full screen
#[cfg(target_os = "windows")]
fn capture_fullscreen_native(output_path: &PathBuf) -> Result<(u32, u32), String> {
    use xcap::Monitor;

    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;

    let monitor = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .or_else(|| Monitor::all().ok().and_then(|m| m.into_iter().next()))
        .ok_or("No monitor found")?;

    let image = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture: {}", e))?;

    let width = image.width();
    let height = image.height();

    image
        .save(output_path)
        .map_err(|e| format!("Failed to save: {}", e))?;

    Ok((width, height))
}

/// Windows: Capture specific area
#[cfg(target_os = "windows")]
fn capture_area_native(output_path: &PathBuf, region: &Region) -> Result<(), String> {
    use xcap::Monitor;

    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;

    let monitor = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .or_else(|| Monitor::all().ok().and_then(|m| m.into_iter().next()))
        .ok_or("No monitor found")?;

    let image = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture: {}", e))?;

    // Crop to region
    let cropped = image::imageops::crop_imm(
        &image,
        region.x as u32,
        region.y as u32,
        region.width,
        region.height,
    )
    .to_image();

    cropped
        .save(output_path)
        .map_err(|e| format!("Failed to save: {}", e))?;

    Ok(())
}

// ============ TAURI COMMANDS ============

/// Take a full screen screenshot
#[tauri::command]
pub async fn screenshot_fullscreen(app: AppHandle) -> Result<ScreenshotResult, String> {
    let screenshots_dir = get_screenshots_dir(&app)?;
    let filename = generate_filename();
    let output_path = screenshots_dir.join(&filename);

    #[cfg(target_os = "linux")]
    let (width, height) = {
        if is_wayland() && has_wayland_tools() {
            capture_fullscreen_wayland(&output_path)?;
            // Get image dimensions
            let img =
                image::open(&output_path).map_err(|e| format!("Failed to read image: {}", e))?;
            (img.width(), img.height())
        } else {
            capture_fullscreen_xcap(&output_path)?
        }
    };

    #[cfg(target_os = "windows")]
    let (width, height) = capture_fullscreen_native(&output_path)?;

    Ok(ScreenshotResult {
        path: output_path.to_string_lossy().to_string(),
        width,
        height,
    })
}

/// Take a screenshot with interactive region selection
/// On Wayland, uses slurp for native selection UI
/// On X11/Windows, returns info for app to show selection overlay
#[tauri::command]
pub async fn screenshot_select_region(app: AppHandle) -> Result<ScreenshotResult, String> {
    let screenshots_dir = get_screenshots_dir(&app)?;
    let filename = generate_filename();
    let output_path = screenshots_dir.join(&filename);

    #[cfg(target_os = "linux")]
    {
        if is_wayland() && has_wayland_tools() {
            // Use native slurp for selection
            let region = capture_region_wayland(&output_path)?;
            return Ok(ScreenshotResult {
                path: output_path.to_string_lossy().to_string(),
                width: region.width,
                height: region.height,
            });
        }
    }

    // For X11 and Windows, we need the frontend to show selection UI
    // For now, capture full screen and let frontend handle cropping
    Err("Region selection requires frontend overlay for this platform".to_string())
}

/// Capture a specific region (coordinates provided by frontend selection overlay)
#[tauri::command]
pub async fn screenshot_area(
    app: AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<ScreenshotResult, String> {
    let screenshots_dir = get_screenshots_dir(&app)?;
    let filename = generate_filename();
    let output_path = screenshots_dir.join(&filename);

    let region = Region {
        x,
        y,
        width,
        height,
    };

    #[cfg(target_os = "linux")]
    {
        if is_wayland() && has_wayland_tools() {
            capture_area_wayland(&output_path, &region)?;
        } else {
            capture_area_xcap(&output_path, &region)?;
        }
    }

    #[cfg(target_os = "windows")]
    {
        capture_area_native(&output_path, &region)?;
    }

    Ok(ScreenshotResult {
        path: output_path.to_string_lossy().to_string(),
        width,
        height,
    })
}

/// Get list of available monitors
#[tauri::command]
pub async fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
    use xcap::Monitor;

    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;

    let infos: Vec<MonitorInfo> = monitors
        .into_iter()
        .enumerate()
        .map(|(i, m)| MonitorInfo {
            id: i as u32,
            name: m.name().to_string(),
            x: m.x(),
            y: m.y(),
            width: m.width(),
            height: m.height(),
            is_primary: m.is_primary(),
        })
        .collect();

    Ok(infos)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

/// Take screenshot of a specific monitor
#[tauri::command]
pub async fn screenshot_monitor(
    app: AppHandle,
    monitor_id: u32,
) -> Result<ScreenshotResult, String> {
    use xcap::Monitor;

    let screenshots_dir = get_screenshots_dir(&app)?;
    let filename = generate_filename();
    let output_path = screenshots_dir.join(&filename);

    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;

    let monitor = monitors
        .into_iter()
        .nth(monitor_id as usize)
        .ok_or("Monitor not found")?;

    let image = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture: {}", e))?;

    let width = image.width();
    let height = image.height();

    image
        .save(&output_path)
        .map_err(|e| format!("Failed to save: {}", e))?;

    Ok(ScreenshotResult {
        path: output_path.to_string_lossy().to_string(),
        width,
        height,
    })
}

/// Check screenshot capabilities for the current platform
#[tauri::command]
pub async fn get_screenshot_capabilities() -> ScreenshotCapabilities {
    #[cfg(target_os = "linux")]
    {
        let wayland = is_wayland();
        let has_tools = has_wayland_tools();

        ScreenshotCapabilities {
            platform: "linux".to_string(),
            display_server: if wayland {
                "wayland".to_string()
            } else {
                "x11".to_string()
            },
            native_region_selection: wayland && has_tools,
            has_grim: Command::new("which")
                .arg("grim")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false),
            has_slurp: Command::new("which")
                .arg("slurp")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false),
        }
    }

    #[cfg(target_os = "windows")]
    {
        ScreenshotCapabilities {
            platform: "windows".to_string(),
            display_server: "win32".to_string(),
            native_region_selection: false,
            has_grim: false,
            has_slurp: false,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScreenshotCapabilities {
    pub platform: String,
    pub display_server: String,
    pub native_region_selection: bool,
    pub has_grim: bool,
    pub has_slurp: bool,
}

/// Copy screenshot to clipboard
#[tauri::command]
pub async fn copy_screenshot_to_clipboard(path: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if is_wayland() {
            // Use wl-copy for Wayland
            let output = Command::new("wl-copy")
                .args(["--type", "image/png"])
                .stdin(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to start wl-copy: {}", e))?;

            let file_content =
                std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;

            use std::io::Write;
            let mut stdin = output.stdin.ok_or("Failed to open stdin")?;
            stdin
                .write_all(&file_content)
                .map_err(|e| format!("Failed to write to wl-copy: {}", e))?;

            return Ok(());
        } else {
            // Use xclip for X11
            let output = Command::new("xclip")
                .args(["-selection", "clipboard", "-t", "image/png", "-i", &path])
                .output()
                .map_err(|e| format!("Failed to execute xclip: {}", e))?;

            if !output.status.success() {
                return Err(format!(
                    "xclip failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }

            return Ok(());
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows clipboard handling will use the existing clipboard plugin
        // For now, return an error to be handled by clipboard manager
        Err("Use clipboard manager plugin for Windows".to_string())
    }
}

/// Open screenshots folder in file manager
#[tauri::command]
pub async fn open_screenshots_folder(app: AppHandle) -> Result<(), String> {
    let screenshots_dir = get_screenshots_dir(&app)?;

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&screenshots_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&screenshots_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}
