use serde::{Deserialize, Serialize};
#[cfg(target_os = "linux")]
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::{Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Application {
    pub name: String,
    pub exec: String,
    pub icon: String,
    pub description: Option<String>,
    pub desktop_file: String,
    pub categories: Vec<String>,
}

#[allow(dead_code)]
fn resolve_icon_path(icon_name: &str) -> Option<String> {
    // Se já é um caminho absoluto, retornar como está
    if icon_name.starts_with('/') {
        if Path::new(icon_name).exists() {
            return Some(icon_name.to_string());
        }
        return None;
    }

    // Remover extensão se houver (freedesktop.org spec permite icon names sem extensão)
    let icon_base = icon_name
        .trim_end_matches(".png")
        .trim_end_matches(".svg")
        .trim_end_matches(".xpm");

    // Diretórios comuns de ícones (em ordem de prioridade)
    let icon_paths = [
        // Pixmaps (geralmente tem ícones em tamanho fixo)
        format!("/usr/share/pixmaps/{}.png", icon_base),
        format!("/usr/share/pixmaps/{}.svg", icon_base),
        format!("/usr/share/pixmaps/{}.xpm", icon_base),
        // Hicolor theme (padrão)
        format!("/usr/share/icons/hicolor/48x48/apps/{}.png", icon_base),
        format!("/usr/share/icons/hicolor/64x64/apps/{}.png", icon_base),
        format!("/usr/share/icons/hicolor/128x128/apps/{}.png", icon_base),
        format!("/usr/share/icons/hicolor/scalable/apps/{}.svg", icon_base),
        // User local icons
        format!("{}/.local/share/icons/hicolor/48x48/apps/{}.png",
            std::env::var("HOME").unwrap_or_default(), icon_base),
        format!("{}/.local/share/icons/hicolor/scalable/apps/{}.svg",
            std::env::var("HOME").unwrap_or_default(), icon_base),
    ];

    // Retornar o primeiro caminho que existir
    for path in &icon_paths {
        if Path::new(path).exists() {
            return Some(path.clone());
        }
    }

    None
}

#[cfg(target_os = "linux")]
#[allow(dead_code)]
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

    // Resolver caminho do ícone
    let icon = entries
        .get("Icon")
        .and_then(|icon_name| resolve_icon_path(icon_name))
        .unwrap_or_default();

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

/// Decode PowerShell output handling different encodings (UTF-8, UTF-16 LE/BE, Windows-1252)
#[cfg(target_os = "windows")]
fn decode_powershell_output(bytes: &[u8]) -> String {
    // Check for BOM (Byte Order Mark)
    if bytes.len() >= 2 {
        // UTF-16 LE BOM: FF FE
        if bytes[0] == 0xFF && bytes[1] == 0xFE {
            eprintln!("[Rust] Detected UTF-16 LE encoding");
            let u16_chars: Vec<u16> = bytes[2..]
                .chunks_exact(2)
                .map(|c| u16::from_le_bytes([c[0], c[1]]))
                .collect();
            return String::from_utf16_lossy(&u16_chars);
        }
        // UTF-16 BE BOM: FE FF
        if bytes[0] == 0xFE && bytes[1] == 0xFF {
            eprintln!("[Rust] Detected UTF-16 BE encoding");
            let u16_chars: Vec<u16> = bytes[2..]
                .chunks_exact(2)
                .map(|c| u16::from_be_bytes([c[0], c[1]]))
                .collect();
            return String::from_utf16_lossy(&u16_chars);
        }
    }
    
    // Check for UTF-8 BOM: EF BB BF
    if bytes.len() >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF {
        eprintln!("[Rust] Detected UTF-8 with BOM");
        return match String::from_utf8(bytes[3..].to_vec()) {
            Ok(s) => s,
            Err(_) => String::from_utf8_lossy(&bytes[3..]).to_string(),
        };
    }
    
    // Try UTF-8 first
    match String::from_utf8(bytes.to_vec()) {
        Ok(s) => {
            eprintln!("[Rust] Successfully decoded as UTF-8");
            s
        }
        Err(_) => {
            eprintln!("[Rust] UTF-8 decode failed, trying Windows-1252");
            // Fall back to Windows-1252 (common Windows encoding for Portuguese)
            bytes.iter().map(|&b| {
                // Windows-1252 to UTF-8 conversion for common Portuguese characters
                match b {
                    0x80..=0x9F => {
                        // Control characters in Windows-1252, map to replacement char
                        '\u{FFFD}'
                    }
                    0xC0..=0xFF => {
                        // Latin-1 Supplement, same as Unicode
                        char::from_u32(b as u32).unwrap_or('\u{FFFD}')
                    }
                    _ => b as char,
                }
            }).collect()
        }
    }
}

#[tauri::command]
fn list_applications() -> Vec<Application> {
    #[cfg(target_os = "linux")]
    {
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

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        let ps_script = r#"
            $paths = @(
                "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
                "$env:AppData\Microsoft\Windows\Start Menu\Programs"
            )
            $shortcuts = Get-ChildItem -Path $paths -Recurse -Include *.lnk -ErrorAction SilentlyContinue
            $apps = @()
            $shell = New-Object -ComObject WScript.Shell
            foreach ($s in $shortcuts) {
                try {
                    $shortcut = $shell.CreateShortcut($s.FullName)
                    $target = $shortcut.TargetPath
                    if ($target -match "\.exe$" -and $target -and (Test-Path $target -ErrorAction SilentlyContinue)) {
                        # Get icon location
                        $rawIconLocation = $shortcut.IconLocation

                        # Determine final icon location
                        $iconLocation = $null
                        if (-not [string]::IsNullOrWhiteSpace($rawIconLocation)) {
                            # Expand environment variables (e.g., %windir%)
                            $expanded = [Environment]::ExpandEnvironmentVariables($rawIconLocation)
                            
                            # Parse icon location which might be in format "path,index" or "path,-index" or just ",index"
                            if ($expanded -match '^,') {
                                # Starts with comma (just index), use target exe
                                $iconLocation = "$target,0"
                            } elseif ($expanded -match '^(.+?),(-?\d+)$') {
                                $iconPath = $Matches[1]
                                if ($iconPath -and (Test-Path $iconPath -ErrorAction SilentlyContinue)) {
                                    $iconLocation = $expanded
                                } else {
                                    $iconLocation = "$target,0"
                                }
                            } elseif ($expanded -match '\.(exe|dll|ico)$') {
                                if (Test-Path $expanded -ErrorAction SilentlyContinue) {
                                    $iconLocation = "$expanded,0"
                                } else {
                                    $iconLocation = "$target,0"
                                }
                            } else {
                                $iconLocation = "$target,0"
                            }
                        } else {
                            # No icon specified in shortcut, use the target exe
                            $iconLocation = "$target,0"
                        }

                        # Sanitize name - remove control characters and trim
                        $appName = $s.BaseName -replace '[\x00-\x1F\x7F]', '' | ForEach-Object { $_.Trim() }
                        
                        # Convert empty strings to null for optional fields and sanitize
                        $descValue = $null
                        if (-not [string]::IsNullOrWhiteSpace($shortcut.Description)) {
                            # Remove control characters and trim
                            $descValue = $shortcut.Description -replace '[\x00-\x1F\x7F]', ''
                            $descValue = $descValue.Trim()
                            if ([string]::IsNullOrWhiteSpace($descValue)) {
                                $descValue = $null
                            }
                        }

                        $apps += @{
                            name = $appName
                            exec = $target
                            icon = $iconLocation
                            description = $descValue
                            desktop_file = $s.FullName
                            categories = @()
                        }
                    }
                } catch {}
            }
            $apps | ConvertTo-Json -Depth 2
        "#;

        let output = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-Command",
                &format!(
                    r#"
                    $OutputEncoding = [System.Text.Encoding]::UTF8
                    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
                    [Console]::InputEncoding = [System.Text.Encoding]::UTF8
                    chcp 65001 | Out-Null
                    {}
                    "#,
                    ps_script
                )
            ])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();

        if let Ok(output) = output {
            eprintln!("[Rust] PowerShell exit code: {:?}", output.status.code());

            let stderr = String::from_utf8_lossy(&output.stderr);
            if !stderr.is_empty() {
                eprintln!("[Rust] PowerShell stderr: {}", stderr);
            }

            // Try to decode the output, handling different encodings
            let json = decode_powershell_output(&output.stdout);

            eprintln!("[Rust] JSON length: {}", json.len());

            if json.trim().is_empty() {
                eprintln!("[Rust] Warning: PowerShell returned empty output");
                return Vec::new();
            }

            // PowerShell might return a single object or an array.
            // If it's a single object, it won't be a JSON array.
            // But we initialized $apps as @(), so it should be an array.
            match serde_json::from_str::<Vec<Application>>(&json) {
                Ok(apps) => {
                    eprintln!("[Rust] Successfully parsed {} applications", apps.len());
                    let mut apps = apps;
                    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
                    return apps;
                }
                Err(_e) => {
                    eprintln!("[Rust] JSON parse error: {}", _e);
                    eprintln!("[Rust] First 500 chars of JSON: {}", &json[..json.len().min(500)]);
                }
            }
        } else {
            eprintln!("[Rust] Failed to execute PowerShell command");
        }

        Vec::new()
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        Vec::new()
    }
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

#[tauri::command]
async fn show_window(window: tauri::Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn hide_window(window: tauri::Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn toggle_window(window: tauri::Window) -> Result<(), String> {
    let is_visible = window.is_visible().map_err(|e| e.to_string())?;
    if is_visible {
        window.hide().map_err(|e| e.to_string())?;
    } else {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_icon_data_url(icon_path: String) -> Result<String, String> {
    use std::io::Read;
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

    // Handle Windows exe/dll/ico icon extraction
    #[cfg(target_os = "windows")]
    {
        if icon_path.ends_with(".exe") || icon_path.contains(".exe,") ||
           icon_path.ends_with(".dll") || icon_path.contains(".dll,") ||
           (icon_path.ends_with(".ico") && icon_path.contains(",")) {
            return extract_windows_icon(&icon_path);
        }
    }

    // Ler o arquivo de ícone
    let mut file = fs::File::open(&icon_path).map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;

    // Determinar o mime type baseado na extensão
    let mime_type = if icon_path.ends_with(".svg") {
        "image/svg+xml"
    } else if icon_path.ends_with(".png") {
        "image/png"
    } else if icon_path.ends_with(".jpg") || icon_path.ends_with(".jpeg") {
        "image/jpeg"
    } else if icon_path.ends_with(".xpm") {
        "image/x-xpixmap"
    } else if icon_path.ends_with(".ico") {
        "image/x-icon"
    } else {
        "application/octet-stream"
    };

    // Codificar em base64
    let base64_data = BASE64.encode(&buffer);

    // Retornar como data URL
    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}

#[cfg(target_os = "windows")]
fn extract_windows_icon(icon_path: &str) -> Result<String, String> {
    use std::os::windows::process::CommandExt;

    // Parse icon location (format can be "path.exe" or "path.exe,index")
    let parts: Vec<&str> = icon_path.split(',').collect();
    let exe_path = parts[0].trim();

    // Validate that exe_path is not empty
    if exe_path.is_empty() {
        return Err("Empty icon path".to_string());
    }

    // Validate that the file exists
    if !Path::new(exe_path).exists() {
        return Err(format!("Icon file not found: {}", exe_path));
    }

    let _icon_index = parts.get(1)
        .and_then(|s| s.trim().parse::<i32>().ok())
        .unwrap_or(0);

    // Use PowerShell to extract icon as base64
    // Note: ExtractAssociatedIcon doesn't support icon indices, so we use a simpler approach for now
    // For DLLs with specific indices, this will just get the default icon
    let ps_script = format!(
        r#"
        Add-Type -AssemblyName System.Drawing
        try {{
            # For .ico files, read directly
            if ("{}" -match '\.ico$') {{
                $bytes = [System.IO.File]::ReadAllBytes("{}")
                [Convert]::ToBase64String($bytes)
            }} else {{
                # For exe/dll, extract associated icon
                $icon = [System.Drawing.Icon]::ExtractAssociatedIcon("{}")
                if ($icon) {{
                    $bitmap = $icon.ToBitmap()
                    $ms = New-Object System.IO.MemoryStream
                    $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
                    $bytes = $ms.ToArray()
                    $ms.Close()
                    [Convert]::ToBase64String($bytes)
                }}
            }}
        }} catch {{
            Write-Error $_.Exception.Message
        }}
        "#,
        exe_path.replace("\\", "\\\\").replace("\"", "\\\""),
        exe_path.replace("\\", "\\\\").replace("\"", "\\\""),
        exe_path.replace("\\", "\\\\").replace("\"", "\\\"")
    );

    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &ps_script])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("PowerShell error: {}", stderr));
    }

    let base64_data = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if base64_data.is_empty() {
        return Err("No icon data extracted".to_string());
    }

    Ok(format!("data:image/png;base64,{}", base64_data))
}

/// Extract multiple icons in a single PowerShell call for better performance
#[tauri::command]
#[cfg(target_os = "windows")]
fn get_icons_batch(icon_paths: Vec<String>) -> Vec<Option<String>> {
    use std::os::windows::process::CommandExt;
    
    if icon_paths.is_empty() {
        return Vec::new();
    }
    
    eprintln!("[Rust] Extracting {} icons in batch", icon_paths.len());
    
    // Build JSON array of paths for PowerShell
    let paths_json: Vec<String> = icon_paths.iter()
        .map(|p| {
            let parts: Vec<&str> = p.split(',').collect();
            let exe_path = parts[0].trim();
            format!("\"{}\"", exe_path.replace("\\", "\\\\").replace("\"", "\\\""))
        })
        .collect();
    
    let ps_script = format!(
        r#"
        Add-Type -AssemblyName System.Drawing
        $paths = @({})
        $results = @()
        foreach ($path in $paths) {{
            try {{
                if (-not (Test-Path $path)) {{
                    $results += $null
                    continue
                }}
                if ($path -match '\.ico$') {{
                    $bytes = [System.IO.File]::ReadAllBytes($path)
                    $results += [Convert]::ToBase64String($bytes)
                }} else {{
                    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($path)
                    if ($icon) {{
                        $bitmap = $icon.ToBitmap()
                        $ms = New-Object System.IO.MemoryStream
                        $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
                        $bytes = $ms.ToArray()
                        $ms.Close()
                        $bitmap.Dispose()
                        $icon.Dispose()
                        $results += [Convert]::ToBase64String($bytes)
                    }} else {{
                        $results += $null
                    }}
                }}
            }} catch {{
                $results += $null
            }}
        }}
        $results | ConvertTo-Json -Compress
        "#,
        paths_json.join(",")
    );
    
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-Command",
            &ps_script
        ])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();
    
    match output {
        Ok(output) => {
            let json_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            
            // Parse the JSON array
            if let Ok(results) = serde_json::from_str::<Vec<Option<String>>>(&json_str) {
                eprintln!("[Rust] Successfully extracted {} icons", results.iter().filter(|x| x.is_some()).count());
                return results.into_iter()
                    .map(|opt| opt.map(|b64| format!("data:image/png;base64,{}", b64)))
                    .collect();
            }
            
            // If it's a single value (not array), handle that case
            if let Ok(single) = serde_json::from_str::<Option<String>>(&json_str) {
                return vec![single.map(|b64| format!("data:image/png;base64,{}", b64))];
            }
            
            eprintln!("[Rust] Failed to parse icons JSON: {}", &json_str[..json_str.len().min(200)]);
        }
        Err(e) => {
            eprintln!("[Rust] Failed to execute PowerShell for batch icons: {}", e);
        }
    }
    
    // Return empty results on failure
    vec![None; icon_paths.len()]
}

fn process_cli_args(app: &tauri::AppHandle, args: Vec<String>) {
    if args.len() <= 1 {
        // Sem argumentos, apenas mostrar a janela
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
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
        Some("--help") | Some("-h") => {
            println!("lowCast - Desktop launcher and clipboard manager");
            println!("\nUsage: lowcast [COMMAND]\n");
            println!("Commands:");
            println!("  --show, (default)    Show the window");
            println!("  --hide               Hide the window");
            println!("  --toggle             Toggle window visibility");
            println!("  --history            Show clipboard history");
            println!("  --clipboard          Alias for --history");
            println!("  --apps               Show applications list");
            println!("  --home               Show home/search page");
            println!("  --help, -h           Show this help message");
        }
        _ => {
            // Argumento desconhecido ou sem argumentos, apenas mostrar
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
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
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Quando uma segunda instância é iniciada, processar os argumentos
            println!("Segunda instância detectada com args: {:?}", args);
            process_cli_args(app, args);
        }))
        .invoke_handler(tauri::generate_handler![
            list_applications,
            launch_application,
            show_window,
            hide_window,
            toggle_window,
            get_icon_data_url,
            get_icons_batch
        ])
        .setup(|app| {
            // Posicionar a janela
            if let Some(window) = app.get_webview_window("main") {
                // Tentar centralizar horizontalmente e posicionar levemente abaixo do topo
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let screen_size = monitor.size();
                    let window_size = window.outer_size().unwrap_or(tauri::PhysicalSize { width: 800, height: 600 });

                    let x = (screen_size.width as i32 - window_size.width as i32) / 2;
                    // 15% da altura da tela para baixo
                    let y = (screen_size.height as f64 * 0.40) as i32;

                    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
                }
            }

            // Criar diretório de dados da app se não existir
            let app_data_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();

            // Processar argumentos CLI na primeira inicialização
            let args: Vec<String> = std::env::args().collect();
            process_cli_args(&app.handle(), args);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
