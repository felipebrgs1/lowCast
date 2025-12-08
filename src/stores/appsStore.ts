import { invoke } from "@tauri-apps/api/core";
import { createStore } from "solid-js/store";
import { isTauri } from "@/lib/utils";

export interface Application {
	name: string;
	exec: string;
	icon: string;
	iconDataUrl?: string | null;
	description: string | null;
	desktop_file: string;
	categories: string[];
}

interface AppsState {
	applications: Application[];
	filteredApps: Application[];
	isLoading: boolean;
	loadingProgress: number;
	searchQuery: string;
}

// Cache de ícones em memória para evitar re-extrações
// Limite máximo de ícones no cache para evitar leak de memória
const MAX_ICON_CACHE_SIZE = 100;
const iconCache = new Map<string, string | null>();

// Função para adicionar ao cache com limite LRU simples
function addToIconCache(key: string, value: string | null) {
	// Se já existe, deletar e re-adicionar (move para o final - mais recente)
	if (iconCache.has(key)) {
		iconCache.delete(key);
	}
	// Se atingiu o limite, remover os mais antigos
	while (iconCache.size >= MAX_ICON_CACHE_SIZE) {
		const firstKey = iconCache.keys().next().value;
		if (firstKey) iconCache.delete(firstKey);
	}
	iconCache.set(key, value);
}

const [appsStore, setAppsStore] = createStore<AppsState>({
	applications: [],
	filteredApps: [],
	isLoading: false,
	loadingProgress: 0,
	searchQuery: "",
});

export { appsStore };

export async function loadApplications() {
	console.log("[AppsStore] Loading applications...");
	setAppsStore({ isLoading: true, loadingProgress: 0 });

	if (!isTauri()) {
		console.warn("[AppsStore] Not in Tauri environment, skipping load");
		setAppsStore({ isLoading: false, loadingProgress: 100 });
		return;
	}

	try {
		const startTime = performance.now();
		const apps = await invoke<Application[]>("list_applications");
		console.log("[AppsStore] Received apps from Rust:", apps.length);

		// Mostrar apps imediatamente sem ícones
		const appsWithoutIcons = apps.map((app) => ({
			...app,
			iconDataUrl: null,
		}));
		setAppsStore({
			applications: appsWithoutIcons,
			filteredApps: appsWithoutIcons,
			loadingProgress: 20,
		});

		// Filtrar apps com ícones válidos
		const appsWithValidIcons: { app: Application; index: number }[] = [];
		apps.forEach((app, index) => {
			const iconTrimmed = app.icon?.trim() || "";
			const hasValidIcon =
				iconTrimmed.length > 0 &&
				!iconTrimmed.startsWith(",") &&
				/[a-zA-Z]/.test(iconTrimmed) &&
				(iconTrimmed.includes("\\") ||
					iconTrimmed.includes("/") ||
					/\.(exe|dll|ico|png|jpg|svg)$/i.test(iconTrimmed));

			if (hasValidIcon) {
				// Verificar cache primeiro
				if (iconCache.has(app.icon)) {
					// Já temos no cache, não precisa buscar
				} else {
					appsWithValidIcons.push({ app, index });
				}
			}
		});

		console.log("[AppsStore] Apps with valid icons to fetch:", appsWithValidIcons.length);

		// Preparar lista final de apps com ícones do cache
		const appsWithIcons = apps.map((app) => {
			if (iconCache.has(app.icon)) {
				return { ...app, iconDataUrl: iconCache.get(app.icon) };
			}
			return { ...app, iconDataUrl: null };
		});

		// Se há ícones para buscar, usar batch
		if (appsWithValidIcons.length > 0) {
			const iconPaths = appsWithValidIcons.map(({ app }) => app.icon);

			setAppsStore({ loadingProgress: 40 });

			try {
				// Chamar batch de ícones - MUITO mais rápido!
				const iconResults = await invoke<(string | null)[]>("get_icons_batch", {
					iconPaths,
				});

				console.log("[AppsStore] Received batch icons:", iconResults.filter((x) => x).length);

				// Atualizar cache e apps
				iconResults.forEach((iconDataUrl, i) => {
					const { app, index } = appsWithValidIcons[i];
					addToIconCache(app.icon, iconDataUrl ?? null);
					appsWithIcons[index] = {
						...appsWithIcons[index],
						iconDataUrl: iconDataUrl ?? null,
					};
				});
			} catch (batchError) {
				console.warn("[AppsStore] Batch icon loading failed, falling back to individual loading:", batchError);

				// Fallback: carregar individualmente (mais lento)
				for (let i = 0; i < appsWithValidIcons.length; i++) {
					const { app, index } = appsWithValidIcons[i];
					try {
						const dataUrl = await invoke<string>("get_icon_data_url", {
							iconPath: app.icon,
						});
						addToIconCache(app.icon, dataUrl);
						appsWithIcons[index] = {
							...appsWithIcons[index],
							iconDataUrl: dataUrl,
						};
					} catch {
						addToIconCache(app.icon, null);
					}

					// Atualizar progresso
					const progress = 40 + Math.round(((i + 1) / appsWithValidIcons.length) * 55);
					setAppsStore({ loadingProgress: progress });
				}
			}
		}

		const endTime = performance.now();
		console.log(`[AppsStore] Apps with icons loaded in ${Math.round(endTime - startTime)}ms`);

		setAppsStore({
			applications: appsWithIcons,
			filteredApps: appsWithIcons,
			loadingProgress: 100,
		});
	} catch (error) {
		console.error("[AppsStore] Error loading applications:", error);
	} finally {
		setAppsStore({ isLoading: false });
	}
}

export async function refreshApplications() {
	console.log("[AppsStore] Force refreshing applications...");
	setAppsStore({ isLoading: true, loadingProgress: 0 });

	if (!isTauri()) {
		setAppsStore({ isLoading: false, loadingProgress: 100 });
		return;
	}

	try {
		// Clear icon cache
		iconCache.clear();

		// Call Rust command that forces refresh
		const apps = await invoke<Application[]>("refresh_applications");
		console.log("[AppsStore] Refreshed apps from Rust:", apps.length);

		// Show apps immediately without icons
		const appsWithoutIcons = apps.map((app) => ({
			...app,
			iconDataUrl: null,
		}));
		setAppsStore({
			applications: appsWithoutIcons,
			filteredApps: appsWithoutIcons,
			loadingProgress: 20,
		});

		// Load icons in batch
		const appsWithValidIcons: { app: Application; index: number }[] = [];
		apps.forEach((app, index) => {
			const iconTrimmed = app.icon?.trim() || "";
			const hasValidIcon =
				iconTrimmed.length > 0 &&
				!iconTrimmed.startsWith(",") &&
				/[a-zA-Z]/.test(iconTrimmed) &&
				(iconTrimmed.includes("\\") ||
					iconTrimmed.includes("/") ||
					/\.(exe|dll|ico|png|jpg|svg)$/i.test(iconTrimmed));

			if (hasValidIcon) {
				appsWithValidIcons.push({ app, index });
			}
		});

		const appsWithIcons: Application[] = [...appsWithoutIcons];

		if (appsWithValidIcons.length > 0) {
			const iconPaths = appsWithValidIcons.map(({ app }) => app.icon);
			setAppsStore({ loadingProgress: 40 });

			try {
				const iconResults = await invoke<(string | null)[]>("get_icons_batch", { iconPaths });

				iconResults.forEach((iconDataUrl, i) => {
					const { app, index } = appsWithValidIcons[i];
					addToIconCache(app.icon, iconDataUrl ?? null);
					appsWithIcons[index] = {
						...appsWithIcons[index],
						iconDataUrl: iconDataUrl ?? null,
					};
				});
			} catch (batchError) {
				console.warn("[AppsStore] Batch icon loading failed:", batchError);
			}
		}

		setAppsStore({
			applications: appsWithIcons,
			filteredApps: appsWithIcons,
			loadingProgress: 100,
		});
	} catch (error) {
		console.error("[AppsStore] Error refreshing applications:", error);
	} finally {
		setAppsStore({ isLoading: false });
	}
}

export function searchApps(query: string) {
	setAppsStore({ searchQuery: query });

	if (query.trim() === "") {
		setAppsStore({ filteredApps: appsStore.applications });
		return;
	}

	const lowerQuery = query.toLowerCase();
	const filtered = appsStore.applications.filter(
		(app) =>
			app.name.toLowerCase().includes(lowerQuery) ||
			app.description?.toLowerCase().includes(lowerQuery) ||
			app.categories.some((cat) => cat.toLowerCase().includes(lowerQuery)),
	);

	setAppsStore({ filteredApps: filtered });
}

export async function launchApp(app: Application) {
	if (!isTauri()) return;
	try {
		await invoke("launch_application", { exec: app.exec });
	} catch (error) {
		console.error("Error launching application:", error);
	}
}
