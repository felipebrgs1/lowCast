import { appDataDir, join } from "@tauri-apps/api/path";
import * as clipboard from "@tauri-apps/plugin-clipboard-manager";
import { exists, mkdir, writeFile, readFile } from "@tauri-apps/plugin-fs";
import { Image } from "@tauri-apps/api/image";
import { create } from "zustand";
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

	// Actions
	loadHistory: () => Promise<void>;
	search: (query: string) => Promise<void>;
	addEntry: (type: "text" | "image", content: string) => Promise<void>;
	deleteEntry: (id: number) => Promise<void>;
	clearHistory: () => Promise<void>;
	copyToClipboard: (entry: ClipboardEntry) => Promise<void>;
	startListening: () => void;
	stopListening: () => void;
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

export const useClipboardStore = create<ClipboardState>((set, get) => ({
	entries: [],
	isLoading: false,
	searchQuery: "",
	isListening: false,

	loadHistory: async () => {
		set({ isLoading: true });
		try {
			console.log("[Clipboard] Loading history...");
			const entries = await getClipboardHistory();
			console.log("[Clipboard] Loaded entries:", entries.length);
			set({ entries });
		} catch (error) {
			console.error("[Clipboard] Error loading history:", error);
		} finally {
			set({ isLoading: false });
		}
	},

	search: async (query: string) => {
		set({ searchQuery: query, isLoading: true });
		try {
			if (query.trim() === "") {
				const entries = await getClipboardHistory();
				set({ entries });
			} else {
				const entries = await searchClipboardHistory(query);
				set({ entries });
			}
		} finally {
			set({ isLoading: false });
		}
	},

	addEntry: async (type, content) => {
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
			await get().loadHistory();
			console.log("[Clipboard] History reloaded!");
		} catch (error) {
			console.error("[Clipboard] Error in addEntry:", error);
		}
	},

	deleteEntry: async (id) => {
		await deleteClipboardEntry(id);
		await get().loadHistory();
	},

	clearHistory: async () => {
		await clearClipboardHistory();
		set({ entries: [] });
	},

	copyToClipboard: async (entry) => {
		try {
			if (entry.content_type === "text") {
				await clipboard.writeText(entry.content);
				lastClipboardContent = entry.content;
			} else {
				// Ler o arquivo de imagem
				const imageBytes = await readFile(entry.content);
				// Criar objeto Image do Tauri
				const image = await Image.fromBytes(imageBytes);
				// Escrever imagem no clipboard
				// @ts-ignore - writeImage pode não estar na definição de tipos ainda
				await clipboard.writeImage(image);
				
				// Atualizar lastClipboardContent para evitar re-salvar imediatamente
				// Precisamos ler o conteúdo para gerar o hash ou usar o hash existente se possível
				// Aqui vamos usar um identificador especial para imagens copiadas
				// O ideal seria calcular o hash da imagem, mas vamos assumir que se copiamos,
				// não queremos salvar de volta imediatamente.
				// Como o listener verifica o hash do conteúdo do clipboard, se for a mesma imagem,
				// o hash será igual e não salvará duplicado.
			}
		} catch (error) {
			console.error("[Clipboard] Error copying to clipboard:", error);
		}
	},

	startListening: () => {
		if (clipboardInterval) return;

		console.log("[Clipboard] Starting listener...");
		set({ isListening: true });

		clipboardInterval = setInterval(async () => {
			try {
				// 1. Tentar ler texto
				try {
					const text = await clipboard.readText();
					if (text && text !== lastClipboardContent && text.trim() !== "") {
						console.log("[Clipboard] New text detected, saving...");
						lastClipboardContent = text;
						await get().addEntry("text", text);
						console.log("[Clipboard] Text entry saved!");
						return; // Priorizar texto se houver mudança
					}
				} catch (e) {
					// Ignorar erros de leitura de texto
				}

				// 2. Tentar ler imagem
				try {
					// @ts-ignore - readImage pode não estar na definição de tipos ainda
					const image = await clipboard.readImage();
					if (image) {
						// Converter para base64 PNG
						const size = await image.size();
						const rgba = await image.rgba();
						
						const canvas = document.createElement('canvas');
						canvas.width = size.width;
						canvas.height = size.height;
						const ctx = canvas.getContext('2d');
						if (ctx) {
							const imageData = new ImageData(
								new Uint8ClampedArray(rgba),
								size.width,
								size.height
							);
							ctx.putImageData(imageData, 0, 0);
							const dataUrl = canvas.toDataURL('image/png');
							const base64 = dataUrl.split(',')[1];

							// Verificar hash para evitar duplicatas
							const hash = await hashContent(base64);
							// Usar uma variável estática ou estado para armazenar o último hash de imagem seria ideal
							// Mas como lastClipboardContent é string, podemos usar ele se prefixarmos
							const contentKey = `image:${hash}`;
							
							if (lastClipboardContent !== contentKey) {
								console.log("[Clipboard] New image detected, saving...");
								lastClipboardContent = contentKey;
								await get().addEntry("image", base64);
								console.log("[Clipboard] Image entry saved!");
							}
						}
					}
				} catch (e) {
					// Erro ao ler imagem ou clipboard vazio
				}

			} catch (error) {
				if (error instanceof Error && !error.message.includes("empty")) {
					console.error("[Clipboard] Read error:", error);
				}
			}
		}, 1000); // Verificar a cada 1s (aumentado para evitar uso excessivo de CPU com imagens)
	},

	stopListening: () => {
		if (clipboardInterval) {
			clearInterval(clipboardInterval);
			clipboardInterval = null;
		}
		set({ isListening: false });
	},
}));
