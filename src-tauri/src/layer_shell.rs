//! Layer Shell support for Wayland
//!
//! This module provides native overlay functionality on Wayland compositors
//! using the wlr-layer-shell protocol via gtk-layer-shell.
//! This makes the app behave like Wofi, rofi, etc.

use gtk::prelude::*;
use gtk_layer_shell::{Edge, Layer, LayerShell};
use std::error::Error;
use tauri::{App, Manager, Runtime};

/// Configure the main window as a layer-shell overlay
/// This will make the window float above all other windows and be centered
pub fn setup_layer_shell<R>(app: &mut App<R>) -> Result<(), Box<dyn Error>>
where
    R: Runtime,
{
    // Only run on Linux with Wayland
    #[cfg(not(target_os = "linux"))]
    return Ok(());

    #[cfg(target_os = "linux")]
    {
        // Check if layer-shell is supported (Wayland with wlr-layer-shell)
        if !gtk_layer_shell::is_supported() {
            println!(
                "[layer-shell] Not supported on this compositor, falling back to normal window"
            );
            return Ok(());
        }

        println!("[layer-shell] Setting up layer-shell overlay mode");

        let main_window = app
            .get_webview_window("main")
            .ok_or("No main window found")?;

        // Get the GTK window and create a new application window for layer-shell
        let gtk_window = main_window
            .gtk_window()
            .map_err(|e| format!("Failed to get GTK window: {}", e))?;

        let gtk_app = gtk_window.application().ok_or("No GTK application found")?;

        // Create a new GTK window for layer-shell
        let layer_window = gtk::ApplicationWindow::new(&gtk_app);
        layer_window.set_app_paintable(true);

        // Get the vbox (WebView container) from the original window
        let vbox = main_window.default_vbox()?;

        // Move the vbox from original window to layer-shell window
        gtk_window.remove(&vbox);
        layer_window.add(&vbox);

        // Close the original GTK window
        gtk_window.close();

        // On Hyprland: use hyprctl to close the ghost window
        // This is needed because gtk.close() doesn't fully unmap the window
        // Only run this on Hyprland (detected via HYPRLAND_INSTANCE_SIGNATURE)
        if std::env::var("HYPRLAND_INSTANCE_SIGNATURE").is_ok() {
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(500));
                let _ = std::process::Command::new("hyprctl")
                    .args(["dispatch", "closewindow", "class:lowcast"])
                    .output();
                println!("[layer-shell] Closed ghost window via hyprctl");
            });
        }

        // Initialize layer-shell on the new window
        layer_window.init_layer_shell();

        // Set layer to Overlay (above everything including fullscreen apps)
        // Use Layer::Top if you want it below fullscreen apps
        layer_window.set_layer(Layer::Overlay);

        // Configure keyboard interactivity
        layer_window.set_keyboard_mode(gtk_layer_shell::KeyboardMode::OnDemand);

        // Get monitor size for centering
        let monitor_width: i32 = app
            .available_monitors()
            .ok()
            .and_then(|monitors| monitors.first().cloned())
            .map(|m| m.size().width as i32)
            .unwrap_or(1920);

        let monitor_height: i32 = app
            .available_monitors()
            .ok()
            .and_then(|monitors| monitors.first().cloned())
            .map(|m| m.size().height as i32)
            .unwrap_or(1080);

        // Set window size
        let window_width = 800;
        let window_height = 500;
        layer_window.set_width_request(window_width);
        layer_window.set_height_request(window_height);

        // Center the window by setting margins
        // We anchor to all edges and use margins to center
        let horizontal_margin = (monitor_width - window_width) / 2;
        let vertical_margin = (monitor_height - window_height) / 3; // 1/3 from top (like Spotlight)

        layer_window.set_anchor(Edge::Top, true);
        layer_window.set_anchor(Edge::Left, true);
        layer_window.set_anchor(Edge::Right, true);
        layer_window.set_anchor(Edge::Bottom, false);

        layer_window.set_layer_shell_margin(Edge::Top, vertical_margin);
        layer_window.set_layer_shell_margin(Edge::Left, horizontal_margin);
        layer_window.set_layer_shell_margin(Edge::Right, horizontal_margin);

        // Show the layer-shell window
        layer_window.show_all();

        println!(
            "[layer-shell] Overlay configured: {}x{} at margins ({}, {})",
            window_width, window_height, horizontal_margin, vertical_margin
        );

        Ok(())
    }
}
