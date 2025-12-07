use base64::{engine::general_purpose::STANDARD, Engine};
use image::{codecs::png::PngEncoder, ExtendedColorType, ImageEncoder};
use std::io::Cursor;

/// Converte RGBA bruto para PNG comprimido lossless e salva no caminho especificado
#[tauri::command]
pub fn rgba_to_png(
    rgba_base64: String,
    width: u32,
    height: u32,
    output_path: String,
) -> Result<String, String> {
    // Decodificar RGBA base64
    let rgba_bytes = STANDARD
        .decode(&rgba_base64)
        .map_err(|e| format!("Erro ao decodificar base64: {}", e))?;

    let expected_size = (width * height * 4) as usize;
    if rgba_bytes.len() != expected_size {
        return Err(format!(
            "Tamanho RGBA incorreto: esperado {}, recebido {}",
            expected_size,
            rgba_bytes.len()
        ));
    }

    // Buffer para output PNG
    let mut output = Cursor::new(Vec::new());

    // Encoder PNG com compressão máxima (lossless)
    let encoder = PngEncoder::new_with_quality(
        &mut output,
        image::codecs::png::CompressionType::Best,
        image::codecs::png::FilterType::Adaptive,
    );

    encoder
        .write_image(&rgba_bytes, width, height, ExtendedColorType::Rgba8)
        .map_err(|e| format!("Erro ao criar PNG: {}", e))?;

    // Salvar arquivo
    let compressed = output.into_inner();
    std::fs::write(&output_path, &compressed)
        .map_err(|e| format!("Erro ao salvar arquivo: {}", e))?;

    let rgba_size = rgba_bytes.len();
    let png_size = compressed.len();

    Ok(format!(
        "RGBA {}KB -> PNG {}KB ({}%)",
        rgba_size / 1024,
        png_size / 1024,
        (png_size as f64 / rgba_size as f64 * 100.0) as u32
    ))
}

/// Comprime PNG existente (mantido para compatibilidade)
#[tauri::command]
pub fn compress_png(base64_data: String, output_path: String) -> Result<String, String> {
    // Decodificar base64
    let png_bytes = STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Erro ao decodificar base64: {}", e))?;

    // Carregar imagem
    let img = image::load_from_memory(&png_bytes)
        .map_err(|e| format!("Erro ao carregar imagem: {}", e))?;

    // Converter para RGBA8
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    // Buffer para output
    let mut output = Cursor::new(Vec::new());

    // Encoder PNG com compressão máxima (lossless)
    let encoder = PngEncoder::new_with_quality(
        &mut output,
        image::codecs::png::CompressionType::Best,
        image::codecs::png::FilterType::Adaptive,
    );

    encoder
        .write_image(&rgba, width, height, ExtendedColorType::Rgba8)
        .map_err(|e| format!("Erro ao comprimir PNG: {}", e))?;

    // Salvar arquivo
    let compressed = output.into_inner();
    std::fs::write(&output_path, &compressed)
        .map_err(|e| format!("Erro ao salvar arquivo: {}", e))?;

    let original_size = png_bytes.len();
    let compressed_size = compressed.len();
    let ratio = (compressed_size as f64 / original_size as f64 * 100.0) as u32;

    Ok(format!(
        "Comprimido: {}KB -> {}KB ({}%)",
        original_size / 1024,
        compressed_size / 1024,
        ratio
    ))
}
