import { useRouter } from "@tanstack/solid-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { onCleanup, onMount } from "solid-js";
import { isTauri } from "@/lib/utils";

export function useCliNavigation() {
	const router = useRouter();

	onMount(() => {
		if (!isTauri()) return;
		const window = getCurrentWindow();

		// Escutar eventos de navegação via CLI
		const unlisten = window.listen<string>("cli-navigate", (event) => {
			const routePath = event.payload;
			console.log("CLI navigation to:", routePath);
			router.navigate({ to: routePath });
		});

		onCleanup(() => {
			unlisten.then((fn) => fn());
		});
	});
}
