# CLAUDE.md - lowCast Project Guide

This document provides comprehensive guidance for AI assistants working with the lowCast codebase. lowCast is a desktop launcher application with clipboard management capabilities, built with Tauri + React + TypeScript.

## Project Overview

**lowCast** is a cross-platform (Linux/Windows) desktop application that provides:
- Application launcher with fuzzy search
- Clipboard history manager (text and images)
- Global keyboard shortcut (Alt+Space) to toggle visibility
- Always-on-top overlay interface with transparent, borderless design

**Key Characteristics:**
- Desktop application using Tauri v2 (Rust backend + Web frontend)
- React 19 with TypeScript for UI
- TanStack Router for client-side routing
- Zustand for state management
- SQLite database for persistent storage
- shadcn/ui components with Tailwind CSS v4

## Tech Stack

### Frontend
- **React**: 19.2.0 (latest with StrictMode)
- **TypeScript**: 5.9.3 with strict mode enabled
- **TanStack Router**: 1.139.0 (file-based routing)
- **Zustand**: 5.0.8 (state management)
- **Tailwind CSS**: 4.1.17 (utility-first CSS)
- **shadcn/ui**: Component library (New York style)
- **Lucide React**: Icon library
- **Radix UI**: Headless UI primitives

### Backend (Rust/Tauri)
- **Tauri**: 2.9.4
- **Rust Edition**: 2021
- **Plugins**:
  - `tauri-plugin-clipboard-manager`: Clipboard operations
  - `tauri-plugin-sql`: SQLite database
  - `tauri-plugin-global-shortcut`: Global keyboard shortcuts
  - `tauri-plugin-shell`: Shell command execution
  - `tauri-plugin-fs`: File system access
  - `tauri-plugin-opener`: Open files/URLs

### Build Tools
- **Vite**: 7.2.4 (bundler and dev server)
- **Bun**: Package manager and runtime
- **Biome**: 2.3.7 (linter and formatter)

## Project Architecture

### Frontend Architecture

```
src/
├── main.tsx              # Entry point, React root, router setup
├── App.css               # Global styles and Tailwind config
├── routeTree.gen.ts      # Auto-generated TanStack Router tree
├── routes/               # File-based routing
│   ├── __root.tsx        # Root layout with navigation
│   ├── index.tsx         # Main search/launcher page
│   ├── clipboard.tsx     # Clipboard history page
│   └── apps.tsx          # Application list page
├── components/
│   └── ui/               # shadcn/ui components
│       ├── command.tsx   # Command palette component
│       ├── dialog.tsx    # Modal dialogs
│       ├── input.tsx     # Input fields
│       ├── button.tsx    # Button component
│       ├── card.tsx      # Card component
│       ├── tabs.tsx      # Tab component
│       └── ...
├── stores/               # Zustand state stores
│   ├── clipboardStore.ts # Clipboard state and operations
│   └── appsStore.ts      # Application list state
├── hooks/                # Custom React hooks
│   └── useGlobalShortcut.ts # Global shortcut registration
├── lib/                  # Utilities and services
│   ├── database.ts       # SQLite database functions
│   └── utils.ts          # Helper utilities
└── assets/               # Static assets
```

### Backend Architecture (Rust)

```
src-tauri/
├── src/
│   ├── main.rs           # Binary entry point
│   └── lib.rs            # Library code with Tauri commands
├── Cargo.toml            # Rust dependencies
├── tauri.conf.json       # Tauri configuration
├── build.rs              # Build script
├── capabilities/         # Permission definitions
└── icons/                # Application icons
```

### Key Tauri Commands

Defined in `src-tauri/src/lib.rs`:

1. **`list_applications()`**: Returns list of installed desktop applications
   - Linux: Parses `.desktop` files from standard locations
   - Windows: Parses `.lnk` files from Start Menu using PowerShell

2. **`launch_application(exec: String)`**: Launches an application by its exec command

## Directory Structure Details

### `src/routes/`
File-based routing powered by TanStack Router:
- `__root.tsx`: Root layout component with navigation tabs and `<Outlet />`
- `index.tsx`: Main search interface (combines apps + clipboard)
- `clipboard.tsx`: Dedicated clipboard history view
- `apps.tsx`: Dedicated application list view

**Routing Convention**: Files automatically become routes based on filename.

### `src/stores/`
Zustand stores for global state:

**clipboardStore.ts**:
- Manages clipboard history (text & images)
- Polling-based clipboard monitoring (1s interval)
- Deduplication via SHA-256 hashing
- Image storage in app data directory
- SQLite persistence

**appsStore.ts**:
- Caches application list from Tauri backend
- Client-side fuzzy search
- Application launching

### `src/lib/database.ts`
SQLite operations using `@tauri-apps/plugin-sql`:
- Schema initialization
- CRUD operations for clipboard history
- Uses parameterized queries (safe from SQL injection)

**Schema**:
```sql
CREATE TABLE clipboard_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT CHECK(content_type IN ('text', 'image')),
  content TEXT NOT NULL,        -- File path for images
  preview TEXT,                 -- Preview text/thumbnail path
  hash TEXT UNIQUE,              -- SHA-256 hash for deduplication
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## Development Workflows

### Setup and Installation
```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Build for production
bun run build

# Run Tauri commands
bun run tauri dev
bun run tauri build
```

### Development Server
- Frontend: Vite dev server on `http://localhost:1420`
- HMR (Hot Module Reload) enabled
- Tauri watches Rust changes and recompiles automatically

### Linting and Formatting
```bash
# Lint and format with Biome
bun run lint:unsafe
```

**Biome Configuration** (`biome.json`):
- Tabs for indentation (width: 4)
- Line width: 120 characters
- Double quotes for strings
- Auto-organize imports
- Git-aware (respects .gitignore)

## Coding Conventions

### TypeScript
- **Strict mode enabled**: No implicit any, strict null checks
- **Path aliases**: Use `@/` for imports from `src/`
  ```typescript
  import { Button } from "@/components/ui/button";
  import { useClipboardStore } from "@/stores/clipboardStore";
  ```
- **No unused locals/parameters**: TSConfig enforces cleanup
- **Bundler module resolution**: For Vite compatibility

### React Patterns
- **Functional components only**: No class components
- **Hooks**: Use built-in and custom hooks
- **StrictMode**: Enabled in production
- **Component structure**:
  ```typescript
  export function ComponentName() {
    // 1. Hooks
    const [state, setState] = useState();

    // 2. Effects
    useEffect(() => {}, []);

    // 3. Handlers
    const handleClick = () => {};

    // 4. Render
    return <div>...</div>;
  }
  ```

### Naming Conventions
- **Components**: PascalCase (`Button`, `ClipboardStore`)
- **Files**: Match export name (`button.tsx`, `clipboardStore.ts`)
- **Hooks**: camelCase with `use` prefix (`useGlobalShortcut`)
- **Stores**: camelCase with `Store` suffix (`useClipboardStore`)
- **Types/Interfaces**: PascalCase (`Application`, `ClipboardEntry`)

### State Management (Zustand)
```typescript
// Store definition pattern
export const useStoreName = create<StateInterface>((set, get) => ({
  // State
  data: [],
  isLoading: false,

  // Actions
  loadData: async () => {
    set({ isLoading: true });
    const data = await fetchData();
    set({ data, isLoading: false });
  },
}));

// Usage in components
function Component() {
  const { data, loadData } = useStoreName();
  // ...
}
```

### Tauri Invoke Pattern
```typescript
import { invoke } from "@tauri-apps/api/core";

// Invoke Rust command
const result = await invoke<ReturnType>("command_name", {
  paramName: value,
});
```

### Database Operations
Always use the centralized `getDatabase()` function:
```typescript
import { getDatabase } from "@/lib/database";

const db = await getDatabase();
await db.execute("SQL", [params]);
const results = await db.select<Type[]>("SQL", [params]);
```

### Error Handling
- Use try-catch blocks for async operations
- Log errors to console for debugging
- Provide user feedback for critical errors
- Don't crash on non-critical errors (e.g., clipboard read failures)

## Key Features Implementation

### 1. Global Shortcut (Alt+Space)
- Registered in `useGlobalShortcut` hook
- Toggles window visibility
- Cleanup on component unmount

### 2. Clipboard Monitoring
- Polling interval: 1000ms
- Reads both text and images
- Deduplication via content hashing
- Images saved to `{appDataDir}/clipboard_images/`

### 3. Application Discovery
**Linux**:
- Searches `.desktop` files in:
  - `/usr/share/applications`
  - `/usr/local/share/applications`
  - `~/.local/share/applications`
  - Flatpak directories
- Filters: NoDisplay=true, Hidden=true, Type!=Application

**Windows**:
- PowerShell script scans Start Menu shortcuts (`.lnk`)
- Filters `.exe` targets only

### 4. Transparent Overlay Window
Configuration in `tauri.conf.json`:
```json
{
  "decorations": false,    // No title bar
  "transparent": true,     // See-through background
  "resizable": false,      // Fixed size
  "skipTaskbar": true,     // No taskbar icon
  "alwaysOnTop": true      // Always visible
}
```

## Common Patterns

### Adding a New Route
1. Create file in `src/routes/` (e.g., `settings.tsx`)
2. Export route using `createFileRoute`:
   ```typescript
   import { createFileRoute } from "@tanstack/react-router";

   export const Route = createFileRoute("/settings")({
     component: Settings,
   });

   function Settings() {
     return <div>Settings</div>;
   }
   ```
3. Add navigation link in `__root.tsx`

### Adding a New Tauri Command
1. Define Rust function with `#[tauri::command]` in `lib.rs`:
   ```rust
   #[tauri::command]
   fn my_command(param: String) -> Result<String, String> {
       Ok(format!("Received: {}", param))
   }
   ```
2. Register in `invoke_handler`:
   ```rust
   .invoke_handler(tauri::generate_handler![
       list_applications,
       launch_application,
       my_command  // Add here
   ])
   ```
3. Call from TypeScript:
   ```typescript
   const result = await invoke<string>("my_command", { param: "value" });
   ```

### Adding a shadcn/ui Component
```bash
# Component will be added to src/components/ui/
npx shadcn@latest add <component-name>
```

### Adding Database Table/Fields
1. Modify schema in `src/lib/database.ts` (`initSchema` function)
2. Add TypeScript interface for type safety
3. Add CRUD functions
4. Database file: `{appDataDir}/lowcast.db`

## Things to Watch Out For

### 1. Platform-Specific Code
- Always handle Linux and Windows differences
- Use `#[cfg(target_os = "...")]` in Rust
- Test on both platforms when possible

### 2. Clipboard Image Handling
- Images use RGBA format from Tauri
- Convert to PNG for storage
- Use `convertFileSrc()` to display file:// URLs in React

### 3. Path Handling
- Use Tauri path APIs: `appDataDir()`, `join()`
- Never hardcode paths
- Windows: Handle backslashes in paths

### 4. Global Shortcut Conflicts
- Alt+Space may conflict with system shortcuts
- Always unregister on cleanup
- Handle registration failures gracefully

### 5. Database Migrations
- No automatic migration system currently
- Schema changes require manual migration
- Consider adding version tracking

### 6. Security Considerations
- CSP is disabled (`"csp": null`) - required for Tauri
- Use parameterized SQL queries (already implemented)
- Sanitize exec commands before launching applications

### 7. Performance
- Clipboard polling can be CPU-intensive
- Image processing on main thread (consider worker)
- Limit search results to prevent UI lag

## File Locations

- **Database**: `{appDataDir}/lowcast.db`
- **Clipboard Images**: `{appDataDir}/clipboard_images/`
- **Config**: `src-tauri/tauri.conf.json`
- **App Data Dir** (Linux): `~/.local/share/com.felipeb.lowcast/`
- **App Data Dir** (Windows): `%APPDATA%\com.felipeb.lowcast\`

## TypeScript Configuration

- **Target**: ES2022
- **Module**: ESNext
- **JSX**: react-jsx (automatic runtime)
- **Strict**: true
- **Path Aliases**: `@/*` → `./src/*`

## Build Configuration

### Vite (`vite.config.ts`)
- Fixed port: 1420 (required by Tauri)
- HMR port: 1421
- TanStack Router plugin (auto code-splitting)
- Tailwind CSS plugin
- Ignores `src-tauri` for file watching

### Tauri (`tauri.conf.json`)
- **Dev Command**: `bun run dev`
- **Build Command**: `bun run build`
- **Frontend Dist**: `../dist`
- **Bundle Targets**: All platforms
- **Window Size**: 800x600

## Testing Strategy

Currently no automated tests. When adding tests:
- Use Vitest for unit tests
- Consider Playwright for e2e tests
- Mock Tauri APIs in tests
- Test cross-platform functionality

## Useful Commands

```bash
# Development
bun run dev               # Start Vite dev server
bun run tauri dev         # Start Tauri with frontend

# Building
bun run build             # Build frontend
bun run tauri build       # Build complete app bundle

# Linting
bun run lint:unsafe       # Fix lint issues with Biome

# Tauri CLI
bun run tauri info        # System information
bun run tauri icon        # Generate icons from PNG
```

## External Resources

- [Tauri Documentation](https://tauri.app/v2/)
- [TanStack Router Docs](https://tanstack.com/router/latest)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [Biome Documentation](https://biomejs.dev/)

## Version Information

- **Project Version**: 0.1.0
- **Last Updated**: 2025-11-25
- **Tauri**: v2.9.4
- **React**: 19.2.0
- **TypeScript**: 5.9.3

---

**Note for AI Assistants**: This document reflects the current state of the codebase. When making changes, ensure you:
1. Follow the established patterns and conventions
2. Test on multiple platforms when applicable
3. Update documentation if adding new features
4. Maintain backward compatibility where possible
5. Consider security implications of any changes
