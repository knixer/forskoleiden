import { useState, useEffect, useRef } from "react";
import { Plus, Bot, Loader, Menu } from "lucide-react";
import { fetchNotes, addNote, updateNote, deleteNote } from "../lib/db";
import NoteCard from "./NoteCard";
import AIPanel from "./AIPanel";

export default function NoteView({ child, aiSettings, onMenuClick }) {
  const [notes, setNotes] = useState([]);
  const [newContent, setNewContent] = useState("");
  const [showAI, setShowAI] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    loadNotes();
  }, [child.id]);

  async function loadNotes() {
    setLoading(true);
    try {
      const rows = await fetchNotes(child.id);
      setNotes(rows);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote() {
    const content = newContent.trim();
    if (!content) return;
    setSaving(true);
    try {
      const id = await addNote(child.id, content);
      const newNote = { id, child_id: child.id, content, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      setNotes((prev) => [newNote, ...prev]);
      setNewContent("");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateNote(id, content) {
    await updateNote(id, content);
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, content, updated_at: new Date().toISOString() } : n));
  }

  async function handleDeleteNote(id) {
    await deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNote();
  }

  return (
    <div className="note-view">
      {/* Header */}
      <div className="note-view-header">
        <div className="note-view-title-row">
          <button className="mobile-menu-btn" onClick={onMenuClick} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <div className="child-header-avatar">{child.name[0].toUpperCase()}</div>
          <h1 className="note-view-title">{child.name}</h1>
          <div className="note-count-badge">{notes.length} note{notes.length !== 1 ? "s" : ""}</div>
        </div>
        <button
          className={`ai-toggle-btn ${showAI ? "active" : ""}`}
          onClick={() => setShowAI((v) => !v)}
        >
          <Bot size={16} />
          {showAI ? "Hide AI" : "Ask AI"}
        </button>
      </div>

      <div className="note-view-body">
        {/* Notes column */}
        <div className="notes-column">
          {/* New note composer */}
          <div className="note-composer">
            <div className="composer-label">New documentation entry</div>
            <textarea
              ref={textareaRef}
              className="composer-textarea"
              placeholder="Document observations, behaviors, milestones…"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
            />
            <div className="composer-footer">
              <span className="composer-hint">⌘ + Enter to save</span>
              <button
                className="composer-submit"
                onClick={handleAddNote}
                disabled={!newContent.trim() || saving}
              >
                {saving ? <Loader size={14} className="spin" /> : <Plus size={14} />}
                Add Entry
              </button>
            </div>
          </div>

          {/* Notes list */}
          {loading ? (
            <div className="notes-loading">
              <Loader size={20} className="spin" />
            </div>
          ) : notes.length === 0 ? (
            <div className="notes-empty">
              <div className="notes-empty-icon">📝</div>
              <p>No entries yet. Start documenting above.</p>
            </div>
          ) : (
            <div className="notes-list">
              {notes.map((note, i) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  index={i}
                  onUpdate={handleUpdateNote}
                  onDelete={handleDeleteNote}
                />
              ))}
            </div>
          )}
        </div>

        {/* AI Panel */}
        {showAI && (
          <AIPanel
            child={child}
            notes={notes}
            aiSettings={aiSettings}
          />
        )}
      </div>
    </div>
  );
}
