import { useState } from "react";
import { Edit3, Trash2, Check, X } from "lucide-react";

export default function NoteCard({ note, index, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);

  const date = new Date(note.created_at);
  const isEdited = note.updated_at !== note.created_at;

  function handleSave() {
    if (draft.trim()) {
      onUpdate(note.id, draft.trim());
    }
    setEditing(false);
  }

  function handleCancel() {
    setDraft(note.content);
    setEditing(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
    if (e.key === "Escape") handleCancel();
  }

  return (
    <div className="note-card" style={{ animationDelay: `${index * 40}ms` }}>
      <div className="note-card-timeline">
        <div className="note-timeline-dot" />
        {index < 99 && <div className="note-timeline-line" />}
      </div>

      <div className="note-card-body">
        <div className="note-card-meta">
          <time className="note-date">
            {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </time>
          <time className="note-time">
            {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </time>
          {isEdited && <span className="note-edited-badge">edited</span>}

          <div className="note-actions">
            {!editing && (
              <>
                <button className="note-action-btn" onClick={() => setEditing(true)} title="Edit">
                  <Edit3 size={13} />
                </button>
                <button className="note-action-btn danger" onClick={() => onDelete(note.id)} title="Delete">
                  <Trash2 size={13} />
                </button>
              </>
            )}
            {editing && (
              <>
                <button className="note-action-btn success" onClick={handleSave} title="Save">
                  <Check size={13} />
                </button>
                <button className="note-action-btn" onClick={handleCancel} title="Cancel">
                  <X size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {editing ? (
          <textarea
            autoFocus
            className="note-edit-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={Math.max(3, draft.split("\n").length + 1)}
          />
        ) : (
          <p className="note-content">{note.content}</p>
        )}
      </div>
    </div>
  );
}
