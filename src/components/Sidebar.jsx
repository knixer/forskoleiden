import { useState } from "react";
import { UserPlus, Trash2, Settings, ChevronRight } from "lucide-react";

export default function Sidebar({ children, selected, onSelect, onAdd, onDelete, onOpenSettings, isOpen, childAlerts = {} }) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    onAdd(name);
    setNewName("");
    setAdding(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleAdd();
    if (e.key === "Escape") { setAdding(false); setNewName(""); }
  }

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <div className="app-brand">
          <span className="brand-mark">◈</span>
          <span className="brand-name">CareDoc</span>
        </div>
      </div>

      <div className="sidebar-add-section">
        {adding ? (
          <div className="add-child-form">
            <input
              autoFocus
              className="add-input"
              placeholder="Child's name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="add-form-actions">
              <button className="btn-confirm" onClick={handleAdd}>Add</button>
              <button className="btn-cancel" onClick={() => { setAdding(false); setNewName(""); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="add-child-btn" onClick={() => setAdding(true)}>
            <UserPlus size={15} />
            Add Child
          </button>
        )}
      </div>

      <div className="sidebar-label">CHILDREN</div>

      <nav className="child-list">
        {children.length === 0 && (
          <div className="child-list-empty">No children added yet</div>
        )}
        {children.map((child) => (
          <div
            key={child.id}
            className={`child-item ${selected?.id === child.id ? "active" : ""}`}
            onClick={() => onSelect(child)}
            onMouseEnter={() => setHoveredId(child.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="child-avatar">{child.name[0].toUpperCase()}</div>
            <span className="child-name">{child.name}</span>
            <div className="child-item-right">
              {childAlerts[child.id] && (
                <span className={`alert-dot ${childAlerts[child.id]}`} title={`Alert: ${childAlerts[child.id]}`} />
              )}
              {hoveredId === child.id && selected?.id !== child.id && (
                <button
                  className="child-delete-btn"
                  onClick={(e) => { e.stopPropagation(); onDelete(child); }}
                  title="Remove"
                >
                  <Trash2 size={13} />
                </button>
              )}
              {selected?.id === child.id && (
                <ChevronRight size={14} className="child-active-arrow" />
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="settings-btn" onClick={onOpenSettings}>
          <Settings size={15} />
          AI Settings
        </button>
      </div>
    </aside>
  );
}
