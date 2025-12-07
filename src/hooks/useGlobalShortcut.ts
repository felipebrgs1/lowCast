import { getCurrentWindow } from "@tauri-apps/api/window";
import { isRegistered, register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { onCleanup, onMount } from "solid-js";
import { isTauri } from "@/lib/utils";

export function useGlobalShortcut(shortcut = "Alt+Space") {
	let isShortcutRegistered = false;

	onMount(() => {
		const setupShortcut = async () => {
			if (!isTauri()) return;
			try {
				// Verificar se já está registrado
				const alreadyRegistered = await isRegistered(shortcut);
				if (alreadyRegistered) {
					await unregister(shortcut);
				}

				// Registrar o shortcut
				await register(shortcut, async (event) => {
					if (event.state === "Pressed") {
						const window = getCurrentWindow();
						const isVisible = await window.isVisible();

						if (isVisible) {
							await window.hide();
						} else {
							await window.show();
							await window.setFocus();
						}
					}
				});

				isShortcutRegistered = true;
				console.log(`Global shortcut ${shortcut} registrado`);
			} catch (error) {
				console.error("Erro ao registrar shortcut:", error);
			}
		};

		setupShortcut();

		onCleanup(() => {
			if (isShortcutRegistered) {
				unregister(shortcut).catch(console.error);
				isShortcutRegistered = false;
			}
		});
	});
}
