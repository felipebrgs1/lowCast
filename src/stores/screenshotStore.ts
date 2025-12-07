import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createStore } from "solid-js/store";

export interface ScreenshotResult {
	path: string;
	width: number;
	height: number;
}

export interface MonitorInfo {
	id: number;
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	is_primary: boolean;
}

export interface ScreenshotCapabilities {
	platform: string;
	display_server: string;
	native_region_selection: boolean;
	has_grim: boolean;
	has_slurp: boolean;
}

interface ScreenshotState {
	isCapturing: boolean;
	lastScreenshot: ScreenshotResult | null;
	monitors: MonitorInfo[];
	capabilities: ScreenshotCapabilities | null;
	error: string | null;
	showNotification: boolean;
	notificationMessage: string;
}

const [screenshotStore, setScreenshotStore] = createStore<ScreenshotState>({
	isCapturing: false,
	lastScreenshot: null,
	monitors: [],
	capabilities: null,
	error: null,
	showNotification: false,
	notificationMessage: "",
});

export { screenshotStore };

// Load capabilities on init
export async function loadCapabilities(): Promise<void> {
	try {
		const capabilities = await invoke<ScreenshotCapabilities>("get_screenshot_capabilities");
		setScreenshotStore("capabilities", capabilities);
	} catch (err) {
		console.error("Failed to load screenshot capabilities:", err);
	}
}

// Load monitors
export async function loadMonitors(): Promise<void> {
	try {
		const monitors = await invoke<MonitorInfo[]>("list_monitors");
		setScreenshotStore("monitors", monitors);
	} catch (err) {
		console.error("Failed to load monitors:", err);
		setScreenshotStore("error", String(err));
	}
}

// Take fullscreen screenshot
export async function takeFullscreenScreenshot(): Promise<ScreenshotResult | null> {
	setScreenshotStore("isCapturing", true);
	setScreenshotStore("error", null);

	try {
		const result = await invoke<ScreenshotResult>("screenshot_fullscreen");
		setScreenshotStore("lastScreenshot", result);
		showNotification(`Screenshot saved: ${result.path}`);
		return result;
	} catch (err) {
		setScreenshotStore("error", String(err));
		console.error("Screenshot failed:", err);
		return null;
	} finally {
		setScreenshotStore("isCapturing", false);
	}
}

// Take region screenshot (uses native slurp on Wayland)
export async function takeRegionScreenshot(): Promise<ScreenshotResult | null> {
	setScreenshotStore("isCapturing", true);
	setScreenshotStore("error", null);

	try {
		const result = await invoke<ScreenshotResult>("screenshot_select_region");
		setScreenshotStore("lastScreenshot", result);
		showNotification(`Screenshot saved: ${result.path}`);
		return result;
	} catch (err) {
		// If region selection not supported natively, the frontend needs to handle it
		if (String(err).includes("frontend overlay")) {
			setScreenshotStore("error", "Use in-app selection for this platform");
		} else {
			setScreenshotStore("error", String(err));
		}
		console.error("Region screenshot failed:", err);
		return null;
	} finally {
		setScreenshotStore("isCapturing", false);
	}
}

// Take screenshot of specific area
export async function takeAreaScreenshot(
	x: number,
	y: number,
	width: number,
	height: number,
): Promise<ScreenshotResult | null> {
	setScreenshotStore("isCapturing", true);
	setScreenshotStore("error", null);

	try {
		const result = await invoke<ScreenshotResult>("screenshot_area", {
			x,
			y,
			width,
			height,
		});
		setScreenshotStore("lastScreenshot", result);
		showNotification(`Screenshot saved: ${result.path}`);
		return result;
	} catch (err) {
		setScreenshotStore("error", String(err));
		console.error("Area screenshot failed:", err);
		return null;
	} finally {
		setScreenshotStore("isCapturing", false);
	}
}

// Take screenshot of specific monitor
export async function takeMonitorScreenshot(monitorId: number): Promise<ScreenshotResult | null> {
	setScreenshotStore("isCapturing", true);
	setScreenshotStore("error", null);

	try {
		const result = await invoke<ScreenshotResult>("screenshot_monitor", {
			monitorId,
		});
		setScreenshotStore("lastScreenshot", result);
		showNotification(`Screenshot saved: ${result.path}`);
		return result;
	} catch (err) {
		setScreenshotStore("error", String(err));
		console.error("Monitor screenshot failed:", err);
		return null;
	} finally {
		setScreenshotStore("isCapturing", false);
	}
}

// Copy last screenshot to clipboard
export async function copyLastScreenshotToClipboard(): Promise<boolean> {
	if (!screenshotStore.lastScreenshot) {
		setScreenshotStore("error", "No screenshot to copy");
		return false;
	}

	try {
		await invoke("copy_screenshot_to_clipboard", {
			path: screenshotStore.lastScreenshot.path,
		});
		showNotification("Screenshot copied to clipboard");
		return true;
	} catch (err) {
		setScreenshotStore("error", String(err));
		console.error("Failed to copy to clipboard:", err);
		return false;
	}
}

// Open screenshots folder
export async function openScreenshotsFolder(): Promise<void> {
	try {
		await invoke("open_screenshots_folder");
	} catch (err) {
		setScreenshotStore("error", String(err));
		console.error("Failed to open folder:", err);
	}
}

// Show notification
function showNotification(message: string): void {
	setScreenshotStore("notificationMessage", message);
	setScreenshotStore("showNotification", true);
	setTimeout(() => {
		setScreenshotStore("showNotification", false);
	}, 3000);
}

// Listen for CLI screenshot events
export function setupCliScreenshotListener(): () => void {
	let unlisten: (() => void) | null = null;

	listen<string>("cli-screenshot", async (event) => {
		const mode = event.payload;

		if (mode === "fullscreen") {
			await takeFullscreenScreenshot();
		} else if (mode === "area") {
			await takeRegionScreenshot();
		}
	}).then((fn) => {
		unlisten = fn;
	});

	return () => {
		if (unlisten) unlisten();
	};
}
