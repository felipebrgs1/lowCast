# lowCast

Productivity desktop application built with Tauri v2 and SolidJS.

## Project Structure

The project combines Rust's performance on the backend with SolidJS's reactivity on the frontend. State management and routing are optimized for low resource consumption.

## Prerequisites

Before running the project, ensure you have the necessary environment dependencies installed for Tauri.
Please refer to the official guide: [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

You will also need **Bun** installed to manage packages and run scripts.

## Technologies Used

- **Tauri v2**: Framework for building lightweight desktop apps.
- **SolidJS**: Declarative and high-performance UI library.
- **TypeScript**: Static typing superset for JavaScript.
- **Tailwind CSS v4**: Utility-first CSS framework for styling.
- **TanStack Router**: Type-safe routing management.
- **Biome**: Code linter and formatter.
- **Bun**: Runtime and package manager.

## Available Shortcuts

- **Alt + C**: Show/Hide the application (Global).

## How to Run

### Development

1. Install dependencies:
   ```bash
   bun install
   ```

2. Run in development mode:
   ```bash
   bun run tauri dev
   ```
   This command starts the frontend dev server and Tauri, opening the application window.

### Build

To create a production build for your operating system:

```bash
bun run tauri build
```

The executable will be located in `src-tauri/target/release/bundle/`.
