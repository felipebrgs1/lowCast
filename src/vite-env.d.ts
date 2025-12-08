/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_ENABLE_APP_MONITOR?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
