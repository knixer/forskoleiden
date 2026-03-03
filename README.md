# CareDoc

A local-first desktop documentation app for caregivers to track and document observations about children. Built with **Tauri + React + SQLite**, with AI assistance via **Anthropic Claude** or **Ollama** (local models).

---

## Features

- **Child list** — sidebar with all children; add/remove with one click
- **Timeline notes** — each child has a timestamped note history
- **Edit & delete** notes inline
- **AI panel** — ask questions about a child's documentation; switch between:
  - ☁️ **Claude** (Anthropic cloud API) — GPT-grade reasoning
  - 🖥️ **Ollama** (local, offline) — llama3, mistral, etc.
- **Persistent storage** — all data lives in SQLite on device (`caredoc.db`)
- **Cross-platform** — Windows & macOS via Tauri

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Desktop    | Tauri 1.x (Rust)                    |
| Frontend   | React 18, Vite                      |
| Database   | SQLite via `@tauri-apps/plugin-sql` |
| AI (cloud) | Anthropic Claude API                |
| AI (local) | Ollama HTTP API                     |
| Styling    | Pure CSS (no Tailwind)              |
| Icons      | lucide-react                        |

---

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [Rust + Cargo](https://rustup.rs/)
- [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) for your OS

---

## Getting Started

```bash
# 1. Install Node dependencies
npm install

# 2. Run in development (hot reload)
npm run tauri dev

# 3. Build production binary
npm run tauri build
```

The built binaries will appear in `src-tauri/target/release/bundle/`.

---

## Project Structure

```
caredoc/
├── src/                        # React frontend
│   ├── main.jsx                # React entry point
│   ├── App.jsx                 # Root component
│   ├── styles/
│   │   └── app.css             # Design system & all styles
│   ├── lib/
│   │   ├── db.js               # SQLite CRUD layer
│   │   └── ai.js               # Claude + Ollama AI service
│   └── components/
│       ├── Sidebar.jsx         # Left nav — child list + add button
│       ├── NoteView.jsx        # Main content — note composer + list
│       ├── NoteCard.jsx        # Individual note with edit/delete
│       ├── AIPanel.jsx         # Right AI chat panel
│       └── SettingsModal.jsx   # AI provider configuration
├── src-tauri/                  # Tauri/Rust backend
│   ├── src/main.rs             # Rust entry point
│   ├── Cargo.toml
│   └── tauri.conf.json         # App config, permissions, window size
├── index.html
├── vite.config.js
└── package.json
```

---

## AI Integration

### Claude (Anthropic)

1. Open **AI Settings** (bottom of sidebar)
2. Set **Provider** → Claude
3. Paste your **Anthropic API key** (from [console.anthropic.com](https://console.anthropic.com))
4. Choose model: Opus 4 / Sonnet 4 / Haiku 4.5

The app uses `https://api.anthropic.com/v1/messages` directly from the frontend (allowed in Tauri via the `http` allowlist).

### Ollama (Local / Offline)

1. [Install Ollama](https://ollama.ai)
2. Pull a model: `ollama pull llama3`
3. In **AI Settings** → Provider → **Ollama**
4. Set Base URL (default: `http://localhost:11434`)
5. Set Model name (e.g. `llama3`, `mistral`, `gemma`)

The app calls `POST /api/chat` on the Ollama server with full conversation context.

---

## Database Schema

```sql
-- Children
CREATE TABLE children (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Documentation notes (one-to-many)
CREATE TABLE notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id   INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- AI configuration (single row)
CREATE TABLE ai_settings (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  provider         TEXT DEFAULT 'claude',
  claude_api_key   TEXT DEFAULT '',
  claude_model     TEXT DEFAULT 'claude-sonnet-4-20250514',
  ollama_base_url  TEXT DEFAULT 'http://localhost:11434',
  ollama_model     TEXT DEFAULT 'llama3',
  system_prompt    TEXT DEFAULT '...'
);
```

The SQLite file is stored at the Tauri app data directory (platform default).

---

## Extending the App

### Add a new AI provider

1. Add a new branch in `src/lib/ai.js` → `sendToAI()`
2. Add UI controls in `SettingsModal.jsx`
3. Add a DB column in `ai_settings` and update `db.js`

### Streaming responses (Ollama)

`src/lib/ai.js` exports `streamFromOllama()` — wire it into `AIPanel.jsx` for token-by-token streaming output.

### Export notes

Use `@tauri-apps/api/fs` to write the notes as PDF/CSV/Markdown to the filesystem.

---

## License

MIT
