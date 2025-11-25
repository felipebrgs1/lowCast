import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export interface Application {
	name: string;
	exec: string;
	icon: string | null;
	iconDataUrl?: string | null;
	description: string | null;
	desktop_file: string;
	categories: string[];
}

interface AppsState {
	applications: Application[];
	filteredApps: Application[];
	isLoading: boolean;
	searchQuery: string;

	// Actions
	loadApplications: () => Promise<void>;
	search: (query: string) => void;
	launchApp: (app: Application) => Promise<void>;
}

export const useAppsStore = create<AppsState>((set, get) => ({
	applications: [],
	filteredApps: [],
	isLoading: false,
	searchQuery: "",

	loadApplications: async () => {
		set({ isLoading: true });
		try {
			const apps = await invoke<Application[]>("list_applications");

			// Carregar os data URLs dos ícones em paralelo
			const appsWithIcons = await Promise.all(
				apps.map(async (app) => {
					if (app.icon) {
						try {
							const dataUrl = await invoke<string>("get_icon_data_url", {
								iconPath: app.icon,
							});
							return { ...app, iconDataUrl: dataUrl };
						} catch (error) {
							// Se falhar ao carregar o ícone, continuar sem ele
							console.warn(`Failed to load icon for ${app.name}:`, error);
							return { ...app, iconDataUrl: null };
						}
					}
					return { ...app, iconDataUrl: null };
				}),
			);

			set({ applications: appsWithIcons, filteredApps: appsWithIcons });
		} catch (error) {
			console.error("Erro ao carregar aplicativos:", error);
		} finally {
			set({ isLoading: false });
		}
	},

	search: (query: string) => {
		const { applications } = get();
		set({ searchQuery: query });

		if (query.trim() === "") {
			set({ filteredApps: applications });
			return;
		}

		const lowerQuery = query.toLowerCase();
		const filtered = applications.filter(
			(app) =>
				app.name.toLowerCase().includes(lowerQuery) ||
				app.description?.toLowerCase().includes(lowerQuery) ||
				app.categories.some((cat) => cat.toLowerCase().includes(lowerQuery)),
		);

		set({ filteredApps: filtered });
	},

	launchApp: async (app: Application) => {
		try {
			await invoke("launch_application", { exec: app.exec });
		} catch (error) {
			console.error("Erro ao abrir aplicativo:", error);
		}
	},
}));
