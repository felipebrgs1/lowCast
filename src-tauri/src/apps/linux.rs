//! Linux-specific application discovery

use super::Application;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

/// Resolve icon path from icon name on Linux
fn resolve_icon_path(icon_name: &str) -> Option<String> {
    // Se já é um caminho absoluto, retornar como está
    if icon_name.starts_with('/') {
        if Path::new(icon_name).exists() {
            return Some(icon_name.to_string());
        }
        return None;
    }

    // Remover extensão se houver
    let icon_base = icon_name
        .trim_end_matches(".png")
        .trim_end_matches(".svg")
        .trim_end_matches(".xpm");

    // Diretórios comuns de ícones (em ordem de prioridade)
    let icon_paths = [
        format!("/usr/share/pixmaps/{}.png", icon_base),
        format!("/usr/share/pixmaps/{}.svg", icon_base),
        format!("/usr/share/pixmaps/{}.xpm", icon_base),
        format!("/usr/share/icons/hicolor/48x48/apps/{}.png", icon_base),
        format!("/usr/share/icons/hicolor/64x64/apps/{}.png", icon_base),
        format!("/usr/share/icons/hicolor/128x128/apps/{}.png", icon_base),
        format!("/usr/share/icons/hicolor/scalable/apps/{}.svg", icon_base),
        format!(
            "{}/.local/share/icons/hicolor/48x48/apps/{}.png",
            std::env::var("HOME").unwrap_or_default(),
            icon_base
        ),
        format!(
            "{}/.local/share/icons/hicolor/scalable/apps/{}.svg",
            std::env::var("HOME").unwrap_or_default(),
            icon_base
        ),
    ];

    icon_paths.into_iter().find(|path| Path::new(path).exists())
}

/// Parse a .desktop file and return Application if valid
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

    // Ignorar se está marcado como NoDisplay ou Hidden
    if entries.get("NoDisplay").map(|s| s.as_str()) == Some("true") {
        return None;
    }
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

    let icon = entries
        .get("Icon")
        .and_then(|icon_name| resolve_icon_path(icon_name))
        .unwrap_or_default();

    let description = entries.get("Comment").cloned();
    let categories: Vec<String> = entries
        .get("Categories")
        .map(|c| {
            c.split(';')
                .filter(|s| !s.is_empty())
                .map(String::from)
                .collect()
        })
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

/// List all installed applications on Linux
pub fn list_applications_linux() -> Vec<Application> {
    let mut apps: Vec<Application> = Vec::new();
    let mut seen_names: HashSet<String> = HashSet::new();

    let search_paths = [
        "/usr/share/applications".to_string(),
        "/usr/local/share/applications".to_string(),
        format!(
            "{}/.local/share/applications",
            std::env::var("HOME").unwrap_or_default()
        ),
        "/var/lib/flatpak/exports/share/applications".to_string(),
        format!(
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
                        if seen_names.insert(app.name.clone()) {
                            apps.push(app);
                        }
                    }
                }
            }
        }
    }

    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps
}
