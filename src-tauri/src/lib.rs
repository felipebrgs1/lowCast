use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Application {
    pub name: String,
    pub exec: String,
    pub icon: Option<String>,
    pub description: Option<String>,
    pub desktop_file: String,
    pub categories: Vec<String>,
}

fn parse_desktop_file(path: &Path) -> Option<Application> {
    let content = fs::read_to_string(path).ok()?;
    let mut in_desktop_entry = false;
    let mut entries: HashMap<String, String> = HashMap::new();

    for line in content.lines() {
        let line = line.trim();
        if line.starts_with('[') {
            in_desktop_entry = line == "[Desktop Entry]";
            continue;
        }
        if !in_desktop_entry || line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = line.split_once('=') {
            entries.insert(key.to_string(), value.to_string());
        }
    }

    // Ignorar se não é uma aplicação
    if entries.get("Type").map(|s| s.as_str()) != Some("Application") {
        return None;
    }

    // Ignorar se está marcado como NoDisplay
    if entries.get("NoDisplay").map(|s| s.as_str()) == Some("true") {
        return None;
    }

    // Ignorar se está marcado como Hidden
    if entries.get("Hidden").map(|s| s.as_str()) == Some("true") {
        return None;
    }

    let name = entries.get("Name")?.clone();
    let exec = entries.get("Exec")?.clone();

    // Limpar o comando exec (remover %U, %F, etc.)
    let exec_clean = exec
        .replace("%U", "")
        .replace("%u", "")
        .replace("%F", "")
        .replace("%f", "")
        .replace("%i", "")
        .replace("%c", "")
        .replace("%k", "")
        .trim()
        .to_string();

    let icon = entries.get("Icon").cloned();
    let description = entries.get("Comment").cloned();
    let categories: Vec<String> = entries
        .get("Categories")
        .map(|c| c.split(';').filter(|s| !s.is_empty()).map(String::from).collect())
        .unwrap_or_default();

    Some(Application {
        name,
        exec: exec_clean,
        icon,
        description,
        desktop_file: path.to_string_lossy().to_string(),
        categories,
    })
}

#[tauri::command]
fn list_applications() -> Vec<Application> {
    let mut apps: Vec<Application> = Vec::new();
    let mut seen_names: std::collections::HashSet<String> = std::collections::HashSet::new();

    let search_paths = [
        "/usr/share/applications",
        "/usr/local/share/applications",
        &format!(
            "{}/.local/share/applications",
            std::env::var("HOME").unwrap_or_default()
        ),
        "/var/lib/flatpak/exports/share/applications",
        &format!(
            "{}/.local/share/flatpak/exports/share/applications",
            std::env::var("HOME").unwrap_or_default()
        ),
    ];

    for search_path in &search_paths {
        let path = Path::new(search_path);
        if !path.exists() {
            continue;
        }

        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "desktop").unwrap_or(false) {
                    if let Some(app) = parse_desktop_file(&path) {
                        // Evitar duplicatas pelo nome
                        if seen_names.insert(app.name.clone()) {
                            apps.push(app);
                        }
                    }
                }
            }
        }
    }

    // Ordenar por nome
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps
}

#[tauri::command]
fn launch_application(exec: String) -> Result<(), String> {
    use std::process::Command;

    // Separar o comando e seus argumentos
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![list_applications, launch_application])
        .setup(|app| {
            // Criar diretório de dados da app se não existir
            let app_data_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
