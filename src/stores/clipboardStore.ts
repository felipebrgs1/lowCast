import { invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import * as clipboard from "@tauri-apps/plugin-clipboard-manager";
import { exists, mkdir, readFile } from "@tauri-apps/plugin-fs";
import { createStore } from "solid-js/store";
import {
	addClipboardEntry,
	type ClipboardEntry,
	clearClipboardHistory,
	deleteClipboardEntry,
	getClipboardHistory,
	searchClipboardHistory,
} from "@/lib/database";

interface ClipboardState {
	entries: ClipboardEntry[];
	isLoading: boolean;
	searchQuery: string;
	isListening: boolean;
}

// Hash simples do conteúdo
async function hashContent(content: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(content);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Salvar imagem RGBA como PNG comprimido (lossless via Rust)
async function saveImageFromRgba(rgbaBase64: string, width: number, height: number): Promise<string> {
	const dataDir = await appDataDir();
	const imagesDir = await join(dataDir, "clipboard_images");

	if (!(await exists(imagesDir))) {
		await mkdir(imagesDir, { recursive: true });
	}

	// Hash rápido usando dimensões + primeiros bytes
	const hash = await hashContent(`${width}x${height}:${rgbaBase64.slice(0, 200)}`);
	const filename = `${hash.slice(0, 16)}.png`;
	const filepath = await join(imagesDir, filename);

	if (!(await exists(filepath))) {
		// Enviar RGBA direto para Rust converter para PNG comprimido
		const result = await invoke<string>("rgba_to_png", {
			rgbaBase64,
			width,
			height,
			outputPath: filepath,
		});
		console.log(`[Clipboard] ${result}`);
	}

	return filepath;
}

// Intervalos e estado
let textInterval: ReturnType<typeof setTimeout> | null = null;
let imageInterval: ReturnType<typeof setTimeout> | null = null;
let lastTextContent = "";
let lastImageHash = ""; // Hash da imagem ao invés de tamanho
let isProcessingText = false;
let isProcessingImage = false;

const [clipboardStore, setClipboardStore] = createStore<ClipboardState>({
	entries: [],
	isLoading: false,
	searchQuery: "",
	isListening: false,
});

export { clipboardStore };

export async function loadHistory() {
	setClipboardStore({ isLoading: true });
	try {
		const entries = await getClipboardHistory();
		setClipboardStore({ entries });
	} catch (error) {
		console.error("[Clipboard] Error loading history:", error);
	} finally {
		setClipboardStore({ isLoading: false });
	}
}

export async function searchClipboard(query: string) {
	setClipboardStore({ searchQuery: query, isLoading: true });
	try {
		if (query.trim() === "") {
			const entries = await getClipboardHistory();
			setClipboardStore({ entries });
		} else {
			const entries = await searchClipboardHistory(query);
			setClipboardStore({ entries });
		}
	} finally {
		setClipboardStore({ isLoading: false });
	}
}

export async function addEntry(type: "text" | "image", content: string) {
	try {
		const hash = await hashContent(content.slice(0, 500));
		const preview = content.slice(0, 200);
		await addClipboardEntry(type, content, preview, hash);
		await loadHistory();
	} catch (error) {
		console.error("[Clipboard] Error in addEntry:", error);
	}
}

// Adicionar imagem a partir de RGBA (envia direto para Rust)
export async function addImageEntry(rgbaBase64: string, width: number, height: number) {
	try {
		const hash = await hashContent(`${width}x${height}:${rgbaBase64.slice(0, 200)}`);
		const filepath = await saveImageFromRgba(rgbaBase64, width, height);
		await addClipboardEntry("image", filepath, filepath, hash);
		await loadHistory();
	} catch (error) {
		console.error("[Clipboard] Error in addImageEntry:", error);
	}
}

export async function deleteEntry(id: number) {
	await deleteClipboardEntry(id);
	await loadHistory();
}

export async function clearHistory() {
	await clearClipboardHistory();
	setClipboardStore({ entries: [] });
}

export async function copyToClipboard(entry: ClipboardEntry) {
	try {
		if (entry.content_type === "text") {
			await clipboard.writeText(entry.content);
			lastTextContent = entry.content;
		} else {
			const imageBytes = await readFile(entry.content);
			await clipboard.writeImage(imageBytes);
			lastImageHash = "copied"; // Marcar para não re-detectar
		}
	} catch (error) {
		console.error("[Clipboard] Error copying to clipboard:", error);
	}
}

// Polling de TEXTO - leve
async function pollText() {
	if (!clipboardStore.isListening) return;
	if (isProcessingText) {
		textInterval = setTimeout(pollText, 2000);
		return;
	}

	isProcessingText = true;

	try {
		const text = await clipboard.readText();
		if (text && text !== lastTextContent && text.trim() !== "") {
			lastTextContent = text;
			await addEntry("text", text);
		}
	} catch {
		// Ignorar erros
	}

	isProcessingText = false;

	if (clipboardStore.isListening) {
		textInterval = setTimeout(pollText, 2000);
	}
}

// Polling de IMAGEM - pesado, menos frequente
async function pollImage() {
	if (!clipboardStore.isListening) return;
	if (isProcessingImage) {
		imageInterval = setTimeout(pollImage, 15000); // Esperar mais se ainda processando
		return;
	}

	isProcessingImage = true;

	try {
		const image = await clipboard.readImage();
		if (image) {
			const size = await image.size();

			// Criar hash rápido para detecção de mudança
			const quickHash = `${size.width}x${size.height}`;

			if (quickHash !== lastImageHash && size.width > 0) {
				console.log(`[Clipboard] New image: ${size.width}x${size.height}`);

				// Limite de 33 megapixels (permite até 8K: 7680x4320)
				if (size.width * size.height > 33177600) {
					console.log(`[Clipboard] Image too large, skipping (${size.width}x${size.height})`);
					lastImageHash = quickHash;
				} else {
					const rgba = await image.rgba();
					console.log(`[Clipboard] RGBA: ${(rgba.byteLength / 1024 / 1024).toFixed(1)}MB`);

					// Converter Uint8Array para base64 e enviar direto para Rust
					let binary = "";
					const bytes = new Uint8Array(rgba);
					const len = bytes.byteLength;
					for (let i = 0; i < len; i++) {
						binary += String.fromCharCode(bytes[i]);
					}
					const rgbaBase64 = btoa(binary);

					lastImageHash = quickHash;
					await addImageEntry(rgbaBase64, size.width, size.height);
				}
			}
		}
	} catch {
		// Ignorar erros de imagem
	}

	isProcessingImage = false;

	if (clipboardStore.isListening) {
		imageInterval = setTimeout(pollImage, 15000); // Imagem: a cada 15s
	}
}

export function startListening() {
	if (clipboardStore.isListening) return;

	console.log("[Clipboard] Starting listeners...");
	setClipboardStore({ isListening: true });

	textInterval = setTimeout(pollText, 1000);
	imageInterval = setTimeout(pollImage, 3000);
}

export function stopListening() {
	console.log("[Clipboard] Stopping listeners...");

	if (textInterval) {
		clearTimeout(textInterval);
		textInterval = null;
	}
	if (imageInterval) {
		clearTimeout(imageInterval);
		imageInterval = null;
	}

	lastTextContent = "";
	lastImageHash = "";
	isProcessingText = false;
	isProcessingImage = false;
	setClipboardStore({ isListening: false });
}
