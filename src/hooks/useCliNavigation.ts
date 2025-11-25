import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export function useCliNavigation() {
	const navigate = useNavigate();

	useEffect(() => {
		const window = getCurrentWindow();

		// Escutar eventos de navegação via CLI
		const unlisten = window.listen<string>("cli-navigate", (event) => {
			const route = event.payload;
			console.log("CLI navigation to:", route);
			navigate({ to: route });
		});

		return () => {
			unlisten.then((fn) => fn());
		};
	}, [navigate]);
}
