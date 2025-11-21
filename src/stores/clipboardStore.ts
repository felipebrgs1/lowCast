import { create } from "zustand";
import {
  type ClipboardEntry,
  addClipboardEntry,
  clearClipboardHistory,
  deleteClipboardEntry,
  getClipboardHistory,
  searchClipboardHistory,
} from "@/lib/database";
import * as clipboard from "@tauri-apps/plugin-clipboard-manager";
import { appDataDir, join } from "@tauri-apps/api/path";
import { writeFile, exists, mkdir } from "@tauri-apps/plugin-fs";

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
    if (entry.content_type === "text") {
      await clipboard.writeText(entry.content);
    } else {
      // Para imagens, ler o arquivo e copiar
      // TODO: implementar cópia de imagem
      await clipboard.writeText(entry.content);
    }
    lastClipboardContent = entry.content;
  },

  startListening: () => {
    if (clipboardInterval) return;

    console.log("[Clipboard] Starting listener...");
    set({ isListening: true });

    clipboardInterval = setInterval(async () => {
      try {
        // Ler texto do clipboard
        const text = await clipboard.readText();
        if (text && text !== lastClipboardContent && text.trim() !== "") {
          console.log("[Clipboard] New content detected, saving...");
          lastClipboardContent = text;
          await get().addEntry("text", text);
          console.log("[Clipboard] Entry saved!");
        }
      } catch (error) {
        // Apenas logar se for erro diferente de clipboard vazio
        if (error instanceof Error && !error.message.includes("empty")) {
          console.error("[Clipboard] Read error:", error);
        }
      }
    }, 500); // Verificar a cada 500ms
  },

  stopListening: () => {
    if (clipboardInterval) {
      clearInterval(clipboardInterval);
      clipboardInterval = null;
    }
    set({ isListening: false });
  },
}));
