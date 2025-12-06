//! Icon extraction utilities

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use std::fs;
use std::io::Read;
use std::path::Path;

/// Get icon data URL for a single icon
#[tauri::command]
pub fn get_icon_data_url(icon_path: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        if icon_path.ends_with(".exe")
            || icon_path.contains(".exe,")
            || icon_path.ends_with(".dll")
            || icon_path.contains(".dll,")
            || (icon_path.ends_with(".ico") && icon_path.contains(","))
        {
            return extract_windows_icon(&icon_path);
        }
    }

    // Read the icon file
    let mut file = fs::File::open(&icon_path).map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;

    // Determine MIME type
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

    let base64_data = BASE64.encode(&buffer);
    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}

/// Extract icon from Windows executable
#[cfg(target_os = "windows")]
fn extract_windows_icon(icon_path: &str) -> Result<String, String> {
    use std::os::windows::process::CommandExt;

    let parts: Vec<&str> = icon_path.split(',').collect();
    let exe_path = parts[0].trim();

    if exe_path.is_empty() {
        return Err("Empty icon path".to_string());
    }

    if !Path::new(exe_path).exists() {
        return Err(format!("Icon file not found: {}", exe_path));
    }

    let ps_script = format!(
        r#"
        Add-Type -AssemblyName System.Drawing
        try {{
            if ("{}" -match '\.ico$') {{
                $bytes = [System.IO.File]::ReadAllBytes("{}")
                [Convert]::ToBase64String($bytes)
            }} else {{
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
        .creation_flags(0x08000000)
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

/// Extract multiple icons in a single PowerShell call (Windows only)
#[tauri::command]
#[cfg(target_os = "windows")]
pub fn get_icons_batch(icon_paths: Vec<String>) -> Vec<Option<String>> {
    use std::os::windows::process::CommandExt;

    if icon_paths.is_empty() {
        return Vec::new();
    }

    eprintln!("[Rust] Extracting {} icons in batch", icon_paths.len());

    let paths_json: Vec<String> = icon_paths
        .iter()
        .map(|p| {
            let parts: Vec<&str> = p.split(',').collect();
            let exe_path = parts[0].trim();
            format!(
                "\"{}\"",
                exe_path.replace("\\", "\\\\").replace("\"", "\\\"")
            )
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
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &ps_script,
        ])
        .creation_flags(0x08000000)
        .output();

    match output {
        Ok(output) => {
            let json_str = String::from_utf8_lossy(&output.stdout).trim().to_string();

            if let Ok(results) = serde_json::from_str::<Vec<Option<String>>>(&json_str) {
                eprintln!(
                    "[Rust] Successfully extracted {} icons",
                    results.iter().filter(|x| x.is_some()).count()
                );
                return results
                    .into_iter()
                    .map(|opt| opt.map(|b64| format!("data:image/png;base64,{}", b64)))
                    .collect();
            }

            if let Ok(single) = serde_json::from_str::<Option<String>>(&json_str) {
                return vec![single.map(|b64| format!("data:image/png;base64,{}", b64))];
            }

            eprintln!(
                "[Rust] Failed to parse icons JSON: {}",
                &json_str[..json_str.len().min(200)]
            );
        }
        Err(e) => {
            eprintln!("[Rust] Failed to execute PowerShell for batch icons: {}", e);
        }
    }

    vec![None; icon_paths.len()]
}

/// Stub for non-Windows platforms
#[tauri::command]
#[cfg(not(target_os = "windows"))]
pub fn get_icons_batch(_icon_paths: Vec<String>) -> Vec<Option<String>> {
    Vec::new()
}
