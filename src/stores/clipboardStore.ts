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

// Função para gerar hash simples do conteúdo
async function hashContent(content: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(content);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Salvar imagem como arquivo e retornar o path
async function saveImageToFile(base64Data: string): Promise<string> {
	const dataDir = await appDataDir();
	const imagesDir = await join(dataDir, "clipboard_images");

	// Criar diretório se não existir
	if (!(await exists(imagesDir))) {
		await mkdir(imagesDir, { recursive: true });
	}

	const hash = await hashContent(base64Data);
	const filename = `${hash.slice(0, 16)}.png`;
	const filepath = await join(imagesDir, filename);

	// Verificar se já existe
	if (!(await exists(filepath))) {
		// Converter base64 para bytes
		const binaryString = atob(base64Data);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		await writeFile(filepath, bytes);
	}

	return filepath;
}

let clipboardInterval: ReturnType<typeof setInterval> | null = null;
let lastClipboardContent = "";
// Canvas reutilizável para evitar leak de memória
let reusableCanvas: HTMLCanvasElement | null = null;
let reusableCtx: CanvasRenderingContext2D | null = null;

function getReusableCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
	if (!reusableCanvas) {
		reusableCanvas = document.createElement("canvas");
		reusableCtx = reusableCanvas.getContext("2d");
	}
	if (!reusableCtx) return null;
	return { canvas: reusableCanvas, ctx: reusableCtx };
}

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
		console.log("[Clipboard] Loading history...");
		const entries = await getClipboardHistory();
		console.log("[Clipboard] Loaded entries:", entries.length);
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
		console.log("[Clipboard] addEntry called, type:", type);
		const hash = await hashContent(content);
		console.log("[Clipboard] Hash generated:", hash.slice(0, 8));
		let finalContent = content;
		let preview: string | null = null;

		if (type === "text") {
			preview = content.slice(0, 200);
		} else {
			finalContent = await saveImageToFile(content);
			preview = finalContent;
		}

		console.log("[Clipboard] Saving to database...");
		await addClipboardEntry(type, finalContent, preview, hash);
		console.log("[Clipboard] Saved! Reloading history...");
		await loadHistory();
		console.log("[Clipboard] History reloaded!");
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
			lastClipboardContent = entry.content;
		} else {
			// Ler o arquivo de imagem
			const imageBytes = await readFile(entry.content);
			// Escrever imagem no clipboard diretamente com os bytes
			await clipboard.writeImage(imageBytes);
		}
	} catch (error) {
		console.error("[Clipboard] Error copying to clipboard:", error);
	}
}

export function startListening() {
	if (clipboardInterval) return;

	console.log("[Clipboard] Starting listener...");
	setClipboardStore({ isListening: true });

	clipboardInterval = setInterval(async () => {
		try {
			let contentProcessed = false;

			// 1. Tentar ler texto
			try {
				const text = await clipboard.readText();
				if (text && text !== lastClipboardContent && text.trim() !== "") {
					console.log("[Clipboard] New text detected, saving...");
					lastClipboardContent = text;
					await addEntry("text", text);
					console.log("[Clipboard] Text entry saved!");
					contentProcessed = true;
				}
			} catch (_e) {
				// Ignorar erros de leitura de texto
			}

			// 2. Tentar ler imagem (apenas se não processamos texto)
			if (!contentProcessed) {
				try {
					const image = await clipboard.readImage();
					if (image) {
						// Converter para base64 PNG usando canvas reutilizável
						const size = await image.size();
						const rgba = await image.rgba();

						const canvasResult = getReusableCanvas();
						if (canvasResult) {
							const { canvas, ctx } = canvasResult;
							canvas.width = size.width;
							canvas.height = size.height;
							const imageData = new ImageData(new Uint8ClampedArray(rgba), size.width, size.height);
							ctx.putImageData(imageData, 0, 0);
							const dataUrl = canvas.toDataURL("image/png");
							const base64 = dataUrl.split(",")[1];

							// Verificar hash para evitar duplicatas
							const hash = await hashContent(base64);
							const contentKey = `image:${hash}`;

							if (lastClipboardContent !== contentKey) {
								console.log("[Clipboard] New image detected, saving...");
								lastClipboardContent = contentKey;
								await addEntry("image", base64);
								console.log("[Clipboard] Image entry saved!");
							}

							// Limpar o contexto para liberar memória
							ctx.clearRect(0, 0, canvas.width, canvas.height);
						}
					}
				} catch (_e) {
					// Erro ao ler imagem ou clipboard vazio
				}
			}
		} catch (error) {
			if (error instanceof Error && !error.message.includes("empty")) {
				console.error("[Clipboard] Read error:", error);
			}
		}
	}, 1000); // Verificar a cada 1s
}

export function stopListening() {
	if (clipboardInterval) {
		clearInterval(clipboardInterval);
		clipboardInterval = null;
	}
	// Limpar canvas reutilizável para liberar memória
	if (reusableCanvas && reusableCtx) {
		reusableCtx.clearRect(0, 0, reusableCanvas.width, reusableCanvas.height);
	}
	// Limpar lastClipboardContent para evitar retenção de strings grandes
	lastClipboardContent = "";
	setClipboardStore({ isListening: false });
}
