# CLAUDE.md - lowCast Project Guide

Desktop launcher + clipboard manager built with Tauri + SolidJS + TypeScript.

## Overview

**lowCast** is a cross-platform (Linux/Windows) desktop app:
- Application launcher with search and icon caching
- Clipboard history (text + images with PNG compression)
- Global shortcut (Alt+C), system tray, transparent overlay
- Wayland Layer Shell support

## Tech Stack

**Frontend**: SolidJS 1.9.5, TypeScript 5.9.3, TanStack Solid Router, Tailwind CSS 4.x, Lucide Solid
**Backend**: Tauri 2.x, Rust 2021 edition, SQLite
**Build**: Vite 7.x, Bun, Biome 2.x

## Architecture

```
src/
├── routes/           # File-based routing (TanStack)
│   ├── __root.tsx    # Root layout with error boundary
│   └── index.tsx     # Main unified search page
├── components/       # UI components (badge, button, card, etc.)
├── stores/           # SolidJS reactive stores
│   ├── clipboardStore.ts  # Clipboard state
│   └── appsStore.ts       # App list with icon caching
├── hooks/            # useGlobalShortcut, useCliNavigation
└── lib/              # database.ts, utils.ts

src-tauri/src/
├── lib.rs            # Main app setup (tray, shortcuts, window)
├── apps/             # Application discovery (linux.rs, windows.rs)
├── window.rs         # Window visibility commands
└── image.rs          # Image processing
```

## Key Commands

```bash
bun install           # Install dependencies
bun run tauri dev     # Development
bun run tauri build   # Production build
bun run lint          # Lint (safe fixes)
```

## Tauri Commands

**Apps**: `list_applications`, `refresh_applications`, `launch_application`
**Icons**: `get_icon_data_url`, `get_icons_batch`
**Window**: `show_window`, `hide_window`, `toggle_window`
**Image**: `compress_png`, `rgba_to_png`

## SolidJS Patterns

```typescript
import { createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";

function Component() {
  const [state, setState] = createSignal();
  createEffect(() => {});
  onMount(() => {});
  onCleanup(() => {});
  
  // Use 'class' not 'className'!
  return <div class="...">...</div>;
}
```

**Important**: Use `class` not `className`. Don't destructure props. Use `For` for lists, `Show` for conditionals.

## Path Aliases

```typescript
import { Button } from "@/components";
import { appsStore } from "@/stores/appsStore";
```

## Database

SQLite at `{appDataDir}/lowcast.db`:
```sql
CREATE TABLE clipboard_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL CHECK(content_type IN ('text', 'image')),
  content TEXT NOT NULL,
  preview TEXT,
  hash TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## File Locations

- **Database**: `{appDataDir}/lowcast.db`
- **Clipboard Images**: `{appDataDir}/clipboard_images/`
- **App Cache**: `{appDataDir}/app_cache.json`
- **Linux App Data**: `~/.local/share/com.felipeb.lowcast/`

## Adding New Features

### New Route
1. Create `src/routes/name.tsx`
2. Use `createFileRoute`:
```typescript
import { createFileRoute } from "@tanstack/solid-router";
export const Route = createFileRoute("/name")({ component: Name });
function Name() { return <div>Content</div>; }
```

### New Tauri Command
1. Add `#[tauri::command]` function in Rust
2. Register in `invoke_handler` in `lib.rs`
3. Call with `invoke<Type>("command_name", { param })`

## Biome Config

- Tabs, 4 width, line width 120
- Double quotes, auto-organize imports
- SolidJS domain linting enabled
- Excludes `routeTree.gen.ts`

## Watch Out For

1. **SolidJS vs React**: `class` not `className`, no prop destructuring
2. **Platform code**: Use `#[cfg(target_os = "...")]` in Rust
3. **Images**: RGBA→PNG via Rust, use `convertFileSrc()` for display
4. **Paths**: Use Tauri APIs, never hardcode

## Links

- [Tauri v2](https://tauri.app/v2/)
- [SolidJS](https://docs.solidjs.com/)
- [TanStack Router](https://tanstack.com/router/latest)
