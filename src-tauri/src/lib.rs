//! LowCast - Desktop launcher and clipboard manager
//!
//! This is the main library entry point for the Tauri application.

mod apps;
mod cli;
mod encoding;
mod window;

use tauri::Manager;

/// Main application entry point
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Quando uma segunda instância é iniciada, processar os argumentos
            println!("Segunda instância detectada com args: {:?}", args);
            cli::process_cli_args(app, args);
        }))
        .invoke_handler(tauri::generate_handler![
            apps::list_applications,
            apps::launch_application,
            apps::icons::get_icon_data_url,
            apps::icons::get_icons_batch,
            window::show_window,
            window::hide_window,
            window::toggle_window,
        ])
        .setup(|app| {
            // Posicionar a janela
            if let Some(window) = app.get_webview_window("main") {
                // Tentar centralizar horizontalmente e posicionar levemente abaixo do topo
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let screen_size = monitor.size();
                    let window_size = window.outer_size().unwrap_or(tauri::PhysicalSize {
                        width: 800,
                        height: 600,
                    });

                    let x = (screen_size.width as i32 - window_size.width as i32) / 2;
                    // 40% da altura da tela para baixo
                    let y = (screen_size.height as f64 * 0.40) as i32;

                    let _ = window
                        .set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
                }
            }

            // Criar diretório de dados da app se não existir
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();

            // Processar argumentos CLI na primeira inicialização
            let args: Vec<String> = std::env::args().collect();
            cli::process_cli_args(&app.handle(), args);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
