// src/lib/db.js
// Storage layer — uses localStorage.

// ── localStorage helpers (browser mode only) ─────────────────────────────────

const LS = {
  get: (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
};

const DEFAULT_AI_SETTINGS = {
  id: 1,
  provider: "claude",
  claude_api_key: "",
  claude_model: "claude-sonnet-4-20250514",
  ollama_base_url: "http://localhost:11434",
  ollama_model: "llama3",
  system_prompt: "You are a helpful assistant reviewing child care documentation. Be concise and insightful.",
};

let _nextId = () => Date.now() + Math.floor(Math.random() * 1000);

// ── Children ─────────────────────────────────────────────────────────────────

export async function fetchChildren() {
  return LS.get("children", []).sort((a, b) => a.name.localeCompare(b.name));
}

export async function addChild(name) {
  const children = LS.get("children", []);
  const id = _nextId();
  children.push({ id, name, created_at: new Date().toISOString() });
  LS.set("children", children);
  return id;
}

export async function deleteChild(id) {
  LS.set("children", LS.get("children", []).filter((c) => c.id !== id));
  LS.set("notes", LS.get("notes", []).filter((n) => n.child_id !== id));
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function fetchNotes(childId) {
  return LS.get("notes", [])
    .filter((n) => n.child_id === childId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function addNote(childId, content) {
  const notes = LS.get("notes", []);
  const id = _nextId();
  const now = new Date().toISOString();
  notes.push({ id, child_id: childId, content, created_at: now, updated_at: now });
  LS.set("notes", notes);
  return id;
}

export async function updateNote(id, content) {
  const notes = LS.get("notes", []);
  const i = notes.findIndex((n) => n.id === id);
  if (i !== -1) notes[i] = { ...notes[i], content, updated_at: new Date().toISOString() };
  LS.set("notes", notes);
}

export async function deleteNote(id) {
  LS.set("notes", LS.get("notes", []).filter((n) => n.id !== id));
}

// ── AI Settings ───────────────────────────────────────────────────────────────

export async function fetchAiSettings() {
  return LS.get("ai_settings", DEFAULT_AI_SETTINGS);
}

export async function saveAiSettings(settings) {
  LS.set("ai_settings", { ...settings, id: 1 });
}