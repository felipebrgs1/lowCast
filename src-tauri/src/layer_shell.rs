//! Layer Shell support for Wayland
//!
//! This module provides native overlay functionality on Wayland compositors.
//! Currently DISABLED - using native Tauri window properties (alwaysOnTop)
//! which Hyprland respects properly.

use std::error::Error;
use tauri::{App, Runtime};

/// Configure the main window as an overlay
/// Currently uses native Tauri properties instead of layer-shell
/// because layer-shell requires complex window re-parenting that
/// conflicts with Tauri's window management.
pub fn setup_layer_shell<R>(_app: &mut App<R>) -> Result<(), Box<dyn Error>>
where
    R: Runtime,
{
    // Layer-shell disabled - Hyprland respects alwaysOnTop: true from tauri.conf.json
    // This provides similar behavior to Wofi/rofi without the complexity
    println!("[layer-shell] Using native alwaysOnTop mode (layer-shell disabled)");
    Ok(())
}
