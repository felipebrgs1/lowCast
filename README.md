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

---

## 🗺️ Roadmap

> **Vision**: Transform lowCast into an **All-in-One Productivity Tool** — a Swiss army knife of native desktop utilities.

### Phase 1: Essential Tools 🔧

| Feature | Description | Status |
|---------|-------------|--------|
| **Calculator** | Scientific and basic calculator with operation history | ⏳ Pending |
| **Screenshot** | Screen capture (selected area, window, full screen) with annotations | ⏳ Pending |
| **Image Editor** | Crop, resize, basic filters, annotations and drawings | ⏳ Pending |
| **Color Picker** | Native color picker with history and formats (HEX, RGB, HSL) | ⏳ Pending |
| **Clipboard History** | Clipboard history with search and favorites | ✅ Implemented |

### Phase 2: Productivity & Organization 📋

| Feature | Description | Status |
|---------|-------------|--------|
| **Quick Notes** | Quick notes with markdown and tags | ⏳ Pending |
| **Timer/Pomodoro** | Timer with integrated Pomodoro technique | ⏳ Pending |
| **Unit Converter** | Unit converter (measurements, temperature, currencies) | ⏳ Pending |
| **Hash Generator** | Hash generation (MD5, SHA-1, SHA-256) for files and text | ⏳ Pending |
| **JSON/YAML Formatter** | JSON, YAML, and XML formatter and validator | ⏳ Pending |
| **Base64 Encoder** | Base64 encode/decode for text and files | ⏳ Pending |

### Phase 3: Advanced Tools ⚡

| Feature | Description | Status |
|---------|-------------|--------|
| **Screen Recording** | Screen recording with audio (selected area or full screen) | ⏳ Pending |
| **QR Code Generator** | Create and read QR Codes | ⏳ Pending |
| **Lorem Ipsum Generator** | Placeholder text generator | ⏳ Pending |
| **UUID Generator** | UUID generation v1, v4, v7 | ⏳ Pending |
| **Password Generator** | Secure passwords with customizable criteria | ⏳ Pending |
| **Regex Tester** | Regular expression tester with highlighting | ⏳ Pending |
| **Diff Viewer** | Side-by-side text comparator | ⏳ Pending |

### Phase 4: Integrations & System 🔌

| Feature | Description | Status |
|---------|-------------|--------|
| **App Launcher** | Quick application launcher | ✅ Implemented |
| **System Info** | System information (CPU, RAM, Disk) | ⏳ Pending |
| **Network Tools** | Ping, DNS lookup, IP info | ⏳ Pending |
| **File Hash Checker** | Verify file integrity | ⏳ Pending |
| **Snippets Manager** | Code snippets library with syntax highlighting | ⏳ Pending |
| **Bookmark Manager** | Link/bookmark manager with tags | ⏳ Pending |

### Phase 5: Polish & Optimization 💎

| Feature | Description | Status |
|---------|-------------|--------|
| **Themes** | Light/dark and custom theme support | ⏳ Pending |
| **Plugin System** | Plugin architecture for extensibility | ⏳ Pending |
| **Sync** | Cloud data synchronization (optional) | ⏳ Pending |
| **Auto-update** | Automatic update system | ⏳ Pending |
| **Keyboard-first UX** | 100% keyboard navigation | 🔄 In Progress |
| **i18n** | Internationalization (pt-BR, en-US) | ⏳ Pending |

---

### 🎯 Immediate Next Steps

1. [ ] Implement **Calculator** with history
2. [ ] Add **Screenshot Tool** with annotations
3. [ ] Create native **Color Picker**
4. [ ] Develop basic **Image Editor**

---

### 💡 Contributing

Ideas for new tools? Open an [Issue](https://github.com/felipebrgs1/lowCast/issues) or contribute with a PR!
