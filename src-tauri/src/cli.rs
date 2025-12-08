//! CLI argument processing

use tauri::{Emitter, Manager};

/// Process command line arguments for single-instance handling
pub fn process_cli_args(app: &tauri::AppHandle, args: Vec<String>) {
    if args.len() <= 1 {
        // Sem argumentos, fazer toggle da janela (comportamento padrão)
        if let Some(window) = app.get_webview_window("main") {
            if let Ok(is_visible) = window.is_visible() {
                if is_visible {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            } else {
                // Em caso de erro, tentar mostrar
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        return;
    }

    let window = match app.get_webview_window("main") {
        Some(w) => w,
        None => return,
    };

    // Processar o primeiro argumento (ignorando o nome do executável em args[0])
    let command = args.get(1).map(|s| s.as_str());

    match command {
        Some("--show") => {
            let _ = window.show();
            let _ = window.set_focus();
        }
        Some("--hide") => {
            let _ = window.hide();
        }
        Some("--toggle") => {
            if let Ok(is_visible) = window.is_visible() {
                if is_visible {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
        Some("--history") | Some("--clipboard") => {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("cli-navigate", "/clipboard");
        }
        Some("--apps") => {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("cli-navigate", "/apps");
        }
        Some("--home") => {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("cli-navigate", "/");
        }
        Some("--screenshot") => {
            // Emit event for fullscreen screenshot
            let _ = window.emit("cli-screenshot", "fullscreen");
            // Keep window hidden during screenshot
        }
        Some("--screenshot-area") | Some("-s") => {
            // Emit event for region selection screenshot
            let _ = window.emit("cli-screenshot", "area");
            // Keep window hidden during screenshot
        }
        Some("--screenshot-gui") => {
            // Show screenshot UI in the app
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("cli-navigate", "/screenshot");
        }
        Some("--help") | Some("-h") => {
            println!("lowCast - Desktop launcher, clipboard manager & screenshot tool");
            println!("\nUsage: lowcast [COMMAND]\n");
            println!("Commands:");
            println!("  --show                Show the window");
            println!("  --hide                Hide the window");
            println!("  --toggle              Toggle window visibility (default)");
            println!("  --history             Show clipboard history");
            println!("  --clipboard           Alias for --history");
            println!("  --apps                Show applications list");
            println!("  --home                Show home/search page");
            println!("\nScreenshot:");
            println!("  --screenshot          Take full screen screenshot");
            println!("  --screenshot-area, -s Select area and take screenshot");
            println!("  --screenshot-gui      Open screenshot UI in app");
            println!("\nExamples:");
            println!("  lowcast --screenshot          # Full screen capture");
            println!("  lowcast -s                    # Select area (uses slurp on Wayland)");
            println!("\nHyprland binding example:");
            println!("  bind = , Print, exec, lowcast --screenshot");
            println!("  bind = SHIFT, Print, exec, lowcast -s");
            println!("\n  --help, -h            Show this help message");
        }
        _ => {
            // Argumento desconhecido ou sem argumentos, apenas mostrar
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
