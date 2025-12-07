//! LowCast - Desktop launcher and clipboard manager
//!
//! This is the main library entry point for the Tauri application.

mod apps;
mod cli;
mod encoding;
mod image;
mod layer_shell;
mod window;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Toggle window visibility helper function
fn toggle_window_visibility(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

/// Main application entry point
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Quando uma segunda instância é iniciada, processar os argumentos
            println!("Segunda instância detectada com args: {:?}", args);
            cli::process_cli_args(app, args);
        }))
        .invoke_handler(tauri::generate_handler![
            apps::list_applications,
            apps::refresh_applications,
            apps::launch_application,
            apps::icons::get_icon_data_url,
            apps::icons::get_icons_batch,
            window::show_window,
            window::hide_window,
            window::toggle_window,
            image::compress_png,
            image::rgba_to_png,
        ])
        .setup(|app| {
            // === LAYER SHELL (Wayland Overlay) ===
            // Configura a janela como overlay nativo no Wayland (como Wofi)
            if let Err(e) = layer_shell::setup_layer_shell(app) {
                eprintln!("[layer-shell] Failed to setup: {}", e);
                // Continue with normal window mode
            }

            // === SYSTEM TRAY ===
            // Criar menu para o tray
            let show_item = MenuItem::with_id(app, "show", "Mostrar (Alt+C)", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Criar o tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("LowCast - Alt+C para abrir")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        toggle_window_visibility(app);
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Ao clicar no ícone da tray, mostrar a janela
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // === GLOBAL SHORTCUT (Alt+C) ===
            let alt_c_shortcut = Shortcut::new(Some(Modifiers::ALT), Code::KeyC);

            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, shortcut, event| {
                        if shortcut == &alt_c_shortcut && event.state() == ShortcutState::Pressed {
                            toggle_window_visibility(app);
                        }
                    })
                    .build(),
            )?;

            app.global_shortcut().register(alt_c_shortcut)?;

            // === WINDOW CLOSE EVENT - Esconder em vez de fechar ===
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // Prevenir o fechamento e apenas esconder
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

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
