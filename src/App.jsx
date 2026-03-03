import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import NoteView from "./components/NoteView";
import SettingsModal from "./components/SettingsModal";
import { fetchChildren, addChild, deleteChild, fetchAiSettings } from "./lib/db";
import "./styles/app.css";

export default function App() {
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [aiSettings, setAiSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [kids, settings] = await Promise.all([fetchChildren(), fetchAiSettings()]);
      setChildren(kids);
      setAiSettings(settings);
      if (kids.length > 0) setSelectedChild(kids[0]);
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddChild(name) {
    const id = await addChild(name);
    const newChild = { id, name, created_at: new Date().toISOString() };
    setChildren((prev) => [...prev, newChild].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedChild(newChild);
  }

  async function handleDeleteChild(child) {
    if (!confirm(`Remove ${child.name} and all their notes?`)) return;
    await deleteChild(child.id);
    setChildren((prev) => prev.filter((c) => c.id !== child.id));
    if (selectedChild?.id === child.id) {
      setSelectedChild(children.find((c) => c.id !== child.id) ?? null);
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <span>Loading CareDoc…</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        children={children}
        selected={selectedChild}
        onSelect={setSelectedChild}
        onAdd={handleAddChild}
        onDelete={handleDeleteChild}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="main-content">
        {selectedChild ? (
          <NoteView child={selectedChild} aiSettings={aiSettings} />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h2>No child selected</h2>
            <p>Add a child in the sidebar to start documenting.</p>
          </div>
        )}
      </main>

      {showSettings && (
        <SettingsModal
          initial={aiSettings}
          onSave={(s) => { setAiSettings(s); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
