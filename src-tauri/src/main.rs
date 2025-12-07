// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Force Wayland backend on Linux for layer-shell support
    #[cfg(target_os = "linux")]
    {
        // Only set if we're in a Wayland session and WAYLAND_DISPLAY is set
        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            std::env::set_var("GDK_BACKEND", "wayland");
        }
    }

    lowcast_lib::run()
}
