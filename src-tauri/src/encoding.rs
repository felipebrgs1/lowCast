//! Encoding utilities for handling PowerShell output

/// Decode PowerShell output handling different encodings (UTF-8, UTF-16 LE/BE, Windows-1252)
#[cfg(target_os = "windows")]
pub fn decode_powershell_output(bytes: &[u8]) -> String {
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
