import { appDataDir, join } from "@tauri-apps/api/path";
import * as clipboard from "@tauri-apps/plugin-clipboard-manager";
import { exists, mkdir, readFile, writeFile } from "@tauri-apps/plugin-fs";
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

// Salvar imagem como PNG (compatível com clipboard do Windows)
async function saveImageToFile(base64Data: string): Promise<string> {
	const dataDir = await appDataDir();
	const imagesDir = await join(dataDir, "clipboard_images");

	if (!(await exists(imagesDir))) {
		await mkdir(imagesDir, { recursive: true });
	}

	const hash = await hashContent(base64Data.slice(0, 500));
	const filename = `${hash.slice(0, 16)}.png`; // PNG para compatibilidade
	const filepath = await join(imagesDir, filename);

	if (!(await exists(filepath))) {
		const binaryString = atob(base64Data);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		await writeFile(filepath, bytes);
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
		const hash = await hashContent(type === "text" ? content : content.slice(0, 500));
		let finalContent = content;
		let preview: string | null = null;

		if (type === "text") {
			preview = content.slice(0, 200);
		} else {
			finalContent = await saveImageToFile(content);
			preview = finalContent;
		}

		await addClipboardEntry(type, finalContent, preview, hash);
		await loadHistory();
	} catch (error) {
		console.error("[Clipboard] Error in addEntry:", error);
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

					// Criar canvas para converter RGBA para PNG
					const canvas = document.createElement("canvas");
					const ctx = canvas.getContext("2d");

					if (ctx) {
						canvas.width = size.width;
						canvas.height = size.height;
						const imageData = new ImageData(new Uint8ClampedArray(rgba), size.width, size.height);
						ctx.putImageData(imageData, 0, 0);

						// Salvar como PNG (compatível com clipboard)
						const dataUrl = canvas.toDataURL("image/png");
						const base64 = dataUrl.split(",")[1];
						console.log(`[Clipboard] PNG size: ${(base64.length / 1024).toFixed(0)}KB`);

						lastImageHash = quickHash;
						await addEntry("image", base64);

						// Limpar canvas
						ctx.clearRect(0, 0, canvas.width, canvas.height);
						canvas.width = 0;
						canvas.height = 0;
					}
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
