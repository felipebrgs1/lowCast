//! Windows-specific application discovery

use super::Application;
use crate::encoding::decode_powershell_output;
use std::os::windows::process::CommandExt;

/// PowerShell script to list Start Menu shortcuts
const PS_LIST_APPS: &str = r#"
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
            $rawIconLocation = $shortcut.IconLocation

            $iconLocation = $null
            if (-not [string]::IsNullOrWhiteSpace($rawIconLocation)) {
                $expanded = [Environment]::ExpandEnvironmentVariables($rawIconLocation)
                
                if ($expanded -match '^,') {
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
                $iconLocation = "$target,0"
            }

            $appName = $s.BaseName -replace '[\x00-\x1F\x7F]', '' | ForEach-Object { $_.Trim() }
            
            $descValue = $null
            if (-not [string]::IsNullOrWhiteSpace($shortcut.Description)) {
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

/// List all installed applications on Windows
pub fn list_applications_windows() -> Vec<Application> {
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &format!(
                r#"
                $OutputEncoding = [System.Text.Encoding]::UTF8
                [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
                [Console]::InputEncoding = [System.Text.Encoding]::UTF8
                chcp 65001 | Out-Null
                {}
                "#,
                PS_LIST_APPS
            ),
        ])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();

    if let Ok(output) = output {
        eprintln!("[Rust] PowerShell exit code: {:?}", output.status.code());

        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.is_empty() {
            eprintln!("[Rust] PowerShell stderr: {}", stderr);
        }

        let json = decode_powershell_output(&output.stdout);
        eprintln!("[Rust] JSON length: {}", json.len());

        if json.trim().is_empty() {
            eprintln!("[Rust] Warning: PowerShell returned empty output");
            return Vec::new();
        }

        match serde_json::from_str::<Vec<Application>>(&json) {
            Ok(mut apps) => {
                eprintln!("[Rust] Successfully parsed {} applications", apps.len());
                apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
                return apps;
            }
            Err(e) => {
                eprintln!("[Rust] JSON parse error: {}", e);
                eprintln!(
                    "[Rust] First 500 chars of JSON: {}",
                    &json[..json.len().min(500)]
                );
            }
        }
    } else {
        eprintln!("[Rust] Failed to execute PowerShell command");
    }

    Vec::new()
}
