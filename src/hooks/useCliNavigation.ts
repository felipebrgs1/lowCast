import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "preact/hooks";
import { route } from "preact-router";

export function useCliNavigation() {
	useEffect(() => {
		const window = getCurrentWindow();

		// Escutar eventos de navegação via CLI
		const unlisten = window.listen<string>("cli-navigate", (event) => {
			const routePath = event.payload;
			console.log("CLI navigation to:", routePath);
			route(routePath);
		});

		return () => {
			unlisten.then((fn) => fn());
		};
	}, []);
}
