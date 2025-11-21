import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDatabase(): Promise<Database> {
	if (db) return db;

	console.log("[Database] Initializing SQLite...");
	try {
		db = await Database.load("sqlite:lowcast.db");
		console.log("[Database] SQLite loaded successfully");
		await initSchema();
		console.log("[Database] Schema initialized");
		return db;
	} catch (error) {
		console.error("[Database] Failed to initialize:", error);
		throw error;
	}
}

async function initSchema() {
	if (!db) return;

	// Tabela de histórico de clipboard
	await db.execute(`
    CREATE TABLE IF NOT EXISTS clipboard_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_type TEXT NOT NULL CHECK(content_type IN ('text', 'image')),
      content TEXT NOT NULL,
      preview TEXT,
      hash TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

	// Índice para busca rápida
	await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_clipboard_created_at
    ON clipboard_history(created_at DESC)
  `);

	// Índice para evitar duplicatas via hash
	await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_clipboard_hash
    ON clipboard_history(hash)
  `);
}

export interface ClipboardEntry {
	id: number;
	content_type: "text" | "image";
	content: string;
	preview: string | null;
	hash: string;
	created_at: string;
}

// Funções de clipboard
export async function addClipboardEntry(
	contentType: "text" | "image",
	content: string,
	preview: string | null,
	hash: string,
): Promise<void> {
	console.log("[Database] addClipboardEntry called");
	const database = await getDatabase();

	// Usar INSERT OR REPLACE para atualizar timestamp se já existir
	console.log("[Database] Executing INSERT...");
	const result = await database.execute(
		`INSERT INTO clipboard_history (content_type, content, preview, hash, created_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT(hash) DO UPDATE SET created_at = CURRENT_TIMESTAMP`,
		[contentType, content, preview, hash],
	);
	console.log("[Database] INSERT result:", result);
}

export async function getClipboardHistory(limit = 100): Promise<ClipboardEntry[]> {
	const database = await getDatabase();
	return await database.select<ClipboardEntry[]>(
		"SELECT * FROM clipboard_history ORDER BY created_at DESC LIMIT $1",
		[limit],
	);
}

export async function deleteClipboardEntry(id: number): Promise<void> {
	const database = await getDatabase();
	await database.execute("DELETE FROM clipboard_history WHERE id = $1", [id]);
}

export async function clearClipboardHistory(): Promise<void> {
	const database = await getDatabase();
	await database.execute("DELETE FROM clipboard_history");
}

export async function searchClipboardHistory(query: string): Promise<ClipboardEntry[]> {
	const database = await getDatabase();
	return await database.select<ClipboardEntry[]>(
		`SELECT * FROM clipboard_history
     WHERE content_type = 'text' AND content LIKE $1
     ORDER BY created_at DESC LIMIT 100`,
		[`%${query}%`],
	);
}
